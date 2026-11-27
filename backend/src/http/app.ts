import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/auth-service.js';
import { AuthError, type AuthErrorKind } from '../auth/errors.js';
import { ROLES } from '../auth/roles.js';
import { JiraError, type JiraErrorKind } from '../jira/errors.js';
import { JobError, type JobErrorKind } from '../jobs/errors.js';
import type { JobService } from '../jobs/job-service.js';
import { authenticate, currentUser, requirePermission } from './auth-middleware.js';
import { authRoutes, toPublicUser } from './auth-routes.js';
import { errorBody } from './error-body.js';

export interface AppDeps {
  jobService: JobService;
  authService: AuthService;
  /** true en producción (HTTPS): la cookie de sesión lleva el atributo Secure. */
  cookieSecure?: boolean;
  /** Para registrar errores inesperados (el cliente solo recibe un mensaje genérico). */
  onError?: (error: unknown) => void;
}

const CreateJobBody = z.object({ issueKey: z.string() });

// La respuesta del usuario acaba dentro del prompt del LLM: es entrada no confiable (TS-01) y gasta
// tokens, así que se limita su longitud.
const MAX_ANSWER_LENGTH = 2000;
const RoleBody = z.object({ role: z.enum(ROLES) });
const ClarifyBody = z.object({ answer: z.string().trim().min(1).max(MAX_ANSWER_LENGTH) });

// Qué código HTTP corresponde a cada tipo de error de Jira (D-46).
const JIRA_STATUS: Record<JiraErrorKind, number> = {
  invalid_key: 400,
  not_found: 404,
  forbidden: 403,
  unavailable: 502,
};

// Y a cada tipo de error del servicio de jobs. 409 = "lo que pides no encaja con el estado actual".
const JOB_STATUS: Record<JobErrorKind, number> = {
  job_not_found: 404,
  not_awaiting_clarification: 409,
};

// Y a los de autenticación: el login fallido es 401, un usuario que no existe 404 y el cambio de rol
// propio 409 (no encaja con lo que se permite).
const AUTH_STATUS: Record<AuthErrorKind, number> = {
  login_failed: 401,
  user_not_found: 404,
  cannot_change_own_role: 409,
};

// Los errores del lector de JSON (cuerpo mal formado, demasiado grande...) traen un `status` 4xx.
const isClientError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  typeof error.status === 'number' &&
  error.status >= 400 &&
  error.status < 500;

// Solo construye la aplicación: no abre ningún puerto (eso lo hace server.ts). Así los tests la
// usan directamente con supertest. Las rutas son una capa fina: la lógica vive en JobService.
export function createApp({
  jobService,
  authService,
  cookieSecure = false,
  onError,
}: AppDeps): Express {
  const app = express();
  app.use(express.json());

  // Primero se identifica al usuario (si hay cookie válida) y luego cada ruta dice qué permiso exige.
  app.use(authenticate(authService));
  app.use('/auth', authRoutes(authService, { cookieSecure }));

  app.post('/jobs', requirePermission('job:create'), async (req: Request, res: Response) => {
    const body = CreateJobBody.safeParse(req.body);
    if (!body.success) {
      res
        .status(400)
        .json(
          errorBody('invalid_request', 'The body must be a JSON object with a text "issueKey".'),
        );
      return;
    }
    // Si Jira falla, createJob lanza JiraError y lo traduce el manejador de errores de abajo.
    const job = await jobService.createJob(body.data.issueKey, currentUser(res)?.id);
    res.status(202).location(`/jobs/${job.id}`).json(job);
  });

  // La lista para la pantalla de seguimiento: resúmenes, sin intentos ni logs. En un objeto y no en
  // un array suelto para poder añadir datos de paginación sin romper a quien ya la use.
  app.get('/jobs', requirePermission('job:read'), async (_req: Request, res: Response) => {
    res.json({ jobs: await jobService.listJobs() });
  });

  app.get(
    '/jobs/:id',
    requirePermission('job:read'),
    async (req: Request<{ id: string }>, res: Response) => {
      const job = await jobService.getJob(req.params.id);
      if (!job) {
        res.status(404).json(errorBody('job_not_found', 'Job not found.'));
        return;
      }
      res.json(job);
    },
  );

  // El usuario contesta a la pregunta de un job pausado y el agente se reanuda (RF-9).
  app.post(
    '/jobs/:id/clarify',
    requirePermission('job:clarify'),
    async (req: Request<{ id: string }>, res: Response) => {
      const body = ClarifyBody.safeParse(req.body);
      if (!body.success) {
        res
          .status(400)
          .json(
            errorBody(
              'invalid_request',
              `The body must be a JSON object with a text "answer" (1 to ${MAX_ANSWER_LENGTH} characters).`,
            ),
          );
        return;
      }
      const job = await jobService.clarify(req.params.id, body.data.answer);
      res.status(202).json(job);
    },
  );

  // Administración (US-12, versión simple): solo Admin. Aquí se ve y se cambia el rol de cada usuario.
  app.get('/admin/users', requirePermission('admin:manage'), async (_req, res: Response) => {
    const users = await authService.listUsers();
    res.json({
      users: users.map((user) => ({ ...toPublicUser(user), createdAt: user.createdAt })),
    });
  });

  app.patch(
    '/admin/users/:id/role',
    requirePermission('admin:manage'),
    async (req: Request<{ id: string }>, res: Response) => {
      const body = RoleBody.safeParse(req.body);
      if (!body.success) {
        res
          .status(400)
          .json(
            errorBody('invalid_request', `The body must be {"role": one of ${ROLES.join(', ')}}.`),
          );
        return;
      }
      const actor = currentUser(res);
      const user = await authService.changeRole(actor?.id ?? '', req.params.id, body.data.role);
      res.json({ user: toPublicUser(user) });
    },
  );

  // Express 5 manda aquí tanto los errores normales como los rechazos de las rutas `async`.
  // Lleva 4 parámetros a propósito: así Express sabe que es un manejador de errores.
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof JiraError) {
      res.status(JIRA_STATUS[error.kind]).json(errorBody(error.kind, error.message));
      return;
    }
    if (error instanceof JobError) {
      res.status(JOB_STATUS[error.kind]).json(errorBody(error.kind, error.message));
      return;
    }
    if (error instanceof AuthError) {
      res.status(AUTH_STATUS[error.kind]).json(errorBody(error.kind, error.message));
      return;
    }
    if (isClientError(error)) {
      res.status(400).json(errorBody('invalid_request', 'The request body could not be read.'));
      return;
    }
    // Cualquier otra cosa es un fallo nuestro: el detalle va al log, no al cliente (US-04.6).
    onError?.(error);
    res.status(500).json(errorBody('internal_error', 'Internal server error.'));
  });

  return app;
}
