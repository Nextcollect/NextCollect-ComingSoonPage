import './styles/tokens.css';
import './styles/globals.css';

export const metadata = {
  title: 'Next Collect - Coming Soon',
  description: "Europe's Trusted Platform for Collectors Launching 2026",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
