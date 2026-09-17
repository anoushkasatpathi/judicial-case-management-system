import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicService } from './public.service.js';
import { CaseStatusQueryDto, CauseListQueryDto } from './public.dto.js';

@Controller('api/public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('cause-list')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  causeList(@Query() query: CauseListQueryDto) {
    return this.publicService.causeList(query.court, query.date);
  }

  @Get('case-status')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  caseStatus(@Query() query: CaseStatusQueryDto) {
    return this.publicService.caseStatus(query.caseNumber);
  }
}