import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';
import type { AuthenticatedRequest } from './auth.types.js';

interface LoginBody {
  email: string;
  password: string;
}

interface RefreshBody {
  refreshToken: string;
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: LoginBody) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshBody) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  logout(@Body() body: RefreshBody): { success: true } {
    this.authService.logout(body.refreshToken);
    return { success: true };
  }

  @Get('admin-check')
  @Roles(UserRole.Admin)
  @UseGuards(JwtAuthGuard, RolesGuard)
  adminCheck(@Req() request: AuthenticatedRequest) {
    return { userId: request.user.sub, role: request.user.role };
  }
}