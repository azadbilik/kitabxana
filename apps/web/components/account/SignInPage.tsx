'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { localePath } from '@/lib/i18n';
import { useAccount } from './AccountProvider';
import { SignInPanel } from './SignInPanel';

/** The standalone sign-in page: after signing in, on to the reader's shelf */
export function SignInPage() {
  const { signedIn } = useAccount();
  const router = useRouter();
  const locale = useLocale();
  return (
    <div className="signin-card">
      <SignInPanel
        onSignedIn={(me) => {
          signedIn(me);
          router.push(localePath(locale, '/refim'));
        }}
      />
    </div>
  );
}
