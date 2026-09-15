import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { HearingService, type HearingBody } from './hearing.service.js';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HearingController {
  constructor(private readonly hearings: HearingService) {}

  @Post('hearings')
  @Roles(UserRole.Judge, UserRole.Registrar, UserRole.Admin)
  create(@Body() body: HearingBody) {
    return this.hearings.create(body);
  }

  @Patch('hearings/:id')
  @Roles(UserRole.Judge, UserRole.Registrar, UserRole.Admin)
  update(@Param('id') id: string, @Body() body: Partial<HearingBody>) {
    return this.hearings.update(id, body);
  }

  @Get('courtrooms/:id/availability')
  @Roles(UserRole.Judge, UserRole.Registrar, UserRole.Admin)
  availability(@Param('id') id: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.hearings.availability(id, from, to);
  }
}