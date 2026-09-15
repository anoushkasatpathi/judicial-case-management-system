import { Injectable } from '@nestjs/common';
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';

@Injectable()
export class ObjectStorageService {
  private readonly bucket = process.env.S3_BUCKET ?? 'justiq-documents';
  private readonly client = new S3Client({
    region: process.env.S3_REGION ?? 'us-east-1',
    endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'justiq',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'justiq-dev-password',
    },
  });
  private bucketReady = false;

  async put(buffer: Buffer, key: string, contentType: string): Promise<void> {
    await this.ensureBucket();
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentLength: buffer.length,
      ContentType: contentType,
    }));
  }

  async signedDownload(key: string, filename: string): Promise<string> {
    await this.ensureBucket();
    return getSignedUrl(this.client, new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    }), { expiresIn: 900 });
  }

  storageKey(caseId: string, filename: string, version: number): string {
    return `${caseId}/${version}-${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  }

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady) return;
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
    this.bucketReady = true;
  }
}