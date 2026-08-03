import Link from 'next/link';
import Image from 'next/image';
import { PRIVACY } from './content';
import styles from './styles.module.css';

/**
 * Plain-language privacy notice (D-005, downgraded scope).
 *
 * Server-rendered from ?lang= for the same reason /unsubscribed is: a client component
 * reading search params prerenders to an empty shell, and a privacy page that flashes blank
 * is worse than one that is simply there. No client JS needed.
 */

export const metadata = {
  title: 'Privacy — NextCollect',
};

export default async function PrivacyPage({ searchParams }) {
  const params = await searchParams;
  const raw = String(params?.lang || '').toLowerCase();
  const lang = PRIVACY[raw] ? raw : 'en';
  const c = PRIVACY[lang];

  return (
    <main className={styles.wrap} lang={lang}>
      <Link href="/" className={styles.logoLink}>
        <Image
          src="/img/nextcollect_Logo_full-color.svg"
          alt="NextCollect"
          width={180}
          height={19}
          className={styles.logo}
          priority
        />
      </Link>

      <h1 className={styles.title}>{c.title}</h1>
      <p className={styles.intro}>{c.intro}</p>

      {c.sections.map((s) => (
        <section key={s.h} className={styles.section}>
          <h2 className={styles.heading}>{s.h}</h2>
          {s.p.map((text) => (
            <p key={text} className={styles.body}>
              {text}
            </p>
          ))}
        </section>
      ))}

      <Link className={styles.back} href="/">
        NextCollect
      </Link>
    </main>
  );
}
