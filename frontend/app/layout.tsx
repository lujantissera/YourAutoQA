import type { Metadata } from 'next';
import Link from 'next/link';
import { Fira_Code, Fira_Sans } from 'next/font/google';
import { AuthProvider } from '../components/auth-provider';
import { UserMenu } from '../components/user-menu';
import './globals.css';
import './auth.css';

// next/font descarga la fuente al compilar y la sirve desde nuestro propio dominio:
// sin parpadeo de texto y sin peticiones a Google desde el navegador.
const sans = Fira_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});
const mono = Fira_Code({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'YouAutoQA',
  description: 'Genera y valida tests de Robot Framework a partir de una User Story de Jira.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {/* AuthProvider pide la sesión: sin ella lleva a /login y no enseña nada de lo privado. */}
        <AuthProvider>
          <header className="app-header">
            <div className="app-header-inner">
              <Link href="/" className="brand">
                <span className="brand-mark" aria-hidden="true">
                  QA
                </span>
                YouAutoQA
              </Link>
              <span className="brand-tag">robot framework · agent</span>
              <UserMenu />
            </div>
          </header>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
