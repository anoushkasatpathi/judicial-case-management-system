import { PrismaClient, CaseStatus, HearingStatus, PartyRole, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.documentChunk.deleteMany();
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

  const passwordHash = await argon2.hash('JustiQ-Dev-Password-2026');
  const [judgeUser, advocate, registrar, admin] = await Promise.all([
    prisma.user.create({ data: { name: 'Justice Asha Mehta', email: 'judge@justiq.local', password_hash: passwordHash, role: UserRole.Judge } }),
    prisma.user.create({ data: { name: 'Advocate Arjun Rao', email: 'advocate@justiq.local', password_hash: passwordHash, role: UserRole.Advocate, bar_council_id: 'BAR-DEL-1001' } }),
    prisma.user.create({ data: { name: 'Registrar Kavita Shah', email: 'registrar@justiq.local', password_hash: passwordHash, role: UserRole.Registrar } }),
    prisma.user.create({ data: { name: 'System Administrator', email: 'admin@justiq.local', password_hash: passwordHash, role: UserRole.Admin } }),
  ]);

  const court = await prisma.court.create({
    data: { name: 'JustiQ District Court', location: 'New Delhi', jurisdiction_type: 'Civil and Criminal' },
  });
  const [courtroomOne, courtroomTwo] = await Promise.all([
    prisma.courtroom.create({ data: { court_id: court.id, room_number: 'Courtroom 1', capacity: 80 } }),
    prisma.courtroom.create({ data: { court_id: court.id, room_number: 'Courtroom 2', capacity: 60 } }),
  ]);
  const judge = await prisma.judge.create({
    data: { user_id: judgeUser.id, court_id: court.id, designation: 'District Judge', is_active: true },
  });
  const sampleCase = await prisma.case.create({
    data: {
      case_number: 'JCMS-2026-0001',
      case_type: 'Civil Writ Petition',
      filing_advocate_id: advocate.id,
      status: CaseStatus.Listed,
      priority_score: 40,
      court_id: court.id,
      assigned_judge_id: judge.id,
    },
  });
  await prisma.party.create({
    data: { case_id: sampleCase.id, name: 'Ananya Sharma', role: PartyRole.Petitioner, contact_info: 'ananya.sharma@example.test' },
  });
  await prisma.hearing.create({
    data: {
      case_id: sampleCase.id,
      courtroom_id: courtroomOne.id,
      judge_id: judge.id,
      scheduled_at: new Date('2026-10-15T10:00:00.000Z'),
      status: HearingStatus.Scheduled,
      next_hearing_date: new Date('2026-10-15T10:00:00.000Z'),
    },
  });

  console.log(`Seeded ${court.name}, ${courtroomTwo.room_number}, and case ${sampleCase.case_number}`);
  console.log(`Users: ${[judgeUser, advocate, registrar, admin].map((user) => user.email).join(', ')}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());