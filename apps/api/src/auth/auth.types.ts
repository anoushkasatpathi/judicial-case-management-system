import type { UserRole } from '@prisma/client';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
}

export interface AuthenticatedRequest {
  user: AuthTokenPayload;
}