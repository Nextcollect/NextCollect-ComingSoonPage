'use client';

import Link from 'next/link';
import SocialMedia from '../SocialMedia';
import { useLanguage } from '../../context/LanguageProvider';
import styles from './styles.module.css';

export default function Footer() {
  const { t, locale } = useLanguage();
  return (
    <footer className={styles.footer}>
      <div className={styles.copyright}>
        <p>© {new Date().getFullYear()} NextCollect. All Rights Reserved.</p>
        <Link href={`/privacy?lang=${(locale || 'EN').toLowerCase()}`} className={styles.privacyLink}>
          {t('form.privacy_link') || 'Privacy'}
        </Link>
      </div>
      <div className={styles.footerRight}>
        <SocialMedia variant="footer" />
      </div>
    </footer>
  );
}
