import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Patch, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ClientIpThrottlerGuard } from '../common/guards/client-ip-throttler.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionService, type SessionUser } from './session.service';
import { CsrfGuard, SessionGuard } from './session.guard';
import { LoginCodeService } from './login-code.service';
import { GoogleService } from './google.service';
import { ReadersService } from './readers.service';
import { EmailStartDto, EmailVerifyDto, UpdateMeDto } from './dto';

/** Reader sign-in. Staff sign in through /auth/login (bearer JWT) and are not affected. */
@ApiTags('Account')
@Controller('auth')
export class ReaderAuthController {
  constructor(
    private sessions: SessionService,
    private codes: LoginCodeService,
    private google: GoogleService,
    private readers: ReadersService,
    private config: ConfigService,
  ) {}

  /** Which sign-in methods the page should offer */
  @Get('providers')
  providers() {
    return { google: this.google.enabled, email: true };
  }

  @Post('email/start')
  @HttpCode(204)
  @UseGuards(CsrfGuard, ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  async emailStart(@Body() dto: EmailStartDto) {
    await this.codes.start(dto.email, dto.locale ?? 'az');
  }

  @Post('email/verify')
  @UseGuards(CsrfGuard, ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 10 * 60_000 } })
  async emailVerify(@Body() dto: EmailVerifyDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const email = await this.codes.verify(dto.email, dto.code);
    const user = await this.readers.byEmail(email, dto.locale ?? 'az');
    if (user.isBanned) throw new ForbiddenException('Account blocked');
    await this.sessions.create(user.id, req, res);
    return this.readers.me(user.id);
  }

  @Get('google/start')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 10 * 60_000 } })
  googleStart(@Query('returnTo') returnTo: string, @Res() res: Response) {
    res.redirect(302, this.google.start(returnTo, res));
  }

  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const site = this.config.get<string>('SITE_URL', 'http://localhost:3000');
    try {
      const { profile, returnTo } = await this.google.callback(req, res);
      const user = await this.readers.byGoogle(profile);
      if (!user || user.isBanned) return res.redirect(302, `${site}/giris#google-failed`);
      await this.sessions.create(user.id, req, res);
      // The fragment never reaches a server or a cache; the page reads it to load the account
      res.redirect(302, `${site}${returnTo}#signed-in`);
    } catch {
      res.redirect(302, `${site}/giris#google-failed`);
    }
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.destroy(req, res);
  }
}

@ApiTags('Account')
@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(
    private readers: ReadersService,
    private sessions: SessionService,
  ) {}

  @Get()
  me(@CurrentUser() user: SessionUser) {
    return this.readers.me(user.id);
  }

  @Patch()
  update(@CurrentUser() user: SessionUser, @Body() dto: UpdateMeDto) {
    return this.readers.update(user.id, dto);
  }

  /** Deletes the account and everything saved with it, and signs out */
  @Delete()
  @HttpCode(204)
  async remove(@CurrentUser() user: SessionUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (!(await this.readers.remove(user.id))) throw new ForbiddenException('Staff accounts are removed by an administrator');
    await this.sessions.destroy(req, res);
  }
}
