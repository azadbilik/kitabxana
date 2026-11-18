import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { ClientIpThrottlerGuard } from '../common/guards/client-ip-throttler.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UsersService } from '../users/users.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private users: UsersService,
  ) {}

  @Public()
  @Post('login')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 10 * 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @UseGuards(ClientIpThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 10 * 60_000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.users.findById(userId);
  }
}
