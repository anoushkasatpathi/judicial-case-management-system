import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../prisma.service.js';
import { ObjectStorageService } from '../domain/object-storage.service.js';
import { AI_DRAFT_LABEL, type AiProvider, type AIPrioritySuggestion, type PetitionExtraction, type SpeechToTextProvider } from './ai.types.js';

const PROMPT_VERSION = 'jcms-ai-v1';
const execFileAsync = promisify(execFile);

@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService, private readonly storage: ObjectStorageService, @Inject('AiProvider') private readonly provider: AiProvider, @Inject('SpeechToText') private readonly speech: SpeechToTextProvider) {}
  async extract(documentId: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Petition document not found');
    const result = this.validateExtraction(await this.provider.extractPetition(await this.documentText(document.storage_url)));
    return { ...result, document_id: documentId, review_status: 'pending_registrar_confirmation', prompt_version: PROMPT_VERSION };
  }
  async prioritySuggestion(caseId: string) {
    const item = await this.prisma.case.findUnique({ where: { id: caseId }, include: { documents: true, parties: true } });
    if (!item) throw new NotFoundException('Case not found');
    const text = `${item.case_number}\n${item.case_type}\n${item.parties.map((party) => party.name).join('\n')}\n${(await Promise.all(item.documents.map((doc) => this.documentText(doc.storage_url)))).join('\n')}`;
    const cheap = this.validatePriority(await this.provider.classifyPriority(text, 'cheap'));
    const ambiguous = cheap.urgency_class === 'medium' || cheap.flagged_factors.length > 1;
    const suggestion = ambiguous ? this.validatePriority(await this.provider.classifyPriority(text, 'large')) : cheap;
    const stored = await this.prisma.aiPrioritySuggestion.create({ data: { case_id: caseId, urgency_class: suggestion.urgency_class, rationale: suggestion.rationale, flagged_factors: suggestion.flagged_factors, suggested_weight_delta: suggestion.suggested_weight_delta, prompt_version: PROMPT_VERSION, model: ambiguous ? 'large' : 'cheap' } });
    return { ...suggestion, id: stored.id, prompt_version: PROMPT_VERSION, model: stored.model, deterministic_score_unchanged: item.priority_score };
  }
  async recordHumanScore(suggestionId: string, humanFinalScore: number) {
    if (!Number.isInteger(humanFinalScore)) throw new BadRequestException('Human final score must be an integer');
    return this.prisma.aiPrioritySuggestion.update({ where: { id: suggestionId }, data: { human_final_score: humanFinalScore } });
  }
  async confirmExtraction(_documentId: string, body: { case_number: string; case_type: string; court_id: string; filing_advocate_id: string; parties?: Array<{ name: string; role: 'Petitioner' | 'Respondent'; contact_info?: string }> }) {
    if (!body.case_number?.trim() || !body.case_type?.trim() || !body.court_id || !body.filing_advocate_id) throw new BadRequestException('Registrar confirmation requires case number, type, court, and advocate');
    return this.prisma.case.create({ data: { case_number: body.case_number, case_type: body.case_type, court_id: body.court_id, filing_advocate_id: body.filing_advocate_id, status: 'Filed', parties: body.parties ? { create: body.parties.map((party) => ({ ...party, contact_info: party.contact_info ?? '' })) } : undefined } });
  }
  async summarize(caseId: string) {
    const item = await this.prisma.case.findUnique({ where: { id: caseId }, include: { documents: true } });
    if (!item) throw new NotFoundException('Case not found');
    const chunks: Array<{ text: string; citation: string }> = [];
    for (const document of item.documents) {
      const words = (await this.documentText(document.storage_url)).split(/\s+/).filter(Boolean);
      for (let start = 0; start < words.length; start += 700) {
        const text = words.slice(Math.max(0, start - 100), start + 700).join(' ');
        if (!text) continue;
        const citation = `${document.filename}${start ? `, chunk ${Math.floor(start / 700) + 1}` : ', page 1'}`;
        await this.prisma.$executeRaw`INSERT INTO document_chunk (id, document_id, case_id, chunk_text, page_number, embedding) VALUES (gen_random_uuid(), ${document.id}::uuid, ${caseId}::uuid, ${text}, 1, ${'[' + new Array(1536).fill(0).join(',') + ']'}::vector)`;
        chunks.push({ text, citation });
      }
    }
    const vector = '[' + Array.from({ length: 1536 }, () => '0').join(',') + ']';
    const retrieved = await this.prisma.$queryRaw<Array<{ chunk_text: string; filename: string; page_number: number | null }>>`SELECT dc.chunk_text, d.filename, dc.page_number FROM document_chunk dc JOIN "Document" d ON d.id = dc.document_id WHERE dc.case_id = ${caseId}::uuid ORDER BY dc.embedding <=> ${vector}::vector LIMIT 12`;
    const retrievedChunks = retrieved.map((chunk) => ({ text: chunk.chunk_text, citation: `${chunk.filename}, page ${chunk.page_number ?? 1}` }));
    return { case_id: caseId, prompt_version: PROMPT_VERSION, summary: await this.provider.summarize(retrievedChunks.length ? retrievedChunks : chunks), citations_required: true };
  }
  async draftOrder(hearingId: string, transcript: string, audio?: Buffer) {
    const hearing = await this.prisma.hearing.findUnique({ where: { id: hearingId }, include: { case: true } });
    if (!hearing) throw new NotFoundException('Hearing not found');
    const draft = await this.provider.draftOrder(audio ? await this.speech.transcribe(audio) : transcript);
    const stored = await this.prisma.aiDraftOrder.create({ data: { hearing_id: hearingId, draft: { ...draft, case_number: draft.case_number === 'Pending identification' ? hearing.case.case_number : draft.case_number }, label: AI_DRAFT_LABEL, prompt_version: PROMPT_VERSION } });
    return { id: stored.id, hearing_id: hearingId, label: AI_DRAFT_LABEL, draft: stored.draft, approval_required: true, prompt_version: PROMPT_VERSION };
  }
  async approveDraft(draftId: string, orderSummary: string) {
    if (!orderSummary.trim()) throw new BadRequestException('An edited or approved order summary is required');
    const draft = await this.prisma.aiDraftOrder.findUnique({ where: { id: draftId } });
    if (!draft) throw new NotFoundException('AI draft order not found');
    const hearing = await this.prisma.$transaction(async (transaction) => { await transaction.aiDraftOrder.update({ where: { id: draftId }, data: { approved_at: new Date() } }); return transaction.hearing.update({ where: { id: draft.hearing_id }, data: { order_summary: orderSummary } }); });
    return { ...hearing, review_status: 'judge_approved', draft_id: draftId };
  }
  private async documentText(key: string): Promise<string> {
    const buffer = await this.storage.getBuffer(key);
    const text = buffer.toString('utf8').replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');
    if (text.trim().length >= 40) return text;
    const directory = await mkdtemp(join(tmpdir(), 'justiq-ocr-'));
    const input = join(directory, 'petition.pdf');
    try {
      await writeFile(input, buffer);
      try {
        const digital = await execFileAsync('pdftotext', [input, '-'], { maxBuffer: 4 * 1024 * 1024 });
        if (digital.stdout.trim().length >= 40) return digital.stdout;
      } catch { /* Fall through to OCR for scanned PDFs. */ }
      const result = await execFileAsync('tesseract', [input, 'stdout'], { maxBuffer: 4 * 1024 * 1024 });
      return result.stdout.trim() || '[OCR returned no text]';
    } catch {
      return '[OCR unavailable: install Tesseract or configure a cloud OCR adapter]';
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
  private validateExtraction(result: PetitionExtraction): PetitionExtraction { if (!result.case_title.trim() || !result.case_type.trim() || !Array.isArray(result.party_names) || !Array.isArray(result.key_dates)) throw new BadRequestException('Structured petition extraction failed validation'); return { ...result, party_names: result.party_names.filter((party) => party.name.trim() && ['Petitioner', 'Respondent'].includes(party.role)), key_dates: result.key_dates.filter((date) => /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(date.date)) }; }
  private validatePriority(result: AIPrioritySuggestion): AIPrioritySuggestion { if (!['high', 'medium', 'low'].includes(result.urgency_class) || !result.rationale?.trim() || !Array.isArray(result.flagged_factors)) throw new BadRequestException('Priority suggestion failed validation'); return { ...result, suggested_weight_delta: Math.max(-15, Math.min(15, Math.round(result.suggested_weight_delta))), flagged_factors: result.flagged_factors.map(String) }; }
}