import { describe, expect, it } from 'vitest';
import { loadJiraConfig } from './config.js';

const validEnv = {
  ATLASSIAN_EMAIL: 'dev@example.com',
  ATLASSIAN_API_TOKEN: 'secret-token-value',
  ATLASSIAN_CLOUD_ID: '11111111-2222-3333-4444-555555555555',
};

describe('loadJiraConfig', () => {
  it('lee el correo, el token y el cloudId, con un timeout por defecto de 10 s', () => {
    expect(loadJiraConfig(validEnv)).toEqual({
      email: 'dev@example.com',
      apiToken: 'secret-token-value',
      cloudId: '11111111-2222-3333-4444-555555555555',
      timeoutMs: 10_000,
    });
  });

  it('recorta los espacios de los valores', () => {
    const env = { ...validEnv, ATLASSIAN_EMAIL: '  dev@example.com  ' };

    expect(loadJiraConfig(env).email).toBe('dev@example.com');
  });

  it('usa JIRA_TIMEOUT_MS cuando está definido', () => {
    expect(loadJiraConfig({ ...validEnv, JIRA_TIMEOUT_MS: '5000' }).timeoutMs).toBe(5000);
  });

  it('falla nombrando TODAS las variables que faltan', () => {
    expect(() => loadJiraConfig({})).toThrow(
      /ATLASSIAN_EMAIL.*ATLASSIAN_API_TOKEN.*ATLASSIAN_CLOUD_ID/s,
    );
  });

  it('trata una variable vacía o solo con espacios como ausente', () => {
    expect(() => loadJiraConfig({ ...validEnv, ATLASSIAN_API_TOKEN: '   ' })).toThrow(
      /ATLASSIAN_API_TOKEN/,
    );
  });

  it('el mensaje de error nunca incluye el valor del token', () => {
    const env = { ATLASSIAN_API_TOKEN: 'secret-token-value' };

    expect(() => loadJiraConfig(env)).toThrow(/ATLASSIAN_EMAIL/);
    expect(() => loadJiraConfig(env)).not.toThrow(/secret-token-value/);
  });

  // El cloudId se inserta en la URL de la petición: solo se acepta el formato UUID.
  it.each(['no-es-un-uuid', '../otra-ruta', '11111111-2222-3333-4444-55555555555/x'])(
    'rechaza un ATLASSIAN_CLOUD_ID con formato no válido: %j',
    (cloudId) => {
      expect(() => loadJiraConfig({ ...validEnv, ATLASSIAN_CLOUD_ID: cloudId })).toThrow(
        /ATLASSIAN_CLOUD_ID/,
      );
    },
  );

  it.each(['abc', '0', '-5', '1.5'])(
    'rechaza un JIRA_TIMEOUT_MS que no es un entero positivo: %j',
    (timeout) => {
      expect(() => loadJiraConfig({ ...validEnv, JIRA_TIMEOUT_MS: timeout })).toThrow(
        /JIRA_TIMEOUT_MS/,
      );
    },
  );
});
