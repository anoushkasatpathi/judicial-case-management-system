import jwt, { type JwtPayload } from 'jsonwebtoken';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma.service.js';
import type { AuthTokenPayload } from '../auth/auth.types.js';
import type {
  EmergencyAlertEvent,
  HearingScheduledEvent,
  QueueUpdatedEvent,
} from '@justiq/shared-types';

interface JoinCourtPayload {
  courtId: string;
}

interface SocketUser extends AuthTokenPayload {
  sub: string;
}

@Injectable()
@WebSocketGateway({ namespace: '/ws', cors: { origin: true, credentials: true } })
export class CourtGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly prisma: PrismaService) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const user = this.authenticate(socket);
      socket.data.user = user;
      await socket.join(`user:${user.sub}`);
    } catch {
      socket.disconnect(true);
    }
  }

  @SubscribeMessage('court:join')
  async joinCourt(@ConnectedSocket() socket: Socket, @MessageBody() payload: JoinCourtPayload) {
    const user = socket.data.user as SocketUser | undefined;
    if (!user || !payload?.courtId || !(await this.canJoinCourt(user, payload.courtId))) {
      throw new ForbiddenException('User is not permitted to join this court room');
    }
    await socket.join(this.courtRoom(payload.courtId));
    socket.emit('court:joined', { courtId: payload.courtId });
    return { event: 'court:joined', data: { courtId: payload.courtId } };
  }

  emitQueueUpdated(payload: QueueUpdatedEvent): void {
    this.server.to(this.courtRoom(payload.courtId)).emit('queue:updated', payload);
  }

  emitHearingScheduled(payload: HearingScheduledEvent, courtId: string): void {
    this.server.to(this.courtRoom(courtId)).emit('hearing:scheduled', payload);
  }

  emitEmergencyAlert(payload: EmergencyAlertEvent, judgeUserId: string): void {
    this.server.to(`user:${judgeUserId}`).emit('emergency:alert', payload);
  }

  private authenticate(socket: Socket): SocketUser {
    const token = this.extractToken(socket.handshake.auth?.token ?? socket.handshake.headers.authorization);
    if (!token) throw new UnauthorizedException('JWT required for Socket.IO connection');
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET ?? 'development-access-secret') as JwtPayload & SocketUser;
    if (payload.type !== 'access' || !payload.sub || !payload.role) throw new UnauthorizedException('Invalid Socket.IO JWT');
    return payload;
  }

  private extractToken(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    return value.startsWith('Bearer ') ? value.slice(7) : value;
  }

  private async canJoinCourt(user: SocketUser, courtId: string): Promise<boolean> {
    if (user.role === 'Admin' || user.role === 'Registrar' || user.role === 'Public') return true;
    if (user.role === 'Judge') {
      return Boolean(await this.prisma.judge.findFirst({ where: { user_id: user.sub, court_id: courtId, is_active: true }, select: { id: true } }));
    }
    return Boolean(await this.prisma.case.findFirst({ where: { court_id: courtId, filing_advocate_id: user.sub }, select: { id: true } }));
  }

  private courtRoom(courtId: string): string {
    return `court:${courtId}`;
  }
}