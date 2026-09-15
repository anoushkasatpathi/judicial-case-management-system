import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CaseStatus, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { CaseService, type CreateCaseBody } from './case.service.js';

@Controller('api/cases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CaseController {
  constructor(private readonly cases: CaseService) {}

  @Post()
  @Roles(UserRole.Advocate, UserRole.Registrar, UserRole.Admin)
  create(@Body() body: CreateCaseBody, @Req() request: AuthenticatedRequest) {
    return this.cases.create(body, { id: request.user.sub, role: request.user.role });
  }

  @Get()
  @Roles(UserRole.Judge, UserRole.Advocate, UserRole.Registrar, UserRole.Admin, UserRole.Public)
  list(@Query() query: Record<string, string>) {
    const status = query.status ? this.parseStatus(query.status) : undefined;
    return this.cases.findMany({ status, court: query.court, q: query.q, page: this.number(query.page, 1), limit: this.number(query.limit, 20) });
  }

  @Get(':id')
  @Roles(UserRole.Judge, UserRole.Advocate, UserRole.Registrar, UserRole.Admin, UserRole.Public)
  get(@Param('id') id: string) {
    return this.cases.findOne(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.Judge, UserRole.Registrar, UserRole.Admin)
  changeStatus(@Param('id') id: string, @Body('status') status: CaseStatus, @Req() request: AuthenticatedRequest) {
    return this.cases.changeStatus(id, this.parseStatus(status), request.user.sub);
  }

  @Post(':id/emergency-flag')
  @Roles(UserRole.Judge, UserRole.Registrar, UserRole.Admin)
  flagEmergency(@Param('id') id: string, @Body('reason') reason: string | undefined, @Req() request: AuthenticatedRequest) {
    return this.cases.flagEmergency(id, request.user.sub, reason);
  }

  @Get(':id/audit-trail')
  @Roles(UserRole.Judge, UserRole.Registrar, UserRole.Admin)
  auditTrail(@Param('id') id: string) {
    return this.cases.auditTrail(id);
  }

  @Get(':id/audit-trail/verify')
  @Roles(UserRole.Judge, UserRole.Registrar, UserRole.Admin)
  verifyAuditTrail(@Param('id') id: string) {
    return this.cases.verifyAuditTrail(id);
  }

  private parseStatus(value: string): CaseStatus {
    if (!Object.values(CaseStatus).includes(value as CaseStatus)) throw new BadRequestException(`Unknown case status: ${value}`);
    return value as CaseStatus;
  }

  private number(value: string | undefined, fallback: number): number {
    if (value === undefined) return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) throw new BadRequestException('Pagination values must be positive integers');
    return parsed;
  }
}