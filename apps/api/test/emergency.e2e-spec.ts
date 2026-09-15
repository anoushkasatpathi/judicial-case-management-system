import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma.service.js';

describe('Emergency petition override workflow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let courtId: string;
  let judgeId: string;
  let advocateId: string;

  async function token(email: string) {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'JustiQ-Dev-Password-2026' })
      .expect(201);
    return response.body.accessToken as string;
  }

  async function createCase(accessToken: string) {
    const response = await request(app.getHttpServer())
      .post('/api/cases')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        case_number: `EMERGENCY-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        case_type: 'Emergency Writ Petition',
        filing_advocate_id: advocateId,
        court_id: courtId,
        assigned_judge_id: judgeId,
        parties: [{ name: 'Emergency Petitioner', role: 'Petitioner', contact_info: 'emergency@example.test' }],
      })
      .expect(201);
    return response.body.id as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    const court = await prisma.court.findFirstOrThrow();
    const judge = await prisma.judge.findFirstOrThrow();
    const advocate = await prisma.user.findUniqueOrThrow({ where: { email: 'advocate@justiq.local' } });
    courtId = court.id;
    judgeId = judge.id;
    advocateId = advocate.id;
  });

  it('completes Filed(Emergency) -> Triage -> Acceptance -> Slot Injection -> Fan-out', async () => {
    const advocateToken = await token('advocate@justiq.local');
    const registrarToken = await token('registrar@justiq.local');
    const judgeToken = await token('judge@justiq.local');
    const caseId = await createCase(advocateToken);

    await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/emergency-flag`)
      .set('Authorization', `Bearer ${advocateToken}`)
      .send({ reason: 'Immediate irreparable harm' })
      .expect(201)
      .expect(({ body }) => expect(body.emergency_status).toBe('FiledEmergency'));
    await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/emergency/triage`)
      .set('Authorization', `Bearer ${registrarToken}`)
      .send({ reason: 'Registrar reviewed petition' })
      .expect(201)
      .expect(({ body }) => expect(body.emergency_status).toBe('RegistrarTriage'));
    await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/emergency/accept`)
      .set('Authorization', `Bearer ${judgeToken}`)
      .send({ reason: 'Bench accepted emergency listing' })
      .expect(201)
      .expect(({ body }) => expect(body.emergency_status).toBe('JudgeAcceptance'));

    const injection = await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/emergency/inject-slot`)
      .set('Authorization', `Bearer ${registrarToken}`)
      .send({ reason: 'Emergency slot injected' })
      .expect(201);
    expect(injection.body.case.emergency_status).toBe('SlotInjection');
    expect(injection.body.hearing.case_id).toBe(caseId);

    const notification = await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/emergency/notify`)
      .set('Authorization', `Bearer ${registrarToken}`)
      .send({ reason: 'Emergency parties notified' })
      .expect(201);
    expect(notification.body.case.emergency_status).toBe('NotificationFanout');
    expect(notification.body.recipientCount).toBe(3);

    const queue = await request(app.getHttpServer())
      .get(`/api/courts/${courtId}/queue`)
      .set('Authorization', `Bearer ${judgeToken}`)
      .expect(200);
    expect(queue.body[0].id).toBe(caseId);
    expect(await prisma.notification.count({ where: { case_id: caseId } })).toBe(3);
    expect(await prisma.auditLog.count({ where: { entity_id: caseId } })).toBeGreaterThanOrEqual(5);
  });

  it('rejects a Registrar trying to skip directly to slot injection', async () => {
    const advocateToken = await token('advocate@justiq.local');
    const registrarToken = await token('registrar@justiq.local');
    const caseId = await createCase(advocateToken);
    await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/emergency-flag`)
      .set('Authorization', `Bearer ${advocateToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/emergency/inject-slot`)
      .set('Authorization', `Bearer ${registrarToken}`)
      .expect(409)
      .expect(({ body }) => expect(body.message).toContain('Invalid emergency transition: FiledEmergency -> SlotInjection'));
  });

  it('rejects non-registrars from triage and non-judges from acceptance', async () => {
    const advocateToken = await token('advocate@justiq.local');
    const registrarToken = await token('registrar@justiq.local');
    const caseId = await createCase(advocateToken);
    await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/emergency-flag`)
      .set('Authorization', `Bearer ${advocateToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/emergency/triage`)
      .set('Authorization', `Bearer ${advocateToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/emergency/accept`)
      .set('Authorization', `Bearer ${registrarToken}`)
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});