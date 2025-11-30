'use client';

import Image from 'next/image';
import styles from './styles.module.css';

const SOCIAL_MEDIA_LINKS = [
  {
    id: 'instagram',
    name: 'Instagram',
    url: 'https://instagram.com',
    icon: '/img/NextCollect_Instagram_Icon.svg'
  },
  {
    id: 'facebook',
    name: 'Facebook',
    url: 'https://facebook.com',
    icon: '/img/NextCollect_Facebook_Icon.svg'
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    url: 'https://tiktok.com',
    icon: '/img/NextCollect_TikTok_Icon.svg'
  }
];

export default function SocialMedia({ variant = 'default' }) {
  const isFooter = variant === 'footer';
  const isModal = variant === 'modal';

  const containerClass = [
    styles.socialIcons,
    isFooter ? styles.socialIconsFooter : '',
    isModal ? styles.socialIconsModal : ''
  ]
    .filter(Boolean)
    .join(' ');

  const linkClass = isFooter
    ? styles.socialLinkFooter
    : isModal
      ? styles.socialLinkModal
      : styles.socialLink;

  const iconClass = isFooter
    ? styles.socialIconFooter
    : isModal
      ? styles.socialIconModal
      : styles.socialIcon;

  return (
    <div className={containerClass} aria-label="Social media links">
      {SOCIAL_MEDIA_LINKS.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          title={link.name}
          aria-label={link.name}
        >
          <Image
            src={link.icon}
            alt={link.name}
            width={16}
            height={16}
            className={iconClass}
            priority={isFooter}
          />
        </a>
      ))}
    </div>
  );
}
