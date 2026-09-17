import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { DomainModule } from './domain/domain.module.js';
import { AiModule } from './ai/ai.module.js';

@Module({
  imports: [AuthModule, DomainModule, AiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
