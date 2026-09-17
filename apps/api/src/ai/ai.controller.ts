import { Body, Controller, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AiService } from './ai.service.js';

@Controller('api/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly ai: AiService) {}
  @Post('petitions/:id/extract') @Roles(UserRole.Registrar, UserRole.Admin) extract(@Param('id') id: string) { return this.ai.extract(id); }
  @Post('cases/:id/priority-suggestion') @Roles(UserRole.Judge, UserRole.Registrar, UserRole.Admin) priority(@Param('id') id: string) { return this.ai.prioritySuggestion(id); }
  @Post('cases/:id/summarize') @Roles(UserRole.Judge, UserRole.Registrar, UserRole.Advocate, UserRole.Admin) summarize(@Param('id') id: string) { return this.ai.summarize(id); }
  @Post('hearings/:id/draft-order') @Roles(UserRole.Judge, UserRole.Registrar, UserRole.Admin) @UseInterceptors(FileInterceptor('audio')) draft(@Param('id') id: string, @UploadedFile() audio: { buffer: Buffer } | undefined, @Body('transcript') transcript?: string) { return this.ai.draftOrder(id, transcript ?? '', audio?.buffer); }
  @Post('petitions/:id/confirm') @Roles(UserRole.Registrar, UserRole.Admin) confirm(@Param('id') id: string, @Body() body: { case_number: string; case_type: string; court_id: string; filing_advocate_id: string; parties?: Array<{ name: string; role: 'Petitioner' | 'Respondent'; contact_info?: string }> }) { return this.ai.confirmExtraction(id, body); }
  @Patch('cases/:caseId/priority-suggestion/:suggestionId/final-score') @Roles(UserRole.Judge, UserRole.Registrar, UserRole.Admin) finalScore(@Param('suggestionId') suggestionId: string, @Body('score') score: number) { return this.ai.recordHumanScore(suggestionId, score); }
  @Patch('draft-orders/:id/approve') @Roles(UserRole.Judge) approve(@Param('id') id: string, @Body('order_summary') orderSummary: string) { return this.ai.approveDraft(id, orderSummary); }
}