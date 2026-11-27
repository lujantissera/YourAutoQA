import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AuthService } from '../auth/auth-service.js';
import { can, type Action } from '../auth/roles.js';
import type { User } from '../auth/user.js';
import { SESSION_COOKIE, readCookie } from './cookies.js';
import { errorBody } from './error-body.js';

// Mira la cookie de sesión y, si es válida, deja al usuario en `res.locals.user`. NO bloquea nada:
// decidir si hace falta sesión es cosa de cada ruta (requirePermission). Las rutas `async` que
// fallan las recoge Express 5 y las manda al manejador de errores.
export function authenticate(auth: AuthService): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    const user = await auth.authenticate(token);
    if (user) res.locals.user = user;
    next();
  };
}

export const currentUser = (res: Response): User | undefined => res.locals.user as User | undefined;

// El guardián de una ruta. 401 = "no sé quién eres" (sin sesión o caducada); 403 = "sé quién
// eres, pero tu rol no puede hacer esto". La seguridad vive AQUÍ, en el backend: esconder botones
// en la interfaz es comodidad, no protección (US-02.5).
export function requirePermission(action: Action): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    const user = currentUser(res);
    if (!user) {
      res.status(401).json(errorBody('unauthorized', 'You must sign in.'));
      return;
    }
    if (!can(user.role, action)) {
      res.status(403).json(errorBody('forbidden', 'Your role does not allow this action.'));
      return;
    }
    next();
  };
}
