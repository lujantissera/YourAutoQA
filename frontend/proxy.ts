import { NextResponse, type NextRequest } from 'next/server';
import { needsLogin } from './lib/auth';

// Nombre de la cookie de sesión que pone el backend (http/cookies.ts).
const SESSION_COOKIE = 'yaqa_session';

// Se ejecuta ANTES de pintar cada pantalla: sin cookie de sesión manda a /login (US-01.1) sin
// enseñar nada. Solo comprueba que la cookie exista; si fuera falsa o hubiera caducado, el backend
// responde 401 y AuthProvider lleva al login. (En Next 16 "middleware" se llama "proxy".)
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  if (needsLogin(request.nextUrl.pathname, hasSession)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // No se aplica a la API (/api/*, que reenvía al backend), a los archivos de Next ni a imágenes.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
