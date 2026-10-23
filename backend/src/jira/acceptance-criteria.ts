export interface SplitStory {
  description: string;
  acceptanceCriteria: string | null;
}

// Una cabecera de criterios ocupa SU PROPIA línea. Se tolera: decoración al principio (# de Markdown,
// h2. de Jira, * o _ de negrita/cursiva), con o sin tilde, en español o inglés, y dos puntos al final
// con texto opcional detrás. Lo que NO se acepta: la frase seguida de más palabras ("...están en otro
// documento"), para no cortar una historia por mencionar esas palabras en mitad de una frase.
const HEADING =
  /^[ \t]*(?:#{1,6}[ \t]+|h[1-6]\.[ \t]+)?[*_]{0,3}[ \t]*(?:criterios?\s+de\s+aceptaci[oó]n|acceptance\s+criteria)[ \t]*[*_]{0,3}[ \t]*(?::[ \t]*[*_]{0,3}[ \t]*(.*))?$/i;

// US-03.1 / US-03.3: separa la descripción de los criterios de aceptación. Los criterios llegan
// hasta el final del texto (limitación conocida: un apartado posterior, como "Notas:", se mezclaría).
export function splitAcceptanceCriteria(text: string): SplitStory {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const index = lines.findIndex((line) => HEADING.test(line));
  if (index === -1) return { description: lines.join('\n').trim(), acceptanceCriteria: null };

  // Texto escrito en la misma línea que la cabecera ("Criterios de aceptación: Dado un...").
  const inline = HEADING.exec(lines[index] ?? '')?.[1] ?? '';
  const criteria = [inline, ...lines.slice(index + 1)].join('\n').trim();
  return {
    description: lines.slice(0, index).join('\n').trim(),
    acceptanceCriteria: criteria === '' ? null : criteria,
  };
}
