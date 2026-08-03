import Link from 'next/link';
import Image from 'next/image';
import styles from './styles.module.css';

import en from '../i18n/en.json';
import nl from '../i18n/nl.json';
import de from '../i18n/de.json';
import fr from '../i18n/fr.json';
import es from '../i18n/es.json';
import it from '../i18n/it.json';

/**
 * Unsubscribe result page.
 *
 * Served from the Next app rather than the edge function because the Supabase edge gateway
 * rewrites HTML responses to `content-type: text/plain` with no charset — which rendered the
 * page as raw source and mangled every non-ASCII character. See the comment in
 * supabase/functions/unsubscribe/index.ts.
 *
 * SERVER-RENDERED ON PURPOSE. The first version was a client component using
 * useSearchParams, which meant the prerendered HTML contained only an empty Suspense
 * fallback and the copy appeared after hydration. Someone arriving from an email would see a
 * blank page first — the same "this looks broken" impression that pushes people to the spam
 * button instead. Reading searchParams server-side renders the real text immediately, needs
 * no client JS, and works with JS disabled.
 *
 * The edge function does the work (HMAC check + DB update) and 303-redirects here with
 * ?status=&lang=. This page only reports the outcome, so a reload or a shared link is inert.
 */

const DICTS = { en, nl, de, fr, es, it };
const STATUSES = ['ok', 'invalid', 'error'];

export const metadata = {
  title: 'Unsubscribed — NextCollect',
  robots: { index: false, follow: false },
};

export default async function UnsubscribedPage({ searchParams }) {
  const params = await searchParams;

  // Anything unrecognised falls back to the safe defaults rather than rendering blank.
  const lang = DICTS[String(params?.lang || '').toLowerCase()] ? String(params.lang).toLowerCase() : 'en';
  const status = STATUSES.includes(String(params?.status)) ? String(params.status) : 'error';

  const copy = DICTS[lang].unsubscribe ?? DICTS.en.unsubscribe;

  return (
    <main className={styles.wrap} lang={lang}>
      {/* Logo but deliberately NO navbar. Someone arriving from an email needs to see
          instantly that they are in the right place — an unbranded page of bare text reads
          as an error or a phishing landing, which is the impression that sends people to
          the spam button. The navbar is a different matter: it carries a "Get Early Access"
          CTA and a language switcher, and showing a signup CTA to someone who just left is
          tone-deaf, while the language is already resolved from their stored locale. */}
      <Image
        src="/img/nextcollect_Logo_full-color.svg"
        alt="NextCollect"
        width={180}
        height={19}
        className={styles.logo}
        priority
      />
      <h1 className={styles.title}>{copy[`title_${status}`]}</h1>
      <p className={styles.body}>{copy[`body_${status}`]}</p>
      <Link className={styles.back} href="/">
        {copy.back}
      </Link>
    </main>
  );
}
