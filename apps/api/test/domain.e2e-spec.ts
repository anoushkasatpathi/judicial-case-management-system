import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma.service.js';
import { CaseService } from './../src/domain/case.service.js';

describe('Case lifecycle, audit, priority, and hearings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let adminToken: string;
  let courtId: string;
  let courtroomId: string;
  let judgeId: string;
  let advocateId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    const [court, courtroom, judge, advocate] = await Promise.all([
      prisma.court.findFirstOrThrow(),
      prisma.courtroom.findFirstOrThrow(),
      prisma.judge.findFirstOrThrow(),
      prisma.user.findUniqueOrThrow({ where: { email: 'advocate@justiq.local' } }),
    ]);
    courtId = court.id;
    courtroomId = courtroom.id;
    judgeId = judge.id;
    advocateId = advocate.id;
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@justiq.local', password: 'JustiQ-Dev-Password-2026' })
      .expect(201);
    adminToken = login.body.accessToken;
  });

  it('enforces the case state machine and writes a verifiable audit chain', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/cases')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        case_number: `E2E-${Date.now()}`,
        case_type: 'Civil Writ Petition',
        filing_advocate_id: advocateId,
        court_id: courtId,
        parties: [{ name: 'Test Petitioner', role: 'Petitioner', contact_info: 'test@example.test' }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/cases/${created.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Heard' })
      .expect(400)
      .expect(({ body }) => expect(body.message).toContain('Invalid case status transition: Filed -> Heard'));

    await request(app.getHttpServer())
      .patch(`/api/cases/${created.body.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'Verification' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/cases/${created.body.id}/emergency-flag`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Test emergency' })
      .expect(201);

    const trail = await request(app.getHttpServer())
      .get(`/api/cases/${created.body.id}/audit-trail`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(trail.body.length).toBeGreaterThanOrEqual(3);
    expect(trail.body.every((entry: { hash: string; prev_hash: string }) => entry.hash && entry.prev_hash !== undefined)).toBe(true);
    await request(app.getHttpServer())
      .get(`/api/cases/${created.body.id}/audit-trail/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect(({ body }) => expect(body.valid).toBe(true));

    const lastEntry = trail.body.at(-1);
    await prisma.auditLog.update({ where: { id: lastEntry.id }, data: { after_state: { tampered: true } } });
    const result = await app.get(CaseService).verifyAuditTrail(created.body.id);
    expect(result.valid).toBe(false);
  });

  it('rejects overlapping courtroom and judge hearing bookings', async () => {
    const sampleCase = await prisma.case.findFirstOrThrow();
    const scheduledAt = '2026-10-15T10:30:00.000Z';
    await request(app.getHttpServer())
      .post('/api/hearings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ case_id: sampleCase.id, courtroom_id: courtroomId, judge_id: judgeId, scheduled_at: scheduledAt })
      .expect(409)
      .expect(({ body }) => expect(body.message).toContain('courtroom and judge'));
  });

  afterAll(async () => {
    await app.close();
  });
});