import type { Metadata } from 'next';
import { Fira_Code, Fira_Sans } from 'next/font/google';
import { AppShell } from '../components/app-shell';
import { AuthProvider } from '../components/auth-provider';
import './globals.css';
import './auth.css';
import './shell.css';

// next/font descarga la fuente al compilar y la sirve desde nuestro propio dominio:
// sin parpadeo de texto y sin peticiones a Google desde el navegador.
const sans = Fira_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});
const mono = Fira_Code({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'YourAutoQA',
  description: 'Genera y valida tests de Robot Framework a partir de una User Story de Jira.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body>
        {/* AuthProvider pide la sesión: sin ella lleva a /login y no enseña nada de lo privado.
            AppShell pone la barra lateral cuando hay sesión. */}
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
