import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { RolesGuard } from './roles.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    RolesGuard,
  ],
})
export class AuthModule {}