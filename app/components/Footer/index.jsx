import SocialMedia from '../SocialMedia';
import styles from './styles.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.copyright}>
        <p>© {new Date().getFullYear()} NextCollect. All Rights Reserved.</p>
      </div>
      <div className={styles.footerRight}>
        <SocialMedia variant="footer" />
      </div>
    </footer>
  );
}
