import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: RedisClientType = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  });
  private available = false;

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
      this.available = true;
    } catch {
      this.available = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  async replaceQueue(key: string, entries: Array<{ value: string; score: number }>): Promise<boolean> {
    if (!this.available) return false;
    try {
      await this.client.del(key);
      if (entries.length > 0) await this.client.zAdd(key, entries);
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }

  async readQueue(key: string): Promise<string[] | null> {
    if (!this.available) return null;
    try {
      return await this.client.zRange(key, 0, -1, { REV: true });
    } catch {
      this.available = false;
      return null;
    }
  }

  async writeQueueEntries(key: string, entries: Array<{ value: string; score: number }>): Promise<boolean> {
    if (!this.available) return false;
    try {
      if (entries.length > 0) await this.client.zAdd(key, entries);
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }
}