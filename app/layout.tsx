import './globals.css';
import type { Metadata } from 'next';
import { AuthProvider } from '../context/AuthContext';

// Metadata used by Next.js to populate document head tags. Adjust these
// values to match your branding.
export const metadata: Metadata = {
  title: 'CARGO Rewards',
  description: 'Portal loyalti untuk pelanggan C.A.R.G.O',
};

// Root layout wraps all pages in the AuthProvider to make authentication
// information available throughout the application. It also defines the
// HTML language and includes global styles.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}