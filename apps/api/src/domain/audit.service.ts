import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';

export interface AuditVerificationResult {
  valid: boolean;
  entries: number;
  error?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async append(
    entityId: string,
    action: string,
    beforeState: Prisma.InputJsonValue,
    afterState: Prisma.InputJsonValue,
    actorId: string,
    reason: string,
    entityType = 'Case',
  ) {
    const previous = await this.prisma.auditLog.findFirst({
      where: { entity_id: entityId },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    });
    const prevHash = previous?.hash ?? '';
    const hash = this.hash(entityId, action, afterState, prevHash);
    return this.prisma.auditLog.create({
      data: {
        entity_type: entityType,
        entity_id: entityId,
        action,
        actor_id: actorId,
        before_state: beforeState,
        after_state: afterState,
        reason,
        prev_hash: prevHash,
        hash,
      },
    });
  }

  async verify(entityId: string): Promise<AuditVerificationResult> {
    const entries = await this.prisma.auditLog.findMany({
      where: { entity_id: entityId },
      orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    });
    let previousHash = '';
    for (const [index, entry] of entries.entries()) {
      const expectedHash = this.hash(entry.entity_id, entry.action, entry.after_state, previousHash);
      if (entry.prev_hash !== previousHash || entry.hash !== expectedHash) {
        return { valid: false, entries: entries.length, error: `Audit entry ${index + 1} failed verification` };
      }
      previousHash = entry.hash;
    }
    return { valid: true, entries: entries.length };
  }

  private hash(entityId: string, action: string, afterState: unknown, prevHash: string): string {
    return createHash('sha256')
      .update(`${entityId}|${action}|${JSON.stringify(afterState)}|${prevHash}`)
      .digest('hex');
  }
}