import { Router, type CookieOptions, type Request, type Response } from 'express';
import type { AuthService } from '../auth/auth-service.js';
import { AuthError } from '../auth/errors.js';
import { ACTIONS, can } from '../auth/roles.js';
import type { User } from '../auth/user.js';
import { currentUser } from './auth-middleware.js';
import { SESSION_COOKIE, STATE_COOKIE, readCookie } from './cookies.js';
import { errorBody } from './error-body.js';

// Lo que se muestra de un usuario: nunca nada del token ni de la sesión.
export const toPublicUser = (user: User) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl,
  role: user.role,
});

const STATE_MAX_AGE_MS = 10 * 60 * 1000; // el usuario tiene 10 minutos para autorizar en Atlassian

// Dónde vuelve el navegador si el login no se completa. La pantalla /login (frontend) muestra un
// mensaje según el código. Rutas relativas: el navegador las resuelve contra el mismo origen.
const loginError = (code: 'state' | 'cancelled' | 'failed') => `/login?error=${code}`;

export function authRoutes(auth: AuthService, options: { cookieSecure: boolean }): Router {
  const router = Router();

  // SameSite=Lax: la cookie viaja al volver de Atlassian (navegación de primer nivel) pero NO en
  // peticiones POST hechas desde otras webs, lo que frena el CSRF.
  const cookieOptions: CookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: options.cookieSecure,
    path: '/',
  };

  // 1) El navegador llega aquí; guardamos el `state` en una cookie y lo mandamos a Atlassian.
  router.get('/login', (_req: Request, res: Response) => {
    const { state, url } = auth.startLogin();
    res.cookie(STATE_COOKIE, state, { ...cookieOptions, maxAge: STATE_MAX_AGE_MS });
    res.redirect(url);
  });

  // 2) Atlassian devuelve al usuario aquí con ?code=...&state=... (o ?error=access_denied).
  router.get('/callback', async (req: Request, res: Response) => {
    const expectedState = readCookie(req.headers.cookie, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, cookieOptions); // se usa una sola vez

    const { state, code, error } = req.query;
    if (!expectedState || typeof state !== 'string' || state !== expectedState) {
      res.redirect(loginError('state'));
      return;
    }
    if (error !== undefined) {
      res.redirect(loginError(error === 'access_denied' ? 'cancelled' : 'failed'));
      return;
    }
    if (typeof code !== 'string' || code === '') {
      res.redirect(loginError('failed'));
      return;
    }

    try {
      const { token } = await auth.completeLogin(code);
      res.cookie(SESSION_COOKIE, token, {
        ...cookieOptions,
        maxAge: auth.sessionTtlSeconds * 1000,
      });
      res.redirect('/');
    } catch (caught) {
      // Un código rechazado por Atlassian es un caso normal; cualquier otro fallo (base de datos
      // caída...) sube al manejador de errores para que se registre.
      if (!(caught instanceof AuthError)) throw caught;
      res.redirect(loginError('failed'));
    }
  });

  // POST y no GET: cerrar sesión cambia el estado, y un GET se puede disparar desde cualquier <img>.
  router.post('/logout', async (req: Request, res: Response) => {
    await auth.logout(readCookie(req.headers.cookie, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  });

  // Quién soy y qué puedo hacer. La interfaz usa `permissions` para decidir qué mostrar, pero el
  // backend vuelve a comprobarlo en cada petición.
  router.get('/me', (_req: Request, res: Response) => {
    const user = currentUser(res);
    if (!user) {
      res.status(401).json(errorBody('unauthorized', 'You must sign in.'));
      return;
    }
    res.json({
      user: toPublicUser(user),
      permissions: ACTIONS.filter((action) => can(user.role, action)),
    });
  });

  return router;
}
