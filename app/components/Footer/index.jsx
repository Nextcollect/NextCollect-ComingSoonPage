import styles from './styles.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.copyright}>
        <p>© Copyrights Protech | All Rights Reserved</p>
      </div>
      <div className={styles.footerRight}>
        <img src="/img/footer---right.svg" alt="Footer decoration" />
      </div>
    </footer>
  );
}
