import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CaseStatus, Prisma, UserRole } from '@prisma/client';
import { AuditService, type AuditVerificationResult } from './audit.service.js';
import { PrismaService } from '../prisma.service.js';
import { PriorityService } from './priority.service.js';

export interface CreateCaseBody {
  case_number: string;
  case_type: string;
  filing_advocate_id?: string;
  court_id: string;
  assigned_judge_id?: string;
  parties?: Array<{ name: string; role: 'Petitioner' | 'Respondent'; contact_info: string }>;
  priority_factors?: Array<{ factor_type: 'Age' | 'StatutoryUrgency' | 'EmergencyFlag' | 'VulnerabilityFlag'; weight: number; computed_score: number }>;
}

const validTransitions: Record<CaseStatus, CaseStatus[]> = {
  Filed: [CaseStatus.Verification],
  Verification: [CaseStatus.Listed, CaseStatus.Returned],
  Returned: [CaseStatus.Verification],
  Listed: [CaseStatus.Heard],
  Heard: [CaseStatus.Disposed],
  Disposed: [],
};

@Injectable()
export class CaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly priority: PriorityService,
  ) {}

  async create(body: CreateCaseBody, actor: { id: string; role: UserRole }) {
    const filingAdvocateId = body.filing_advocate_id ?? (actor.role === UserRole.Advocate ? actor.id : undefined);
    if (!filingAdvocateId) throw new BadRequestException('filing_advocate_id is required unless the caller is an Advocate');
    const advocate = await this.prisma.user.findUnique({ where: { id: filingAdvocateId }, select: { id: true, role: true } });
    if (!advocate || advocate.role !== UserRole.Advocate) {
      throw new BadRequestException('filing_advocate_id must identify an Advocate');
    }
    try {
      const created = await this.prisma.case.create({
        data: {
          case_number: body.case_number,
          case_type: body.case_type,
          filing_advocate_id: filingAdvocateId,
          court_id: body.court_id,
          status: CaseStatus.Filed,
          assigned_judge_id: body.assigned_judge_id,
          parties: body.parties ? { create: body.parties } : undefined,
          priority_factors: body.priority_factors ? { create: body.priority_factors } : undefined,
        },
        include: { parties: true, priority_factors: true },
      });
      return this.priority.recomputeCase(created.id, actor.id, 'Initial priority calculation');
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('case_number already exists');
      }
      throw error;
    }
  }

  findOne(id: string) {
    return this.prisma.case.findUnique({
      where: { id },
      include: { parties: true, hearings: true, documents: true, priority_factors: true, court: true, assigned_judge: true },
    }).then((item) => {
      if (!item) throw new NotFoundException('Case not found');
      return item;
    });
  }

  async findMany(query: { status?: CaseStatus; court?: string; q?: string; page?: number; limit?: number }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.CaseWhereInput = {
      status: query.status,
      court_id: query.court,
      ...(query.q ? { OR: [{ case_number: { contains: query.q, mode: 'insensitive' } }, { case_type: { contains: query.q, mode: 'insensitive' } }] } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.case.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: [{ priority_score: 'desc' }, { filed_at: 'asc' }, { id: 'asc' }] }),
      this.prisma.case.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async changeStatus(id: string, status: CaseStatus, actorId: string) {
    const current = await this.prisma.case.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Case not found');
    if (!validTransitions[current.status].includes(status)) {
      throw new BadRequestException(`Invalid case status transition: ${current.status} -> ${status}`);
    }
    const updated = await this.prisma.case.update({ where: { id }, data: { status } });
    await this.audit.append(id, 'STATUS_CHANGED', { status: current.status }, { status: updated.status }, actorId, `Status changed from ${current.status} to ${status}`);
    return updated;
  }

  async flagEmergency(id: string, actorId: string, reason = 'Emergency flag applied') {
    const current = await this.prisma.case.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Case not found');
    if (current.is_emergency) throw new ConflictException('Case is already emergency flagged');
    await this.prisma.case.update({ where: { id }, data: { is_emergency: true } });
    await this.audit.append(id, 'EMERGENCY_FLAGGED', { is_emergency: false }, { is_emergency: true }, actorId, reason);
    return this.priority.recomputeCase(id, actorId, reason);
  }

  auditTrail(id: string) {
    return this.findOne(id).then(() => this.prisma.auditLog.findMany({ where: { entity_id: id }, orderBy: [{ created_at: 'asc' }, { id: 'asc' }] }));
  }

  async verifyAuditTrail(id: string): Promise<AuditVerificationResult> {
    await this.findOne(id);
    return this.audit.verify(id);
  }
}