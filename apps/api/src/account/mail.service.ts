import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SUBJECT: Record<string, (code: string) => string> = {
  az: (c) => `Kitabxana.az: giriş kodu ${c}`,
  ru: (c) => `Kitabxana.az: код для входа ${c}`,
  en: (c) => `Kitabxana.az: your sign-in code ${c}`,
};

const BODY: Record<string, (code: string) => string> = {
  az: (c) => `Kitabxana.az-a giriş kodunuz: ${c}\n\nKod 10 dəqiqə etibarlıdır. Bu məktubu siz istəməmisinizsə, sadəcə nəzərə almayın.`,
  ru: (c) => `Ваш код для входа на Kitabxana.az: ${c}\n\nКод действует 10 минут. Если вы не запрашивали его, просто проигнорируйте это письмо.`,
  en: (c) => `Your Kitabxana.az sign-in code: ${c}\n\nThe code is valid for 10 minutes. If you did not ask for it, you can ignore this email.`,
};

/**
 * Sends the sign-in code. With MAIL_API_KEY set it goes through Resend's HTTP API from
 * MAIL_FROM. Without one, development writes the code to the log; production never logs
 * codes, so sign-in by email is off there (`canDeliver`) until the key is set.
 */
@Injectable()
export class MailService {
  private log = new Logger('Mail');

  constructor(private config: ConfigService) {}

  get enabled() {
    return Boolean(this.config.get('MAIL_API_KEY'));
  }

  /** Whether a requested code can reach its reader: by mail, or in the log outside production */
  get canDeliver() {
    return this.enabled || this.config.get('NODE_ENV') !== 'production';
  }

  async sendCode(to: string, code: string, locale: string) {
    const lang = SUBJECT[locale] ? locale : 'az';
    if (!this.enabled) {
      if (!this.canDeliver) throw new Error('Mail is not configured');
      this.log.warn(`MAIL_API_KEY not set — sign-in code for ${to}: ${code}`);
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.config.get('MAIL_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: this.config.get('MAIL_FROM', 'Kitabxana.az <giris@kitabxana.az>'),
        to: [to],
        subject: SUBJECT[lang](code),
        text: BODY[lang](code),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      this.log.error(`Mail to ${to} failed: ${res.status} ${await res.text().catch(() => '')}`);
      throw new Error('Mail could not be sent');
    }
  }
}
