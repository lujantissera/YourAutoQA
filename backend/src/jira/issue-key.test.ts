import { describe, expect, it } from 'vitest';
import { JiraError } from './errors.js';
import { parseIssueKey } from './issue-key.js';

// Captura el error que lanza parseIssueKey (o undefined si no lanza ninguno).
function failureOf(input: string): unknown {
  try {
    parseIssueKey(input);
  } catch (error) {
    return error;
  }
  return undefined;
}

describe('parseIssueKey (US-03.4)', () => {
  it.each([
    ['YAQ-1', 'YAQ-1'],
    ['YAQ-1234', 'YAQ-1234'],
    ['  YAQ-1 \n', 'YAQ-1'],
    ['yaq-12', 'YAQ-12'],
    ['A1_B-5', 'A1_B-5'],
  ])('acepta %j y lo normaliza a %j', (input, expected) => {
    expect(parseIssueKey(input)).toBe(expected);
  });

  it.each([
    '',
    '   ',
    'YAQ-',
    'YAQ1',
    '-1',
    'YAQ-0',
    'YAQ-01',
    'YAQ 1',
    'YAQ- 1',
    'YAQ-1 YAQ-2',
    'YAQ-1\nYAQ-2',
    'ABCDEFGHIJK-1',
    '1YAQ-1',
    'YAQ-1; DROP TABLE users',
    'YAQ-1" OR project = X',
    '../etc/passwd',
    'YAQ-1/../../x',
  ])('rechaza %j con un JiraError invalid_key', (input) => {
    expect(failureOf(input)).toBeInstanceOf(JiraError);
    expect(failureOf(input)).toMatchObject({ kind: 'invalid_key' });
  });

  it('el mensaje de error enseña el formato esperado', () => {
    expect(failureOf('nope')).toMatchObject({ message: expect.stringMatching(/PROJ-123/) });
  });
});
