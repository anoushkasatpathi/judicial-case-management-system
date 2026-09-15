import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from './audit.service.js';
import { CaseController } from './case.controller.js';
import { CaseService } from './case.service.js';
import { EmergencyController } from './emergency.controller.js';
import { EmergencyService } from './emergency.service.js';
import { HearingController } from './hearing.controller.js';
import { HearingService } from './hearing.service.js';
import { PriorityController } from './priority.controller.js';
import { PriorityService } from './priority.service.js';
import { RedisService } from './redis.service.js';

@Module({
  controllers: [CaseController, PriorityController, HearingController, EmergencyController],
  providers: [PrismaService, AuditService, CaseService, HearingService, PriorityService, RedisService, EmergencyService],
})
export class DomainModule {}