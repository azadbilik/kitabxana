import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow('JWT_SECRET'),
    });
  }

  /** The account as it is now, not as it was when the token was signed: a ban or a role
   *  change applies at once rather than when the token runs out */
  async validate(payload: JwtPayload) {
    const user = await this.users.findAuthState(payload.sub);
    if (!user || user.isBanned) throw new UnauthorizedException();
    return { id: user.id, role: user.role };
  }
}
