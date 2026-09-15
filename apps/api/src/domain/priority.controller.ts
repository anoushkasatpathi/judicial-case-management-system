import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { PriorityService } from './priority.service.js';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PriorityController {
  constructor(private readonly priority: PriorityService) {}

  @Post('scheduler/recompute')
  @Roles(UserRole.Registrar, UserRole.Admin)
  recompute(@Body('courtId') courtId: string | undefined, @Req() request: AuthenticatedRequest) {
    return this.priority.recomputeAll(courtId, request.user.sub);
  }

  @Get('courts/:courtId/queue')
  @Roles(UserRole.Judge, UserRole.Registrar, UserRole.Admin)
  queue(@Param('courtId') courtId: string) {
    return this.priority.getQueue(courtId);
  }

  @Post('courts/:courtId/queue/reorder')
  @Roles(UserRole.Registrar, UserRole.Admin)
  reorder(@Param('courtId') courtId: string, @Body() body: { caseIds: string[]; reason: string }, @Req() request: AuthenticatedRequest) {
    if (!Array.isArray(body.caseIds) || body.caseIds.length === 0 || !body.reason?.trim()) {
      throw new BadRequestException('caseIds and a non-empty reason are required');
    }
    return this.priority.reorder(courtId, body.caseIds, request.user.sub, body.reason);
  }
}