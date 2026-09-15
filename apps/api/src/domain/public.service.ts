import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async causeList(courtId?: string, date = new Date().toISOString().slice(0, 10)) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const hearings = await this.prisma.hearing.findMany({
      where: {
        scheduled_at: { gte: start, lt: end },
        status: { not: 'Cancelled' },
        ...(courtId ? { case: { court_id: courtId } } : {}),
      },
      orderBy: { scheduled_at: 'asc' },
      select: {
        id: true,
        scheduled_at: true,
        status: true,
        courtroom: { select: { room_number: true } },
        judge: { select: { designation: true } },
        case: {
          select: {
            case_number: true,
            case_type: true,
            status: true,
            parties: { select: { name: true, role: true } },
          },
        },
      },
    });
    return hearings.map((hearing) => ({
      hearingId: hearing.id,
      scheduledAt: hearing.scheduled_at,
      hearingStatus: hearing.status,
      courtroom: hearing.courtroom.room_number,
      judgeDesignation: hearing.judge.designation,
      case: hearing.case,
    }));
  }

  async caseStatus(caseNumber: string) {
    const matches = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT c.id
      FROM "Case" c
      LEFT JOIN "Party" p ON p.case_id = c.id
      WHERE c.case_number = ${caseNumber}
         OR to_tsvector('simple', concat_ws(' ', c.case_number, p.name))
            @@ plainto_tsquery('simple', ${caseNumber})
      GROUP BY c.id, c.case_number
      ORDER BY (c.case_number = ${caseNumber}) DESC
      LIMIT 1
    `);
    if (matches.length === 0) throw new NotFoundException('Case not found');
    const item = await this.prisma.case.findUnique({
      where: { id: matches[0].id },
      select: {
        case_number: true,
        case_type: true,
        status: true,
        filed_at: true,
        court: { select: { name: true, location: true } },
        parties: { select: { name: true, role: true } },
        hearings: {
          where: { status: { not: 'Cancelled' } },
          orderBy: { scheduled_at: 'asc' },
          select: {
            scheduled_at: true,
            status: true,
            next_hearing_date: true,
            courtroom: { select: { room_number: true } },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Case not found');
    return item;
  }
}