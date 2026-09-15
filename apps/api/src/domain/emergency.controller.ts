import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { EmergencyService } from './emergency.service.js';

interface EmergencyBody {
  reason?: string;
}

@Controller('api/cases')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmergencyController {
  constructor(private readonly emergency: EmergencyService) {}

  @Post(':id/emergency-flag')
  @Roles(UserRole.Advocate, UserRole.Judge, UserRole.Registrar, UserRole.Admin)
  start(@Param('id') id: string, @Body() body: EmergencyBody = {}, @Req() request: AuthenticatedRequest) {
    return this.emergency.start(id, request.user.sub, body.reason);
  }

  @Post(':id/emergency/triage')
  @Roles(UserRole.Registrar)
  triage(@Param('id') id: string, @Body() body: EmergencyBody = {}, @Req() request: AuthenticatedRequest) {
    return this.emergency.triage(id, request.user.sub, body.reason);
  }

  @Post(':id/emergency/accept')
  @Roles(UserRole.Judge)
  accept(@Param('id') id: string, @Body() body: EmergencyBody = {}, @Req() request: AuthenticatedRequest) {
    return this.emergency.accept(id, request.user.sub, body.reason);
  }

  @Post(':id/emergency/inject-slot')
  @Roles(UserRole.Registrar, UserRole.Admin)
  injectSlot(@Param('id') id: string, @Body() body: EmergencyBody = {}, @Req() request: AuthenticatedRequest) {
    return this.emergency.injectSlot(id, request.user.sub, body.reason);
  }

  @Post(':id/emergency/notify')
  @Roles(UserRole.Registrar, UserRole.Admin)
  notify(@Param('id') id: string, @Body() body: EmergencyBody = {}, @Req() request: AuthenticatedRequest) {
    return this.emergency.notify(id, request.user.sub, body.reason);
  }
}