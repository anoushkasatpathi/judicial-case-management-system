import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { verify, sign, type JwtPayload } from 'jsonwebtoken';
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
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await argon2.verify(user.password_hash, password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  refresh(refreshToken: string): TokenPair {
    const storedUserId = this.refreshTokens.get(refreshToken);
    if (!storedUserId) {
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    try {
      const payload = verify(refreshToken, this.refreshSecret) as JwtPayload & AuthTokenPayload;
      if (payload.type !== 'refresh' || payload.sub !== storedUserId) {
        throw new Error('Invalid refresh token');
      }
      this.refreshTokens.delete(refreshToken);
      return this.issueTokens(payload.sub, payload.email, payload.role);
    } catch {
      this.refreshTokens.delete(refreshToken);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  logout(refreshToken: string): void {
    this.refreshTokens.delete(refreshToken);
  }

  private issueTokens(userId: string, email: string, role: UserRole): TokenPair {
    const basePayload = { sub: userId, email, role };
    const accessToken = sign({ ...basePayload, type: 'access' }, this.accessSecret, { expiresIn: '15m' });
    const refreshToken = sign({ ...basePayload, type: 'refresh' }, this.refreshSecret, { expiresIn: '7d' });
    this.refreshTokens.set(refreshToken, userId);
    return { accessToken, refreshToken };
  }
}