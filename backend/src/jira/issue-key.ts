import { JiraError } from './errors.js';

// Clave de incidencia de Jira: PROYECTO-NÚMERO.
//  - Proyecto: empieza por una letra; de 2 a 10 caracteres entre letras, dígitos y guion bajo.
//  - Número: entero positivo sin ceros a la izquierda (Jira numera desde 1), hasta 9 dígitos.
// Se valida el texto TAL CUAL llega (solo ASCII) y se pasa a mayúsculas al final: así un carácter
// raro que al cambiar de mayúsculas se convirtiera en una letra normal no podría colarse.
const ISSUE_KEY = /^[A-Za-z][A-Za-z0-9_]{1,9}-[1-9]\d{0,8}$/;

// US-03.4: el ID se comprueba ANTES de llamar a Jira. Devuelve la clave normalizada
// (sin espacios en los extremos y en mayúsculas) o lanza un JiraError 'invalid_key'.
export function parseIssueKey(input: string): string {
  const trimmed = input.trim();
  if (!ISSUE_KEY.test(trimmed)) {
    throw new JiraError('invalid_key', 'Invalid issue key. Use the format PROJ-123.');
  }
  return trimmed.toUpperCase();
}
