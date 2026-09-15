import { Injectable, NotFoundException } from '@nestjs/common';
import { PriorityFactorType, Prisma } from '@prisma/client';
import { AuditService } from './audit.service.js';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from './redis.service.js';

export interface ScoringCase {
  filedAt: Date;
  isEmergency: boolean;
  factors: Array<{ factor_type: PriorityFactorType; weight: number; computed_score: number }>;
}

export function calculatePriorityScore(input: ScoringCase): number {
  const factors = new Map(input.factors.map((factor) => [factor.factor_type, factor]));
  const ageFactor = factors.get(PriorityFactorType.Age);
  const statutoryFactor = factors.get(PriorityFactorType.StatutoryUrgency);
  const vulnerabilityFactor = factors.get(PriorityFactorType.VulnerabilityFlag);
  const emergencyFactor = factors.get(PriorityFactorType.EmergencyFlag);
  const ageDays = Math.min(365, Math.max(0, Math.floor((Date.now() - input.filedAt.getTime()) / 86_400_000)));

  return Math.round(
    ageDays * (ageFactor?.weight ?? 1) +
      (statutoryFactor?.computed_score ?? 0) * (statutoryFactor?.weight ?? 1) +
      (input.isEmergency ? 100 : 0) * (emergencyFactor?.weight ?? 1) +
      (vulnerabilityFactor?.computed_score ?? 0) * (vulnerabilityFactor?.weight ?? 1),
  );
}

// Ties favor older filings, then UUID order, so queue results stay deterministic.
export function comparePriorityQueueItems(
  a: { priority_score: number; filed_at: Date; id: string },
  b: { priority_score: number; filed_at: Date; id: string },
): number {
  return b.priority_score - a.priority_score || a.filed_at.getTime() - b.filed_at.getTime() || a.id.localeCompare(b.id);
}

@Injectable()
export class PriorityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly redis: RedisService,
  ) {}

  async recomputeCase(caseId: string, actorId: string, reason = 'Priority score recomputed') {
    const existing = await this.prisma.case.findUnique({ where: { id: caseId }, include: { priority_factors: true } });
    if (!existing) throw new NotFoundException('Case not found');
    const factorData = this.buildFactors(existing);
    const score = calculatePriorityScore({ filedAt: existing.filed_at, isEmergency: existing.is_emergency, factors: factorData });
    const updated = await this.prisma.$transaction(async (transaction) => {
      await transaction.priorityFactor.deleteMany({ where: { case_id: caseId } });
      await transaction.priorityFactor.createMany({
        data: factorData.map((factor) => ({ ...factor, case_id: caseId })),
      });
      return transaction.case.update({ where: { id: caseId }, data: { priority_score: score } });
    });
    if (score !== existing.priority_score) {
      await this.audit.append(
        caseId,
        'PRIORITY_SCORE_CHANGED',
        { priority_score: existing.priority_score },
        { priority_score: score },
        actorId,
        reason,
      );
    }
    await this.syncCourtQueue(existing.court_id);
    return updated;
  }

  async recomputeAll(courtId: string | undefined, actorId: string) {
    const cases = await this.prisma.case.findMany({
      where: courtId ? { court_id: courtId } : undefined,
      select: { id: true },
    });
    for (const item of cases) await this.recomputeCase(item.id, actorId, 'Priority queue recomputed');
    if (courtId) await this.syncCourtQueue(courtId);
    return { recalculated: cases.length };
  }

  async getQueue(courtId: string) {
    const cases = await this.prisma.case.findMany({ where: { court_id: courtId } });
    const queueIds = await this.redis.readQueue(this.queueKey(courtId));
    if (!queueIds || queueIds.length === 0) {
      await this.syncCourtQueue(courtId);
      return this.sortCases(cases);
    }
    const byId = new Map(cases.map((item) => [item.id, item]));
    const ordered = queueIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
    ordered.sort(comparePriorityQueueItems);
    const queued = new Set(ordered.map((item) => item.id));
    return [...ordered, ...this.sortCases(cases.filter((item) => !queued.has(item.id)))];
  }

  async reorder(courtId: string, caseIds: string[], actorId: string, reason: string) {
    const cases = await this.prisma.case.findMany({ where: { court_id: courtId, id: { in: caseIds } } });
    if (cases.length !== caseIds.length) throw new NotFoundException('One or more cases do not belong to this court');
    const maxScore = Math.max(0, ...cases.map((item) => item.priority_score)) + caseIds.length;
    const byId = new Map(cases.map((item) => [item.id, item]));
    for (const [index, caseId] of caseIds.entries()) {
      const item = byId.get(caseId);
      const score = maxScore - index;
      if (item && item.priority_score !== score) {
        await this.prisma.case.update({ where: { id: caseId }, data: { priority_score: score } });
        await this.audit.append(caseId, 'PRIORITY_SCORE_CHANGED', { priority_score: item.priority_score }, { priority_score: score }, actorId, reason);
      }
    }
    await this.syncCourtQueue(courtId);
    await this.audit.append(courtId, 'QUEUE_REORDERED', { case_ids: cases.map((item) => item.id) }, { case_ids: caseIds }, actorId, reason, 'Court');
    return this.getQueue(courtId);
  }

  private async syncCourtQueue(courtId: string) {
    const cases = await this.prisma.case.findMany({ where: { court_id: courtId }, orderBy: [{ priority_score: 'desc' }, { filed_at: 'asc' }, { id: 'asc' }] });
    // Redis stores the score; equal scores are resolved by filed_at, then UUID for deterministic ordering.
    await this.redis.replaceQueue(this.queueKey(courtId), cases.map((item) => ({ value: item.id, score: item.priority_score })));
  }

  private buildFactors(item: Prisma.CaseGetPayload<{ include: { priority_factors: true } }>) {
    const existing = new Map(item.priority_factors.map((factor) => [factor.factor_type, factor]));
    return Object.values(PriorityFactorType).map((factorType) => {
      const factor = existing.get(factorType);
      return {
        factor_type: factorType,
        weight: factor?.weight ?? 1,
        computed_score: factorType === PriorityFactorType.Age
          ? Math.min(365, Math.max(0, Math.floor((Date.now() - item.filed_at.getTime()) / 86_400_000)))
          : factorType === PriorityFactorType.EmergencyFlag
            ? item.is_emergency ? 100 : 0
            : factor?.computed_score ?? 0,
      };
    });
  }

  private sortCases<T extends { priority_score: number; filed_at: Date; id: string }>(items: T[]): T[] {
    return [...items].sort(comparePriorityQueueItems);
  }

  private queueKey(courtId: string): string {
    return `queue:court:${courtId}`;
  }
}