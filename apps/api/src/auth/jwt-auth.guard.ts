import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verify, type JwtPayload } from 'jsonwebtoken';
import type { AuthTokenPayload, AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { headers: Record<string, string | undefined> }>();
    const authorization = request.headers.authorization;
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : undefined;

    if (!token) {
      throw new UnauthorizedException('Bearer access token required');
    }

    try {
      const payload = verify(token, process.env.JWT_ACCESS_SECRET ?? 'development-access-secret') as JwtPayload & AuthTokenPayload;
      if (payload.type !== 'access' || !payload.sub || !payload.role) {
        throw new Error('Invalid access token');
      }
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}