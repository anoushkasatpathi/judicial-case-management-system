import { PrismaClient, CaseStatus, DocumentType, HearingStatus, PartyRole, PriorityFactorType, UserRole, VirusScanStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();
const demoPassword = 'JustiQ-Dev-Password-2026';

function auditHash(entityId: string, action: string, afterState: unknown, previousHash: string) {
  return createHash('sha256').update(`${entityId}|${action}|${JSON.stringify(afterState)}|${previousHash}`).digest('hex');
}

async function main(): Promise<void> {
  await prisma.documentChunk.deleteMany();
  await prisma.aiCaseSummary.deleteMany();
  await prisma.aiDraftOrder.deleteMany();
  await prisma.aiPrioritySuggestion.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.priorityFactor.deleteMany();
  await prisma.hearing.deleteMany();
  await prisma.party.deleteMany();
  await prisma.document.deleteMany();
  await prisma.case.deleteMany();
  await prisma.judge.deleteMany();
  await prisma.courtroom.deleteMany();
  await prisma.court.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await argon2.hash(demoPassword);
  const [judgeA, judgeB, judgeC, advocate, registrar, admin] = await Promise.all([
    prisma.user.create({ data: { name: 'Justice Asha Mehta', email: 'judge@justiq.local', password_hash: passwordHash, role: UserRole.Judge } }),
    prisma.user.create({ data: { name: 'Justice Vikram Sen', email: 'judge.sen@justiq.local', password_hash: passwordHash, role: UserRole.Judge } }),
    prisma.user.create({ data: { name: 'Justice Mira Iyer', email: 'judge.iyer@justiq.local', password_hash: passwordHash, role: UserRole.Judge } }),
    prisma.user.create({ data: { name: 'Advocate Arjun Rao', email: 'advocate@justiq.local', password_hash: passwordHash, role: UserRole.Advocate, bar_council_id: 'BAR-DEL-1001' } }),
    prisma.user.create({ data: { name: 'Registrar Kavita Shah', email: 'registrar@justiq.local', password_hash: passwordHash, role: UserRole.Registrar } }),
    prisma.user.create({ data: { name: 'System Administrator', email: 'admin@justiq.local', password_hash: passwordHash, role: UserRole.Admin } }),
  ]);
  const courts = await Promise.all([
    prisma.court.create({ data: { name: 'JustiQ District Court', location: 'New Delhi', jurisdiction_type: 'Civil and Criminal' } }),
    prisma.court.create({ data: { name: 'JustiQ Commercial Court', location: 'Mumbai', jurisdiction_type: 'Commercial and Tax' } }),
    prisma.court.create({ data: { name: 'JustiQ Family Court', location: 'Bengaluru', jurisdiction_type: 'Family and Custody' } }),
  ]);
  const courtrooms = await Promise.all(courts.flatMap((court, index) => [
    prisma.courtroom.create({ data: { court_id: court.id, room_number: `${index + 1}01`, capacity: 80 } }),
    prisma.courtroom.create({ data: { court_id: court.id, room_number: `${index + 1}02`, capacity: 60 } }),
  ]));
  const judges = await Promise.all([
    prisma.judge.create({ data: { user_id: judgeA.id, court_id: courts[0].id, designation: 'District Judge', is_active: true } }),
    prisma.judge.create({ data: { user_id: judgeB.id, court_id: courts[1].id, designation: 'Commercial Judge', is_active: true } }),
    prisma.judge.create({ data: { user_id: judgeC.id, court_id: courts[2].id, designation: 'Family Judge', is_active: true } }),
  ]);
  const specs = [
    ['JCMS-2026-0001', 'Civil Writ Petition', CaseStatus.Listed, false, 68, 0],
    ['JCMS-2026-0002', 'Criminal Appeal', CaseStatus.Verification, true, 92, 0],
    ['JCMS-2026-0003', 'Public Interest Petition', CaseStatus.Filed, false, 22, 0],
    ['JCMS-2026-0004', 'Service Matter', CaseStatus.Returned, false, 31, 0],
    ['JCMS-2026-0005', 'Commercial Suit', CaseStatus.Heard, false, 57, 1],
    ['JCMS-2026-0006', 'Tax Appeal', CaseStatus.Disposed, false, 44, 1],
    ['JCMS-2026-0007', 'Custody Petition', CaseStatus.Listed, true, 97, 2],
    ['JCMS-2026-0008', 'Maintenance Petition', CaseStatus.Verification, false, 35, 2],
    ['JCMS-2026-0009', 'Domestic Violence Matter', CaseStatus.Filed, true, 88, 2],
  ] as const;
  const cases = [];
  for (const [caseNumber, caseType, status, emergency, score, courtIndex] of specs) {
    const court = courts[courtIndex];
    const judge = judges[courtIndex];
    const emergencyStatus = emergency ? (caseNumber.endsWith('0002') ? 'RegistrarTriage' : caseNumber.endsWith('0007') ? 'JudgeAcceptance' : 'FiledEmergency') : undefined;
    const parties = caseNumber === 'JCMS-2026-0001' ? [{ name: 'Ananya Sharma', role: PartyRole.Petitioner as const, contact_info: 'ananya.sharma@example.test' }, { name: 'State Water Board', role: PartyRole.Respondent as const, contact_info: 'respondent@example.test' }] : [{ name: `Petitioner for ${caseNumber}`, role: PartyRole.Petitioner as const, contact_info: 'petitioner@example.test' }, { name: `Respondent for ${caseNumber}`, role: PartyRole.Respondent as const, contact_info: 'respondent@example.test' }];
    const item = await prisma.case.create({ data: { case_number: caseNumber, case_type: caseType, filing_advocate_id: advocate.id, status, priority_score: score, is_emergency: emergency, emergency_status: emergencyStatus, court_id: court.id, assigned_judge_id: judge.id, parties: { create: parties }, priority_factors: { create: Object.values(PriorityFactorType).map((factorType) => ({ factor_type: factorType, weight: factorType === PriorityFactorType.EmergencyFlag && emergency ? 2 : 1, computed_score: factorType === PriorityFactorType.EmergencyFlag && emergency ? 100 : factorType === PriorityFactorType.Age ? score : 0 })) } } });
    cases.push(item);
    await prisma.document.createMany({ data: [{ case_id: item.id, uploaded_by: advocate.id, filename: `${caseNumber}-petition.txt`, doc_type: DocumentType.Petition, storage_url: `demo/${caseNumber}/petition.txt`, version: 1, checksum: `demo-${caseNumber}-petition`, virus_scan_status: VirusScanStatus.Clean }, { case_id: item.id, uploaded_by: advocate.id, filename: `${caseNumber}-order.txt`, doc_type: DocumentType.Order, storage_url: `demo/${caseNumber}/order.txt`, version: 1, checksum: `demo-${caseNumber}-order`, virus_scan_status: VirusScanStatus.Clean }] });
    const afterState = { status, priority_score: score, is_emergency: emergency };
    const hash = auditHash(item.id, 'DEMO_CASE_CREATED', afterState, '');
    await prisma.auditLog.create({ data: { entity_type: 'Case', entity_id: item.id, action: 'DEMO_CASE_CREATED', actor_id: registrar.id, before_state: {}, after_state: afterState, reason: 'Portfolio demo seed', prev_hash: '', hash } });
    if (emergency) { const emergencyAfter = { is_emergency: true, emergency_status: emergencyStatus }; await prisma.auditLog.create({ data: { entity_type: 'Case', entity_id: item.id, action: 'EMERGENCY_FLAGGED', actor_id: registrar.id, before_state: { is_emergency: false }, after_state: emergencyAfter, reason: 'Demo emergency workflow', prev_hash: hash, hash: auditHash(item.id, 'EMERGENCY_FLAGGED', emergencyAfter, hash) } }); }
  }
  for (const [index, item] of cases.entries()) {
    const courtIndex = specs[index][5];
    const status = specs[index][2];
    if ([CaseStatus.Listed, CaseStatus.Heard, CaseStatus.Disposed].includes(status)) { const date = new Date(`2026-10-${String(15 + index).padStart(2, '0')}T10:00:00.000Z`); await prisma.hearing.create({ data: { case_id: item.id, courtroom_id: courtrooms[courtIndex * 2].id, judge_id: judges[courtIndex].id, scheduled_at: date, status: status === CaseStatus.Listed ? HearingStatus.Scheduled : HearingStatus.Completed, order_summary: status === CaseStatus.Disposed ? 'Matter disposed by consent order.' : undefined, next_hearing_date: status === CaseStatus.Listed ? date : undefined } }); }
    await prisma.aiPrioritySuggestion.create({ data: { case_id: item.id, urgency_class: item.is_emergency ? 'high' : index % 2 ? 'medium' : 'low', rationale: 'Demo suggestion for review workflow.', flagged_factors: item.is_emergency ? ['irreparable harm'] : [], suggested_weight_delta: item.is_emergency ? 12 : 0, prompt_version: 'jcms-ai-v1-demo', model: 'local-demo', human_final_score: item.priority_score } });
    if (index < 4) await prisma.aiCaseSummary.create({ data: { case_id: item.id, prompt_version: 'jcms-ai-v1-demo', summary: { parties: [`Petitioner for ${item.case_number}`, `Respondent for ${item.case_number}`], timeline: ['Filing received in 2026'], key_evidence: ['Petition and supporting order are available in the document vault.'], prior_orders: index ? ['Interim procedural direction recorded.'] : [], open_issues: item.is_emergency ? ['Urgency requires judicial review.'] : ['Next procedural step pending.'] } } });
  }
  const fixtureCase = await prisma.case.findFirstOrThrow();
  const fixtureRoom = await prisma.courtroom.findFirstOrThrow();
  const fixtureJudge = await prisma.judge.findFirstOrThrow();
  await prisma.hearing.create({ data: { case_id: fixtureCase.id, courtroom_id: fixtureRoom.id, judge_id: fixtureJudge.id, scheduled_at: new Date('2026-10-15T10:00:00.000Z'), status: HearingStatus.Scheduled, next_hearing_date: new Date('2026-10-15T10:00:00.000Z') } });
  console.log(`Seeded ${courts.length} courts, ${cases.length} cases, ${cases.filter((item) => item.is_emergency).length} emergencies, and demo AI summaries.`);
  console.log(`Demo password: ${demoPassword}`);
  console.log(`Users: ${[judgeA, judgeB, judgeC, advocate, registrar, admin].map((user) => user.email).join(', ')}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
