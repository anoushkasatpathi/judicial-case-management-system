import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { HearingStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';
import { CourtGateway } from '../realtime/court.gateway.js';
import type { HearingScheduledEvent } from '@justiq/shared-types';

const SLOT_DURATION_MS = 60 * 60 * 1000;

export interface HearingBody {
  case_id: string;
  courtroom_id: string;
  judge_id: string;
  scheduled_at: string;
  status?: HearingStatus;
  order_summary?: string;
  next_hearing_date?: string;
}

@Injectable()
export class HearingService {
  constructor(private readonly prisma: PrismaService, private readonly gateway: CourtGateway) {}

  async create(body: HearingBody) {
    const scheduledAt = new Date(body.scheduled_at);
    await this.assertNoConflict(body, scheduledAt);
    const hearing = await this.prisma.hearing.create({
      data: {
        case_id: body.case_id,
        courtroom_id: body.courtroom_id,
        judge_id: body.judge_id,
        scheduled_at: scheduledAt,
        status: body.status ?? HearingStatus.Scheduled,
        order_summary: body.order_summary,
        next_hearing_date: body.next_hearing_date ? new Date(body.next_hearing_date) : undefined,
      },
    });
    await this.emitScheduled(hearing.id);
    return hearing;
  }

  async update(id: string, body: Partial<HearingBody>) {
    const existing = await this.prisma.hearing.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Hearing not found');
    const candidate = {
      case_id: body.case_id ?? existing.case_id,
      courtroom_id: body.courtroom_id ?? existing.courtroom_id,
      judge_id: body.judge_id ?? existing.judge_id,
      scheduled_at: body.scheduled_at ?? existing.scheduled_at.toISOString(),
    };
    await this.assertNoConflict(candidate, new Date(candidate.scheduled_at), id);
    const hearing = await this.prisma.hearing.update({
      where: { id },
      data: {
        case_id: body.case_id,
        courtroom_id: body.courtroom_id,
        judge_id: body.judge_id,
        scheduled_at: body.scheduled_at ? new Date(body.scheduled_at) : undefined,
        status: body.status,
        order_summary: body.order_summary,
        next_hearing_date: body.next_hearing_date ? new Date(body.next_hearing_date) : undefined,
      },
    });
    await this.emitScheduled(hearing.id);
    return hearing;
  }

  async availability(id: string, from?: string, to?: string) {
    const courtroom = await this.prisma.courtroom.findUnique({ where: { id } });
    if (!courtroom) throw new NotFoundException('Courtroom not found');
    const start = from ? new Date(from) : new Date();
    const end = to ? new Date(to) : new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const hearings = await this.prisma.hearing.findMany({
      where: { courtroom_id: id, scheduled_at: { gte: start, lt: end }, status: { not: HearingStatus.Cancelled } },
      orderBy: { scheduled_at: 'asc' },
    });
    return { courtroom, from: start.toISOString(), to: end.toISOString(), available: hearings.length === 0, hearings };
  }

  async createEmergencySlot(caseId: string) {
    const caseItem = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!caseItem) throw new NotFoundException('Case not found');
    const judgeId = caseItem.assigned_judge_id ?? (await this.prisma.judge.findFirst({ where: { court_id: caseItem.court_id, is_active: true }, orderBy: { id: 'asc' } }))?.id;
    if (!judgeId) throw new NotFoundException('No active judge is available for this court');
    const courtrooms = await this.prisma.courtroom.findMany({ where: { court_id: caseItem.court_id }, orderBy: { room_number: 'asc' } });
    if (courtrooms.length === 0) throw new NotFoundException('No courtroom is available for this court');

    const now = new Date();
    const firstSlot = new Date(now);
    firstSlot.setMinutes(0, 0, 0);
    if (firstSlot <= now) firstSlot.setHours(firstSlot.getHours() + 1);
    for (let slotIndex = 0; slotIndex < 24 * 30; slotIndex += 1) {
      const scheduledAt = new Date(firstSlot.getTime() + slotIndex * SLOT_DURATION_MS);
      for (const courtroom of courtrooms) {
        const conflicts = await this.findConflicts({ case_id: caseId, courtroom_id: courtroom.id, judge_id: judgeId }, scheduledAt);
        if (conflicts.length === 0) {
          if (!caseItem.assigned_judge_id) {
            await this.prisma.case.update({ where: { id: caseId }, data: { assigned_judge_id: judgeId } });
          }
          const hearing = await this.prisma.hearing.create({
            data: {
              case_id: caseId,
              courtroom_id: courtroom.id,
              judge_id: judgeId,
              scheduled_at: scheduledAt,
              status: HearingStatus.Scheduled,
              order_summary: 'Emergency petition slot injection',
              next_hearing_date: scheduledAt,
            },
          });
          await this.emitScheduled(hearing.id);
          return hearing;
        }
      }
    }
    throw new ConflictException('No non-conflicting courtroom slot is available within the next 30 days');
  }

  private async assertNoConflict(body: Pick<HearingBody, 'case_id' | 'courtroom_id' | 'judge_id'>, scheduledAt: Date, excludeId?: string) {
    const caseExists = await this.prisma.case.findUnique({ where: { id: body.case_id }, select: { id: true } });
    if (!caseExists) throw new NotFoundException('Case not found');
    const conflicts = await this.findConflicts(body, scheduledAt, excludeId);
    if (conflicts.length > 0) {
      const sameRoom = conflicts.some((item) => item.courtroom_id === body.courtroom_id);
      const sameJudge = conflicts.some((item) => item.judge_id === body.judge_id);
      const resources = [sameRoom ? 'courtroom' : '', sameJudge ? 'judge' : ''].filter(Boolean).join(' and ');
      throw new ConflictException(`Hearing conflicts with an existing ${resources} booking near ${scheduledAt.toISOString()}`);
    }
  }

  private findConflicts(body: Pick<HearingBody, 'case_id' | 'courtroom_id' | 'judge_id'>, scheduledAt: Date, excludeId?: string) {
    const start = new Date(scheduledAt.getTime() - SLOT_DURATION_MS + 1);
    const end = new Date(scheduledAt.getTime() + SLOT_DURATION_MS - 1);
    return this.prisma.hearing.findMany({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        status: { not: HearingStatus.Cancelled },
        scheduled_at: { gte: start, lte: end },
        OR: [{ courtroom_id: body.courtroom_id }, { judge_id: body.judge_id }],
      },
    });
  }

  private async emitScheduled(hearingId: string): Promise<void> {
    const hearing = await this.prisma.hearing.findUniqueOrThrow({
      where: { id: hearingId },
      include: { case: { select: { court_id: true } } },
    });
    const payload: HearingScheduledEvent = {
      hearingId: hearing.id,
      caseId: hearing.case_id,
      courtroomId: hearing.courtroom_id,
      judgeId: hearing.judge_id,
      scheduledAt: hearing.scheduled_at.toISOString(),
    };
    this.gateway.emitHearingScheduled(payload, hearing.case.court_id);
  }
}