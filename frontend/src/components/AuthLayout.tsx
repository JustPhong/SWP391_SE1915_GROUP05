import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from '../styles/auth.module.css';

interface AuthLayoutProps {
  children: ReactNode;
  subtitle: string;
  footerText: string;
  footerLink: { text: string; to: string };
}

export function AuthLayout({ children, subtitle, footerText, footerLink }: AuthLayoutProps) {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <span className={styles.logoText}>P</span>
        </div>

        <h1 className={styles.brand} style={{ fontWeight: 700, color: '#1E3A5F' }}>
          ParkSmart Vietnam
        </h1>
        <p className={styles.subtitle}>{subtitle}</p>

        <div className={styles.card}>{children}</div>

        <p className={styles.footerText}>
          {footerText}{' '}
          <Link to={footerLink.to} className={styles.footerLink}>
            {footerLink.text}
          </Link>
        </p>

        <div className={styles.meta}>
          <p>HO CHI MINH CITY</p>
          <p>© 2026 ParkSmart Vietnam. Smart Infrastructure Solutions.</p>
        </div>
      </div>
    </div>
  );
}