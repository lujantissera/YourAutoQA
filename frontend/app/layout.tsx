import type { Metadata } from 'next';
import { Geist_Mono, Instrument_Sans } from 'next/font/google';
import './globals.css';

// next/font descarga la fuente al compilar y la sirve desde nuestro propio dominio:
// sin parpadeo de texto y sin peticiones a Google desde el navegador.
const sans = Instrument_Sans({ subsets: ['latin'], variable: '--font-sans' });
const mono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'YouAutoQA',
  description: 'Genera y valida tests de Robot Framework a partir de una User Story de Jira.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
