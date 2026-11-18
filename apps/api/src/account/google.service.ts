import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { deriveKey } from '../common/utils/keys';
import { readCookie } from './session.service';

const OAUTH_COOKIE = 'kx_oauth';
const OAUTH_PATH = '/api/auth/google';

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

/** A same-site path to return to after sign-in; anything else becomes the home page */
export function safeReturnTo(value: unknown): string {
  const v = typeof value === 'string' ? value : '';
  return v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') && v.length < 500 ? v : '/';
}

/**
 * "Continue with Google": authorization code flow with PKCE, run by the API.
 * State, verifier and the page to return to travel in a short-lived signed HttpOnly cookie.
 * Off (404) until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
 */
@Injectable()
export class GoogleService {
  constructor(private config: ConfigService) {}

  get enabled() {
    return Boolean(this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET'));
  }

  private get redirectUri() {
    const api = this.config.get<string>('PUBLIC_API_URL') ?? `${this.config.get('SITE_URL', 'http://localhost:3000')}/api`;
    return `${api}/auth/google/callback`;
  }

  private sign(value: string) {
    const key = deriveKey(this.config.getOrThrow<string>('JWT_SECRET'), 'oauth-state');
    return createHmac('sha256', key).update(value).digest('base64url');
  }

  start(returnTo: unknown, res: Response) {
    if (!this.enabled) throw new NotFoundException();
    const state = randomBytes(16).toString('base64url');
    const verifier = randomBytes(32).toString('base64url');
    const payload = `${state}.${verifier}.${Buffer.from(safeReturnTo(returnTo)).toString('base64url')}`;
    res.cookie(OAUTH_COOKIE, `${payload}.${this.sign(payload)}`, {
      httpOnly: true,
      secure: !String(this.config.get('SITE_URL') ?? 'https://').startsWith('http://'),
      sameSite: 'lax',
      path: OAUTH_PATH,
      maxAge: 10 * 60_000,
    });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: this.config.getOrThrow('GOOGLE_CLIENT_ID'),
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    return url.toString();
  }

  /** Checks state, exchanges the code, and returns the Google profile and where to go next */
  async callback(req: Request, res: Response): Promise<{ profile: GoogleProfile; returnTo: string }> {
    if (!this.enabled) throw new NotFoundException();
    const cookie = readCookie(req, OAUTH_COOKIE);
    res.clearCookie(OAUTH_COOKIE, { path: OAUTH_PATH });
    const bad = new BadRequestException('Sign-in with Google failed; please try again');
    if (!cookie) throw bad;

    const parts = cookie.split('.');
    if (parts.length !== 4) throw bad;
    const [state, verifier, returnB64, mac] = parts;
    const expected = Buffer.from(this.sign(`${state}.${verifier}.${returnB64}`));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw bad;
    if (req.query.state !== state || typeof req.query.code !== 'string') throw bad;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: req.query.code,
        client_id: this.config.getOrThrow('GOOGLE_CLIENT_ID'),
        client_secret: this.config.getOrThrow('GOOGLE_CLIENT_SECRET'),
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) throw bad;
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) throw bad;

    // The userinfo endpoint answers only for a valid token from this exchange
    const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!infoRes.ok) throw bad;
    const info = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string; picture?: string };
    if (!info.sub || !info.email) throw bad;

    return {
      profile: { sub: info.sub, email: info.email, emailVerified: Boolean(info.email_verified), name: info.name, picture: info.picture },
      returnTo: safeReturnTo(Buffer.from(returnB64, 'base64url').toString()),
    };
  }
}
