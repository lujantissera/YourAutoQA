import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { JiraConfig } from './config.js';
import { JiraError } from './errors.js';
import { RestJira } from './rest-jira.js';

const config: JiraConfig = {
  email: 'dev@example.com',
  apiToken: 'secret-token-value',
  cloudId: '11111111-2222-3333-4444-555555555555',
  timeoutMs: 10_000,
};

// Respuestas reales de Jira (sanitizadas): ver fixtures/.
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

// Un `fetch` falso que responde siempre lo mismo y deja ver con qué se le llamó.
const fetchReturning = (status: number, body: unknown = {}) =>
  vi.fn<typeof fetch>(
    async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }),
  );

const jiraWith = (fetchFn: typeof fetch) => new RestJira(config, fetchFn);

describe('RestJira.getUserStory (US-03, US-04)', () => {
  it('devuelve la historia con la descripción y los criterios separados (US-03.1)', async () => {
    const jira = jiraWith(fetchReturning(200, fixture('yaq-1')));

    expect(await jira.getUserStory('YAQ-1')).toEqual({
      key: 'YAQ-1',
      summary: 'Iniciar sesión con credenciales válidas',
      description:
        'Como usuario registrado quiero iniciar sesión en la tienda web con el usuario standard_user y la contraseña secret_sauce para acceder al catálogo de productos.',
      acceptanceCriteria: [
        'Dado un usuario que está en la página de inicio de sesión',
        'Cuando introduce el usuario standard_user y la contraseña secret_sauce y pulsa el botón de login',
        'Entonces se muestra la página de productos con el título "Products"',
      ].join('\n'),
    });
  });

  it('pide a Jira la incidencia con la URL, la autenticación y las cabeceras esperadas', async () => {
    const fetchFn = fetchReturning(200, fixture('yaq-1'));

    await jiraWith(fetchFn).getUserStory(' yaq-1 ');

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(
      'https://api.atlassian.com/ex/jira/11111111-2222-3333-4444-555555555555/rest/api/3/issue/YAQ-1?fields=summary,description',
    );
    const basic = Buffer.from('dev@example.com:secret-token-value').toString('base64');
    expect(init?.headers).toEqual({
      Authorization: `Basic ${basic}`,
      Accept: 'application/json',
    });
  });

  it('una historia sin criterios los devuelve a null (US-03.3)', async () => {
    const jira = jiraWith(fetchReturning(200, fixture('yaq-2')));

    const story = await jira.getUserStory('YAQ-2');

    expect(story.acceptanceCriteria).toBeNull();
    expect(story.description).toContain('Sauce Labs Backpack');
  });

  it('una descripción vacía (null) da descripción "" y criterios null', async () => {
    const body = { key: 'YAQ-4', fields: { summary: 'Sin descripción', description: null } };

    expect(await jiraWith(fetchReturning(200, body)).getUserStory('YAQ-4')).toEqual({
      key: 'YAQ-4',
      summary: 'Sin descripción',
      description: '',
      acceptanceCriteria: null,
    });
  });

  it('rechaza una clave no válida sin llamar a Jira (US-04.4)', async () => {
    const fetchFn = fetchReturning(200, fixture('yaq-1'));

    await expect(jiraWith(fetchFn).getUserStory('no es una clave')).rejects.toMatchObject({
      name: 'JiraError',
      kind: 'invalid_key',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('404: la incidencia no existe o no se puede ver (US-04.1)', async () => {
    const jira = jiraWith(fetchReturning(404, { errorMessages: ['No existe'] }));

    await expect(jira.getUserStory('YAQ-999')).rejects.toMatchObject({
      name: 'JiraError',
      kind: 'not_found',
    });
  });

  it.each([401, 403])('%i: credenciales rechazadas o sin permiso (US-04.2)', async (status) => {
    const jira = jiraWith(fetchReturning(status));

    await expect(jira.getUserStory('YAQ-1')).rejects.toMatchObject({
      name: 'JiraError',
      kind: 'forbidden',
    });
  });

  it.each([429, 500, 502, 503])('%i: Jira no está disponible (US-04.3)', async (status) => {
    const jira = jiraWith(fetchReturning(status));

    await expect(jira.getUserStory('YAQ-1')).rejects.toMatchObject({
      name: 'JiraError',
      kind: 'unavailable',
    });
  });

  it('si la red falla, es "no disponible" y se conserva el error original en cause', async () => {
    const networkError = new TypeError('fetch failed');
    const jira = jiraWith(vi.fn<typeof fetch>().mockRejectedValue(networkError));

    await expect(jira.getUserStory('YAQ-1')).rejects.toMatchObject({
      name: 'JiraError',
      kind: 'unavailable',
      cause: networkError,
    });
  });

  it('pasa a fetch una señal de timeout y, si salta, es "no disponible"', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(timeout);

    await expect(jiraWith(fetchFn).getUserStory('YAQ-1')).rejects.toMatchObject({
      kind: 'unavailable',
    });
    expect(fetchFn.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ['un cuerpo que no es JSON', 'esto no es JSON'],
    ['un JSON sin "fields"', { key: 'YAQ-1' }],
    ['un resumen que no es texto', { key: 'YAQ-1', fields: { summary: 42, description: null } }],
  ])('200 con %s: es "no disponible"', async (_label, body) => {
    const jira = jiraWith(fetchReturning(200, body));

    await expect(jira.getUserStory('YAQ-1')).rejects.toMatchObject({
      name: 'JiraError',
      kind: 'unavailable',
    });
  });

  // US-04.6: los mensajes son nuestros y limpios, sin secretos ni detalles internos de Jira.
  it.each([401, 403, 404, 429, 500])(
    'el mensaje de error con HTTP %i no incluye el token, el cloudId ni la URL',
    async (status) => {
      const jira = jiraWith(fetchReturning(status, { detail: 'secret-token-value' }));

      const error = await jira.getUserStory('YAQ-1').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(JiraError);
      const { message } = error as JiraError;
      expect(message).not.toContain('secret-token-value');
      expect(message).not.toContain(config.cloudId);
      expect(message).not.toContain('api.atlassian.com');
    },
  );
});
