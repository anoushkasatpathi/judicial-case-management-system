import { Injectable } from '@nestjs/common';
import type { AiProvider, DraftOrder, PetitionExtraction, AIPrioritySuggestion, StructuredSummary } from './ai.types.js';

@Injectable()
export class LocalAiProvider implements AiProvider {
  async extractPetition(text: string): Promise<PetitionExtraction> {
    const title = text.match(/(?:case title|title)\s*:\s*(.+)/i)?.[1]?.trim() ?? 'Unspecified petition';
    const names = [...text.matchAll(/(petitioner|respondent)\s*:\s*([^\n,]+)/gi)].map((match) => ({ name: match[2].trim(), role: match[1].toLowerCase() === 'petitioner' ? 'Petitioner' as const : 'Respondent' as const }));
    const dates = [...text.matchAll(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/g)].map((match) => ({ label: 'mentioned date', date: match[1] }));
    return { case_title: title, party_names: names, case_type: text.match(/(?:case type|category)\s*:\s*(.+)/i)?.[1]?.trim() ?? 'Other', key_dates: dates, relief_sought: text.match(/(?:relief sought|prayer)\s*:\s*(.+)/i)?.[1]?.trim() ?? '' };
  }
  async classifyPriority(text: string, model: 'cheap' | 'large'): Promise<AIPrioritySuggestion> {
    const factors = ['irreparable harm', 'custodial detention', 'medical emergency', 'limitation'];
    const flagged_factors = factors.filter((factor) => text.toLowerCase().includes(factor));
    const urgency_class = flagged_factors.length >= 2 ? 'high' : flagged_factors.length === 1 ? 'medium' : 'low';
    return { urgency_class, rationale: `${model} model found ${flagged_factors.length} urgency factor(s) in the case text.`, flagged_factors, suggested_weight_delta: Math.max(-15, Math.min(15, flagged_factors.length * 5)) };
  }
  async summarize(chunks: Array<{ text: string; citation: string }>): Promise<StructuredSummary> {
    const cited = chunks.slice(0, 5).map((chunk) => ({ claim: chunk.text.slice(0, 240), citations: [chunk.citation] }));
    return { parties: cited.slice(0, 1), timeline: cited.slice(0, 2), key_evidence: cited, prior_orders: [], open_issues: cited.slice(-1) };
  }
  async draftOrder(transcript: string): Promise<DraftOrder> {
    return { case_number: transcript.match(/(?:case|matter)\s*(?:number|no\.?)\s*[:#-]?\s*([A-Z0-9/-]+)/i)?.[1] ?? 'Pending identification', appearances: transcript.match(/appearances?\s*:\s*(.+)/i)?.[1]?.split(/;|,/).map((item) => item.trim()) ?? [], submissions: transcript.match(/submissions?\s*:\s*(.+)/i)?.[1]?.split(/;|\n/).map((item) => item.trim()) ?? [], directions: transcript.match(/directions?\s*:\s*(.+)/i)?.[1]?.split(/;|\n/).map((item) => item.trim()) ?? [], next_date: transcript.match(/next date\s*:\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i)?.[1] ?? null };
  }
}