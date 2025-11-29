import styles from './styles.module.css';

export default function Navbar() {
  return (
    <header className={styles.navbar}>
      <div className={styles.leftSection}>
        <div className={styles.logo}>
          <img src="/img/vector.svg" alt="Next Collect Logo" />
          <span className={styles.logoText}>protech</span>
        </div>
        <img src="/img/social-media---menu-icons.svg" alt="Social media menu" className={styles.socialIcons} />
      </div>
      <div className={styles.rightSection}>
        <div className={styles.languageSelector}>
          <img src="/img/frame-1.svg" alt="Language" />
          <span>Nederlands</span>
        </div>
        <button className={styles.ctaButton}>Join The Waitlist</button>
      </div>
    </header>
  );
}
