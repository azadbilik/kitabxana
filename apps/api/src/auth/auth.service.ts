import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (user.isBanned) throw new UnauthorizedException('Account banned');

    return this.issueTokens(user.id, user.role);
  }

  /** A refresh token is only as good as the account behind it now: banned or deleted
   *  staff get nothing, and a changed role takes effect on the next refresh */
  async refresh(refreshToken: string) {
    const invalid = new UnauthorizedException('Invalid refresh token');
    let userId: string;
    try {
      const payload = this.jwt.verify<{ sub: string }>(refreshToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
      userId = payload.sub;
    } catch {
      throw invalid;
    }
    const user = typeof userId === 'string' ? await this.users.findAuthState(userId) : null;
    if (!user || user.isBanned || !user.passwordHash) throw invalid;
    return this.issueTokens(user.id, user.role);
  }

  private issueTokens(userId: string, role: string) {
    const payload = { sub: userId, role };
    return {
      accessToken: this.jwt.sign(payload),
      refreshToken: this.jwt.sign(payload, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: '30d',
      }),
    };
  }
}
