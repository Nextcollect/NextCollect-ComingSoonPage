import Script from 'next/script';
import { Inter } from 'next/font/google';
import './styles/tokens.css';
import './styles/globals.css';
import { LanguageProvider } from './context/LanguageProvider';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata = {
  title: 'NextCollect — Coming Soon',
  description: "Europe's Trusted Platform for Collectors Launching 2026",
  openGraph: {
    title: 'NextCollect — Coming Soon',
    description: "Europe's Trusted Platform for Collectors Launching 2026",
    url: 'https://www.nxtcollect.com',
    siteName: 'NextCollect',
    images: [
      {
        url: 'https://www.nxtcollect.com/img/og-image.png',
        width: 1200,
        height: 630,
        alt: "NextCollect — Europe's Trusted Platform for Collectors",
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NextCollect — Coming Soon',
    description: "Europe's Trusted Platform for Collectors Launching 2026",
    images: ['https://www.nxtcollect.com/img/og-image.png'],
  },
  icons: {
    icon: '/img/nextcollect_Logo_full-color.svg',
    shortcut: '/img/nextcollect_Logo_full-color.svg',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
        <Script src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.8.5/dist/dotlottie-wc.js" type="module" />
      </body>
    </html>
  );
}
