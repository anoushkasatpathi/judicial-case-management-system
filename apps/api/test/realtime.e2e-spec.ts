import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { io, type Socket } from 'socket.io-client';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma.service.js';

describe('Realtime gateway (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let socket: Socket;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.listen(0);
    prisma = app.get(PrismaService);
  });

  it('authenticates, joins a court room, and receives queue:updated on reorder', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@justiq.local', password: 'JustiQ-Dev-Password-2026' })
      .expect(201);
    const court = await prisma.court.findFirstOrThrow({ include: { cases: true } });
    const caseIds = court.cases.map((item) => item.id);
    expect(caseIds.length).toBeGreaterThan(0);
    const address = app.getHttpServer().address() as { port: number };
    socket = io(`http://127.0.0.1:${address.port}/ws`, {
      auth: { token: login.body.accessToken },
      transports: ['websocket'],
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => {
        socket.once('court:joined', (response: { courtId: string }) => {
          if (response?.courtId === court.id) resolve();
          else reject(new Error('Court room join was rejected'));
        });
        socket.emit('court:join', { courtId: court.id });
      });
      socket.once('connect_error', reject);
      setTimeout(() => reject(new Error('Socket connection timed out')), 4000);
    });

    const event = new Promise<Record<string, unknown>>((resolve) => socket.once('queue:updated', resolve));
    await request(app.getHttpServer())
      .post(`/api/courts/${court.id}/queue/reorder`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ caseIds: [...caseIds].reverse(), reason: 'Realtime integration test' })
      .expect(201);
    const payload = await event;
    expect(payload.courtId).toBe(court.id);
    expect(payload.updatedAt).toEqual(expect.any(String));
    expect(payload.caseIds).toEqual(expect.arrayContaining([...caseIds].reverse()));
    expect(new Set(payload.caseIds as string[]).size).toBe((payload.caseIds as string[]).length);
  });

  afterAll(async () => {
    socket?.disconnect();
    await app.close();
  });
});