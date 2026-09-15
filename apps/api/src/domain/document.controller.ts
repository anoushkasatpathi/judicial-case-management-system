import { BadRequestException, Body, Controller, Get, Param, Post, Req, UploadedFile as UploadedFileDecorator, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { DocumentService, type UploadedDocumentFile } from './document.service.js';

@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Post('cases/:id/documents')
  @Roles(UserRole.Advocate, UserRole.Registrar, UserRole.Admin)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  upload(@Param('id') id: string, @UploadedFileDecorator() file: UploadedDocumentFile, @Body('doc_type') docType: string, @Req() request: AuthenticatedRequest) {
    if (!file) throw new BadRequestException('A file is required');
    return this.documents.upload(id, file, docType, request.user.sub);
  }

  @Get('documents/:id/download')
  @Roles(UserRole.Judge, UserRole.Advocate, UserRole.Registrar, UserRole.Admin)
  download(@Param('id') id: string) {
    return this.documents.download(id);
  }
}