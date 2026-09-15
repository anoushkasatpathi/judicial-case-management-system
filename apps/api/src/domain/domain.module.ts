import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AuditService } from './audit.service.js';
import { CaseController } from './case.controller.js';
import { CaseService } from './case.service.js';
import { EmergencyController } from './emergency.controller.js';
import { EmergencyService } from './emergency.service.js';
import { DocumentController } from './document.controller.js';
import { DocumentService } from './document.service.js';
import { HearingController } from './hearing.controller.js';
import { HearingService } from './hearing.service.js';
import { PriorityController } from './priority.controller.js';
import { PriorityService } from './priority.service.js';
import { RedisService } from './redis.service.js';
import { ObjectStorageService } from './object-storage.service.js';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';
import { VirusScanService } from './virus-scan.service.js';

@Module({
  controllers: [CaseController, PriorityController, HearingController, EmergencyController, DocumentController, PublicController],
  providers: [PrismaService, AuditService, CaseService, HearingService, PriorityService, RedisService, EmergencyService, ObjectStorageService, VirusScanService, DocumentService, PublicService],
})
export class DomainModule {}