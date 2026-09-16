import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createHash } from 'node:crypto';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma.service.js';

describe('Document vault and public portal (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let advocateToken: string;
  let caseId: string;
  let courtId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    const [login, sampleCase, court] = await Promise.all([
      request(app.getHttpServer()).post('/api/auth/login').send({ email: 'advocate@justiq.local', password: 'JustiQ-Dev-Password-2026' }),
      prisma.case.findUniqueOrThrow({ where: { case_number: 'JCMS-2026-0001' } }),
      prisma.court.findFirstOrThrow(),
    ]);
    advocateToken = login.body.accessToken;
    caseId = sampleCase.id;
    courtId = court.id;
  });

  it('uploads, versions, downloads, and checksum-verifies a document', async () => {
    const content = Buffer.from('JCMS document vault round trip');
    const filename = `round-trip-${Date.now()}.txt`;
    const first = await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/documents`)
      .set('Authorization', `Bearer ${advocateToken}`)
      .field('doc_type', 'Evidence')
      .attach('file', content, filename)
      .expect(201);
    expect(first.body.version).toBe(1);
    expect(first.body.checksum).toBe(createHash('sha256').update(content).digest('hex'));

    const second = await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/documents`)
      .set('Authorization', `Bearer ${advocateToken}`)
      .field('doc_type', 'Evidence')
      .attach('file', Buffer.from('version two'), filename)
      .expect(201);
    expect(second.body.version).toBe(2);

    const download = await request(app.getHttpServer())
      .get(`/api/documents/${first.body.id}/download`)
      .set('Authorization', `Bearer ${advocateToken}`)
      .expect(200);
    const downloaded = Buffer.from(await (await fetch(download.body.downloadUrl)).arrayBuffer());
    expect(downloaded.equals(content)).toBe(true);
    expect(createHash('sha256').update(downloaded).digest('hex')).toBe(download.body.checksum);
  });

  it('rejects an unsupported MIME type and an oversized upload', async () => {
    await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/documents`)
      .set('Authorization', `Bearer ${advocateToken}`)
      .field('doc_type', 'Evidence')
      .attach('file', Buffer.from('not allowed'), 'malware.exe')
      .expect(400);

    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 'x');
    const response = await request(app.getHttpServer())
      .post(`/api/cases/${caseId}/documents`)
      .set('Authorization', `Bearer ${advocateToken}`)
      .field('doc_type', 'Evidence')
      .attach('file', oversized, 'too-large.txt');
    expect([400, 413]).toContain(response.status);
  });

  it('keeps public cause-list and case-status responses free of sensitive fields', async () => {
    const causeList = await request(app.getHttpServer())
      .get(`/api/public/cause-list?court=${courtId}&date=2026-10-15`)
      .expect(200);
    expect(causeList.body.length).toBeGreaterThan(0);
    const causeJson = JSON.stringify(causeList.body);
    expect(causeJson).not.toContain('contact_info');
    expect(causeJson).not.toContain('order_summary');
    expect(causeJson).not.toContain('priority_score');

    const byCaseNumber = await request(app.getHttpServer())
      .get('/api/public/case-status?caseNumber=JCMS-2026-0001')
      .expect(200);
    expect(byCaseNumber.body.case_number).toBe('JCMS-2026-0001');
    expect(JSON.stringify(byCaseNumber.body)).not.toContain('contact_info');
    expect(JSON.stringify(byCaseNumber.body)).not.toContain('password_hash');

    const byPartyName = await request(app.getHttpServer())
      .get('/api/public/case-status?caseNumber=Ananya%20Sharma')
      .expect(200);
    expect(byPartyName.body.case_number).toBe('JCMS-2026-0001');
  });

  afterAll(async () => {
    await app.close();
  });
});