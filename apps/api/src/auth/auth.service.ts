import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma.service.js';
import type { AuthTokenPayload } from './auth.types.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly refreshTokens = new Map<string, string>();
  private readonly accessSecret = process.env.JWT_ACCESS_SECRET ?? 'development-access-secret';
  private readonly refreshSecret = process.env.JWT_REFRESH_SECRET ?? 'development-refresh-secret';

  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email }, include: { judge: true } });
    if (!user || !(await argon2.verify(user.password_hash, password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const courtId = user.judge?.court_id ?? (user.role === UserRole.Admin || user.role === UserRole.Registrar
      ? (await this.prisma.court.findFirst({ orderBy: { name: 'asc' }, select: { id: true } }))?.id
      : undefined);
    return this.issueTokens(user.id, user.email, user.role, courtId);
  }

  refresh(refreshToken: string): TokenPair {
    const storedUserId = this.refreshTokens.get(refreshToken);
    if (!storedUserId) {
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    try {
      const payload = jwt.verify(refreshToken, this.refreshSecret) as JwtPayload & AuthTokenPayload;
      if (payload.type !== 'refresh' || payload.sub !== storedUserId) {
        throw new Error('Invalid refresh token');
      }
      this.refreshTokens.delete(refreshToken);
      return this.issueTokens(payload.sub, payload.email, payload.role, payload.courtId);
    } catch {
      this.refreshTokens.delete(refreshToken);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  logout(refreshToken: string): void {
    this.refreshTokens.delete(refreshToken);
  }

  private issueTokens(userId: string, email: string, role: UserRole, courtId?: string): TokenPair {
    const basePayload = { sub: userId, email, role, courtId };
    const accessToken = jwt.sign({ ...basePayload, type: 'access' }, this.accessSecret, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ ...basePayload, type: 'refresh' }, this.refreshSecret, { expiresIn: '7d' });
    this.refreshTokens.set(refreshToken, userId);
    return { accessToken, refreshToken };
  }
}