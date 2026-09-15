import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType, VirusScanStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { PrismaService } from '../prisma.service.js';
import { ObjectStorageService } from './object-storage.service.js';
import { VirusScanService } from './virus-scan.service.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg', 'text/plain']);

export interface UploadedDocumentFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly scans: VirusScanService,
  ) {}

  async upload(caseId: string, file: UploadedDocumentFile, docType: string, actorId: string) {
    if (!file) throw new BadRequestException('A file is required');
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException('File exceeds the 10 MB limit');
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    if (!Object.values(DocumentType).includes(docType as DocumentType)) throw new BadRequestException(`Unsupported document type: ${docType}`);
    const caseExists = await this.prisma.case.findUnique({ where: { id: caseId }, select: { id: true } });
    if (!caseExists) throw new NotFoundException('Case not found');

    const filename = basename(file.originalname);
    const previous = await this.prisma.document.findFirst({ where: { case_id: caseId, filename }, orderBy: { version: 'desc' } });
    const version = (previous?.version ?? 0) + 1;
    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const storageKey = this.storage.storageKey(caseId, filename, version);
    await this.storage.put(file.buffer, storageKey, file.mimetype);
    const document = await this.prisma.document.create({
      data: {
        case_id: caseId,
        uploaded_by: actorId,
        filename,
        doc_type: docType as DocumentType,
        storage_url: storageKey,
        version,
        checksum,
        virus_scan_status: VirusScanStatus.Pending,
      },
    });
    await this.scans.enqueue(document.id);
    return document;
  }

  async download(id: string) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) throw new NotFoundException('Document not found');
    return {
      downloadUrl: await this.storage.signedDownload(document.storage_url, document.filename),
      filename: document.filename,
      version: document.version,
      checksum: document.checksum,
      virusScanStatus: document.virus_scan_status,
    };
  }
}