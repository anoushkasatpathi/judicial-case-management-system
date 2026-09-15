import { Controller, Get, Query } from '@nestjs/common';
import { PublicService } from './public.service.js';

@Controller('api/public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('cause-list')
  causeList(@Query('court') court?: string, @Query('date') date?: string) {
    return this.publicService.causeList(court, date);
  }

  @Get('case-status')
  caseStatus(@Query('caseNumber') caseNumber?: string) {
    return this.publicService.caseStatus(caseNumber ?? '');
  }
}