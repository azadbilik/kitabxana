import { Module } from '@nestjs/common';
import { SessionService } from './session.service';
import { SessionGuard, CsrfGuard } from './session.guard';
import { LoginCodeService } from './login-code.service';
import { MailService } from './mail.service';
import { GoogleService } from './google.service';
import { ReadersService } from './readers.service';
import { MeController, ReaderAuthController } from './account.controller';

/** Reader accounts: cookie sessions, sign-in by emailed code or Google, the reader's profile */
@Module({
  controllers: [ReaderAuthController, MeController],
  providers: [SessionService, SessionGuard, CsrfGuard, LoginCodeService, MailService, GoogleService, ReadersService],
  exports: [SessionService, SessionGuard],
})
export class AccountModule {}
