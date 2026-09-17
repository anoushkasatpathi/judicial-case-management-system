import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { ObjectStorageService } from '../domain/object-storage.service.js';
import { AiController } from './ai.controller.js';
import { AiService } from './ai.service.js';
import { LocalAiProvider } from './local-ai.provider.js';
import { LocalSpeechProvider } from './local-speech.provider.js';

@Module({ controllers: [AiController], providers: [PrismaService, ObjectStorageService, AiService, LocalAiProvider, LocalSpeechProvider, { provide: 'AiProvider', useExisting: LocalAiProvider }, { provide: 'SpeechToText', useExisting: LocalSpeechProvider }] })
export class AiModule {}