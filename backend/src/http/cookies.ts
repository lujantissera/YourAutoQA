// Nombres de las dos cookies. Las dos son httpOnly: el JavaScript de la página no puede leerlas,
// así que un XSS no puede robar la sesión.
export const SESSION_COOKIE = 'yaqa_session';
export const STATE_COOKIE = 'yaqa_oauth_state';

// Lee una cookie de la cabecera `Cookie` ("a=1; b=2"). Express 5 no trae lector de cookies y para
// una sola cabecera no merece la pena una dependencia más.
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return undefined;
}
