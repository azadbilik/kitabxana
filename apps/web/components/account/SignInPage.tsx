'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { localePath } from '@/lib/i18n';
import { useAccount, useSignInAvailable } from './AccountProvider';
import { SignInPanel } from './SignInPanel';

/** The standalone sign-in page: after signing in, on to the reader's shelf */
export function SignInPage() {
  const { signedIn } = useAccount();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('library');
  const available = useSignInAvailable();
  return (
    <div className="signin-card">
      <SignInPanel
        onSignedIn={(me) => {
          signedIn(me);
          router.push(localePath(locale, '/refim'));
        }}
      />
      {available === false && (
        <Link prefetch={false} href={localePath(locale, '/collections')} className="btn btn-primary btn-lg signin-onward">
          {t('open_catalog')}
        </Link>
      )}
    </div>
  );
}
