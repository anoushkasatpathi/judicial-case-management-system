import { Module } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    Reflector,
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AuthModule {}