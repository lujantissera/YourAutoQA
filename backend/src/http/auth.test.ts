import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildGraph } from '../agent/graph.js';
import type { UserStory } from '../agent/ports.js';
import { FakeLlm, FakeRunner } from '../agent/testing/fakes.js';
import { AuthService } from '../auth/auth-service.js';
import { InMemoryAuthRepository } from '../auth/in-memory-auth-repository.js';
import type { Role } from '../auth/roles.js';
import { FakeAtlassian } from '../auth/testing/fakes.js';
import type { ExternalProfile } from '../auth/user.js';
import { FakeJira } from '../jira/testing/fakes.js';
import { InMemoryJobRepository } from '../jobs/in-memory-job-repository.js';
import { JobService } from '../jobs/job-service.js';
import { createApp } from './app.js';
import { SESSION_COOKIE, STATE_COOKIE } from './cookies.js';

const story: UserStory = {
  key: 'YAQ-1',
  summary: 'Iniciar sesión con credenciales válidas',
  description: 'Como usuario quiero iniciar sesión.',
  acceptanceCriteria: 'Dado un usuario\nEntonces ve la página de productos',
};

const profile = (id: string): ExternalProfile => ({
  provider: 'atlassian',
  providerAccountId: id,
  email: `${id}@x.com`,
  displayName: id,
  avatarUrl: null,
});

function setup(options: { cookieSecure?: boolean } = {}) {
  const repository = new InMemoryAuthRepository();
  const jira = new FakeJira({ 'YAQ-1': story });
  const authService = new AuthService({
    repository,
    atlassian: new FakeAtlassian({
      'code-ana': profile('ana'),
      'code-bob': profile('bob'),
    }),
    sessionTtlHours: 12,
    adminEmails: [],
  });
  const jobService = new JobService({
    jira,
    repository: new InMemoryJobRepository(),
    graph: buildGraph({
      llm: new FakeLlm(['*** Test Cases ***\nTest 1']),
      runner: new FakeRunner([{ result: 'PASS', logs: 'ok', timedOut: false }]),
      config: {
        maxAttempts: 5,
        maxTokens: 50_000,
        executionTimeoutSeconds: 120,
        maxClarifications: 3,
        storyCheck: false,
      },
    }),
  });
  const app = createApp({ jobService, authService, cookieSecure: options.cookieSecure });

  // Abre una sesión con el rol pedido y devuelve la cabecera Cookie lista para usar.
  const loginAs = async (code: string, role: Role): Promise<{ cookie: string; userId: string }> => {
    const { token, user } = await authService.completeLogin(code);
    await repository.setRole(user.id, role);
    return { cookie: `${SESSION_COOKIE}=${token}`, userId: user.id };
  };
  return { app, jira, loginAs };
}

const cookiesOf = (res: request.Response): string[] => {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  return header === undefined ? [] : Array.isArray(header) ? header : [header];
};
const findCookie = (res: request.Response, name: string): string | undefined =>
  cookiesOf(res).find((cookie) => cookie.startsWith(`${name}=`));
const valueOf = (cookie: string): string => cookie.split(';')[0]!.split('=')[1]!;

describe('login con Atlassian', () => {
  it('GET /auth/login redirige a Atlassian y guarda el state en una cookie httpOnly', async () => {
    const { app } = setup();
    const res = await request(app).get('/auth/login');

    expect(res.status).toBe(302);
    const stateCookie = findCookie(res, STATE_COOKIE)!;
    expect(stateCookie).toMatch(/HttpOnly/i);
    expect(stateCookie).toMatch(/SameSite=Lax/i);
    expect(res.headers.location).toBe(
      `https://fake.atlassian.test/authorize?state=${valueOf(stateCookie)}`,
    );
  });

  it('el callback con código y state correctos abre sesión (cookie httpOnly) y vuelve a la home', async () => {
    const { app } = setup();
    const login = await request(app).get('/auth/login');
    const state = valueOf(findCookie(login, STATE_COOKIE)!);

    const res = await request(app)
      .get('/auth/callback')
      .query({ code: 'code-ana', state })
      .set('Cookie', `${STATE_COOKIE}=${state}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');
    const session = findCookie(res, SESSION_COOKIE)!;
    expect(session).toMatch(/HttpOnly/i);
    expect(session).toMatch(/SameSite=Lax/i);
    expect(session).toMatch(/Max-Age=43200/);
    expect(session).not.toMatch(/Secure/i);
    // La cookie del state ya no hace falta: se borra.
    expect(findCookie(res, STATE_COOKIE)).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
  });

  it('con cookieSecure la cookie de sesión lleva Secure', async () => {
    const { app } = setup({ cookieSecure: true });
    const res = await request(app)
      .get('/auth/callback')
      .query({ code: 'code-ana', state: 's' })
      .set('Cookie', `${STATE_COOKIE}=s`);
    expect(findCookie(res, SESSION_COOKIE)).toMatch(/Secure/i);
  });

  it('si el state no coincide (o no hay cookie) el login se rechaza y no hay sesión', async () => {
    const { app } = setup();
    for (const cookie of [`${STATE_COOKIE}=otro`, undefined]) {
      const req = request(app).get('/auth/callback').query({ code: 'code-ana', state: 'abc' });
      const res = await (cookie ? req.set('Cookie', cookie) : req);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/login?error=state');
      expect(findCookie(res, SESSION_COOKIE)).toBeUndefined();
    }
  });

  it('si el usuario cancela en Atlassian vuelve al login con un aviso (US-01.4)', async () => {
    const { app } = setup();
    const res = await request(app)
      .get('/auth/callback')
      .query({ error: 'access_denied', state: 's' })
      .set('Cookie', `${STATE_COOKIE}=s`);
    expect(res.headers.location).toBe('/login?error=cancelled');
    expect(findCookie(res, SESSION_COOKIE)).toBeUndefined();
  });

  it('si Atlassian rechaza el código vuelve al login con un error genérico', async () => {
    const { app } = setup();
    const res = await request(app)
      .get('/auth/callback')
      .query({ code: 'code-malo', state: 's' })
      .set('Cookie', `${STATE_COOKIE}=s`);
    expect(res.headers.location).toBe('/login?error=failed');
    expect(findCookie(res, SESSION_COOKIE)).toBeUndefined();
  });

  it('un callback sin código tampoco abre sesión', async () => {
    const { app } = setup();
    const res = await request(app)
      .get('/auth/callback')
      .query({ state: 's' })
      .set('Cookie', `${STATE_COOKIE}=s`);
    expect(res.headers.location).toBe('/login?error=failed');
  });
});

describe('GET /auth/me', () => {
  it('sin sesión responde 401 (US-01.5)', async () => {
    const { app } = setup();
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: 'unauthorized', message: 'You must sign in.' },
    });
  });

  it('con sesión devuelve el usuario, su rol y los permisos que ese rol tiene', async () => {
    const { app, loginAs } = setup();
    const { cookie } = await loginAs('code-ana', 'QA Controller');

    const res = await request(app).get('/auth/me').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'ana@x.com', role: 'QA Controller' });
    expect(res.body.permissions).toEqual(['job:read', 'job:create', 'job:clarify']);
  });

  it('una cookie con un token inventado es 401', async () => {
    const { app } = setup();
    const res = await request(app).get('/auth/me').set('Cookie', `${SESSION_COOKIE}=inventado`);
    expect(res.status).toBe(401);
  });

  it('no filtra el token ni el hash: solo datos públicos del usuario', async () => {
    const { app, loginAs } = setup();
    const { cookie } = await loginAs('code-ana', 'Admin');
    const res = await request(app).get('/auth/me').set('Cookie', cookie);
    expect(Object.keys(res.body.user).sort()).toEqual(
      ['avatarUrl', 'displayName', 'email', 'id', 'role'].sort(),
    );
  });
});

describe('POST /auth/logout', () => {
  it('cierra la sesión: borra la cookie y el token deja de valer', async () => {
    const { app, loginAs } = setup();
    const { cookie } = await loginAs('code-ana', 'QA Executer');

    const res = await request(app).post('/auth/logout').set('Cookie', cookie);

    expect(res.status).toBe(204);
    expect(findCookie(res, SESSION_COOKIE)).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    expect((await request(app).get('/auth/me').set('Cookie', cookie)).status).toBe(401);
  });

  it('sin sesión también responde 204 (cerrar dos veces no es un error)', async () => {
    const { app } = setup();
    expect((await request(app).post('/auth/logout')).status).toBe(204);
  });
});

describe('permisos por rol en la API (US-02.5)', () => {
  it('sin sesión, todas las rutas de jobs y de administración responden 401', async () => {
    const { app } = setup();
    for (const [method, url] of [
      ['get', '/jobs'],
      ['post', '/jobs'],
      ['get', '/jobs/abc'],
      ['post', '/jobs/abc/clarify'],
      ['get', '/admin/users'],
      ['patch', '/admin/users/abc/role'],
    ] as const) {
      const res = await request(app)[method](url).send({});
      expect(res.status, `${method} ${url}`).toBe(401);
    }
  });

  describe('QA Executer (solo lectura)', () => {
    it('puede ver la lista y el detalle', async () => {
      const { app, loginAs } = setup();
      const { cookie } = await loginAs('code-ana', 'QA Executer');
      expect((await request(app).get('/jobs').set('Cookie', cookie)).status).toBe(200);
      expect((await request(app).get('/jobs/no-existe').set('Cookie', cookie)).status).toBe(404);
    });

    it('recibe 403 al crear un job y NO se llama a Jira ni se crea nada', async () => {
      const { app, jira, loginAs } = setup();
      const { cookie } = await loginAs('code-ana', 'QA Executer');

      const res = await request(app)
        .post('/jobs')
        .set('Cookie', cookie)
        .send({ issueKey: 'YAQ-1' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('forbidden');
      expect(jira.calls).toEqual([]);
      expect((await request(app).get('/jobs').set('Cookie', cookie)).body.jobs).toEqual([]);
    });

    it('recibe 403 al responder al agente', async () => {
      const { app, loginAs } = setup();
      const { cookie } = await loginAs('code-ana', 'QA Executer');
      const res = await request(app)
        .post('/jobs/abc/clarify')
        .set('Cookie', cookie)
        .send({ answer: 'hola' });
      expect(res.status).toBe(403);
    });

    it('recibe 403 en Administración', async () => {
      const { app, loginAs } = setup();
      const { cookie } = await loginAs('code-ana', 'QA Executer');
      expect((await request(app).get('/admin/users').set('Cookie', cookie)).status).toBe(403);
    });
  });

  describe('QA Controller', () => {
    it('puede crear un job', async () => {
      const { app, loginAs } = setup();
      const { cookie } = await loginAs('code-ana', 'QA Controller');
      const res = await request(app)
        .post('/jobs')
        .set('Cookie', cookie)
        .send({ issueKey: 'YAQ-1' });
      expect(res.status).toBe(202);
    });

    it('recibe 403 en Administración', async () => {
      const { app, loginAs } = setup();
      const { cookie } = await loginAs('code-ana', 'QA Controller');
      expect((await request(app).get('/admin/users').set('Cookie', cookie)).status).toBe(403);
      const res = await request(app)
        .patch('/admin/users/abc/role')
        .set('Cookie', cookie)
        .send({ role: 'Admin' });
      expect(res.status).toBe(403);
    });
  });

  describe('Admin', () => {
    it('puede crear jobs y listar usuarios', async () => {
      const { app, loginAs } = setup();
      const { cookie } = await loginAs('code-ana', 'Admin');
      expect(
        (await request(app).post('/jobs').set('Cookie', cookie).send({ issueKey: 'YAQ-1' })).status,
      ).toBe(202);

      const res = await request(app).get('/admin/users').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.users.map((u: { email: string }) => u.email)).toEqual(['ana@x.com']);
    });

    it('puede cambiar el rol de otro usuario y el cambio se nota enseguida', async () => {
      const { app, loginAs } = setup();
      const admin = await loginAs('code-ana', 'Admin');
      const bob = await loginAs('code-bob', 'QA Executer');
      expect(
        (await request(app).post('/jobs').set('Cookie', bob.cookie).send({ issueKey: 'YAQ-1' }))
          .status,
      ).toBe(403);

      const res = await request(app)
        .patch(`/admin/users/${bob.userId}/role`)
        .set('Cookie', admin.cookie)
        .send({ role: 'QA Controller' });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ email: 'bob@x.com', role: 'QA Controller' });
      // La sesión de Bob ya abierta tiene el rol nuevo, sin volver a entrar.
      expect(
        (await request(app).post('/jobs').set('Cookie', bob.cookie).send({ issueKey: 'YAQ-1' }))
          .status,
      ).toBe(202);
    });

    it('rechaza un rol que no existe (400), el propio usuario (409) y un usuario desconocido (404)', async () => {
      const { app, loginAs } = setup();
      const admin = await loginAs('code-ana', 'Admin');
      const bob = await loginAs('code-bob', 'QA Executer');
      const patch = (id: string, body: unknown) =>
        request(app)
          .patch(`/admin/users/${id}/role`)
          .set('Cookie', admin.cookie)
          .send(body as object);

      expect((await patch(bob.userId, { role: 'Tester' })).status).toBe(400);
      expect((await patch(bob.userId, {})).status).toBe(400);
      expect((await patch(admin.userId, { role: 'QA Executer' })).status).toBe(409);
      expect((await patch('00000000-0000-4000-8000-000000000999', { role: 'Admin' })).status).toBe(
        404,
      );
    });
  });
});
