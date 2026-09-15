import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { VirusScanStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service.js';

const redisConnection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

@Injectable()
export class VirusScanService implements OnModuleDestroy {
  private readonly queue = new Queue('document-virus-scan', { connection: redisConnection });
  private readonly worker = new Worker(
    'document-virus-scan',
    async (job) => {
      // Stub scanner: replace this processor with ClamAV without changing upload callers.
      await this.prisma.document.update({ where: { id: job.data.documentId }, data: { virus_scan_status: VirusScanStatus.Clean } });
    },
    { connection: redisConnection },
  );

  constructor(private readonly prisma: PrismaService) {
    this.worker.on('error', () => undefined);
  }

  enqueue(documentId: string): Promise<void> {
    return this.queue.add('scan-document', { documentId }, { attempts: 3, removeOnComplete: true }).then(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker.close();
    await this.queue.close();
  }
}