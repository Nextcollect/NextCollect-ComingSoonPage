import Script from 'next/script';
import './styles/tokens.css';
import './styles/globals.css';
import { LanguageProvider } from './context/LanguageProvider';

export const metadata = {
  title: 'Next Collect - Coming Soon',
  description: "Europe's Trusted Platform for Collectors Launching 2026",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
      <Script src="https://unpkg.com/@lottiefiles/dotlottie-wc@0.8.5/dist/dotlottie-wc.js" type="module" />
    </html>
  );
}
