import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { HearingStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';

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
  constructor(private readonly prisma: PrismaService) {}

  async create(body: HearingBody) {
    const scheduledAt = new Date(body.scheduled_at);
    await this.assertNoConflict(body, scheduledAt);
    return this.prisma.hearing.create({
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
    return this.prisma.hearing.update({
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

  private async assertNoConflict(body: Pick<HearingBody, 'case_id' | 'courtroom_id' | 'judge_id'>, scheduledAt: Date, excludeId?: string) {
    const caseExists = await this.prisma.case.findUnique({ where: { id: body.case_id }, select: { id: true } });
    if (!caseExists) throw new NotFoundException('Case not found');
    const start = new Date(scheduledAt.getTime() - SLOT_DURATION_MS + 1);
    const end = new Date(scheduledAt.getTime() + SLOT_DURATION_MS - 1);
    const conflicts = await this.prisma.hearing.findMany({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        status: { not: HearingStatus.Cancelled },
        scheduled_at: { gte: start, lte: end },
        OR: [{ courtroom_id: body.courtroom_id }, { judge_id: body.judge_id }],
      },
    });
    if (conflicts.length > 0) {
      const sameRoom = conflicts.some((item) => item.courtroom_id === body.courtroom_id);
      const sameJudge = conflicts.some((item) => item.judge_id === body.judge_id);
      const resources = [sameRoom ? 'courtroom' : '', sameJudge ? 'judge' : ''].filter(Boolean).join(' and ');
      throw new ConflictException(`Hearing conflicts with an existing ${resources} booking near ${scheduledAt.toISOString()}`);
    }
  }
}