import { describe, expect, it } from 'vitest';
import { loadAgentConfig, type AgentConfig } from './config.js';

describe('loadAgentConfig (RNF-1, RNF-2, D-22, D-40, D-42)', () => {
  it('sin variables, usa los valores por defecto', () => {
    expect(loadAgentConfig({})).toEqual({
      maxAttempts: 5,
      maxTokens: 50_000,
      executionTimeoutSeconds: 120,
      maxClarifications: 3,
      storyCheck: true,
    });
  });

  it('lee los valores del entorno, convirtiendo el texto en números', () => {
    const env = {
      MAX_ATTEMPTS: '3',
      MAX_TOKENS: '20000',
      EXECUTION_TIMEOUT_SECONDS: '60',
      MAX_CLARIFICATIONS: '1',
    };

    expect(loadAgentConfig(env)).toEqual({
      maxAttempts: 3,
      maxTokens: 20_000,
      executionTimeoutSeconds: 60,
      maxClarifications: 1,
      storyCheck: true,
    });
  });

  // Un valor mal escrito no debe romper el arranque ni dejar el agente sin límite: se usa el
  // valor por defecto (el mismo comportamiento que ya tenía try-agent).
  it.each<[string, keyof AgentConfig, number]>([
    ['MAX_ATTEMPTS', 'maxAttempts', 5],
    ['MAX_TOKENS', 'maxTokens', 50_000],
    ['EXECUTION_TIMEOUT_SECONDS', 'executionTimeoutSeconds', 120],
    ['MAX_CLARIFICATIONS', 'maxClarifications', 3],
  ])(
    '%s con un valor inválido (texto, 0, negativo, vacío) vuelve a su valor por defecto',
    (name, field, fallback) => {
      for (const invalid of ['abc', '0', '-5', '', '   ', 'Infinity']) {
        expect(loadAgentConfig({ [name]: invalid })[field]).toBe(fallback);
      }
    },
  );

  it.each([
    ['false', false],
    ['true', true],
    ['0', true],
    ['', true],
  ])('STORY_CHECK=%j da storyCheck=%s (solo "false" lo desactiva)', (value, expected) => {
    expect(loadAgentConfig({ STORY_CHECK: value }).storyCheck).toBe(expected);
  });
});
