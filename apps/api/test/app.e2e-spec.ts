import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { sign } from 'jsonwebtoken';
import { AppModule } from './../src/app.module.js';

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('logs in with valid credentials', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@justiq.local', password: 'JustiQ-Dev-Password-2026' })
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
  });

  it('rejects a wrong password', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@justiq.local', password: 'wrong-password' })
      .expect(401);
  });

  it('rejects an invalid and expired refresh token', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: 'not-a-jwt' })
      .expect(401);

    const expiredToken = sign(
      { sub: 'expired-user', email: 'admin@justiq.local', role: 'Admin', type: 'refresh' },
      process.env.JWT_REFRESH_SECRET ?? 'development-refresh-secret',
      { expiresIn: -1 },
    );
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: expiredToken })
      .expect(401);
  });

  it('revokes a refresh token on logout', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@justiq.local', password: 'JustiQ-Dev-Password-2026' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });

  it('rejects an authenticated user with the wrong role', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'advocate@justiq.local', password: 'JustiQ-Dev-Password-2026' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/auth/admin-check')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(403);
  });

  afterAll(async () => {
    await app.close();
  });
});
