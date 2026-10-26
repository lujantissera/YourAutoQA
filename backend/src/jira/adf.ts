// Jira Cloud devuelve la descripción en ADF (Atlassian Document Format): un árbol JSON de nodos
// (doc → paragraph → text...). Aquí se convierte a texto plano para que `splitAcceptanceCriteria`
// y el LLM lo lean. La entrada viene de una API externa, así que es `unknown` y nunca lanza.

interface AdfNode {
  type?: unknown;
  text?: unknown;
  content?: unknown;
  attrs?: unknown;
}

const isNode = (value: unknown): value is AdfNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const childrenOf = (node: AdfNode): AdfNode[] =>
  Array.isArray(node.content) ? node.content.filter(isNode) : [];

// Un atributo de texto del nodo (p. ej. `attrs.url`), o undefined si no existe.
const textAttr = (node: AdfNode, key: string): string | undefined => {
  const value = isNode(node.attrs) ? (node.attrs as Record<string, unknown>)[key] : undefined;
  return typeof value === 'string' ? value : undefined;
};

// Contenido en línea: texto, saltos de línea, menciones, emojis y tarjetas. Los formatos
// (negrita, enlace...) viven en `marks` y se ignoran: se queda solo el texto.
const inlineText = (nodes: AdfNode[]): string =>
  nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return typeof node.text === 'string' ? node.text : '';
        case 'hardBreak':
          return '\n';
        case 'mention':
          return textAttr(node, 'text') ?? '';
        case 'emoji':
          return textAttr(node, 'text') ?? textAttr(node, 'shortName') ?? '';
        case 'inlineCard':
          return textAttr(node, 'url') ?? '';
        default:
          return inlineText(childrenOf(node));
      }
    })
    .join('');

// Los bloques se separan con una línea en blanco; los vacíos (imágenes, etc.) se descartan.
const blocksText = (nodes: AdfNode[]): string =>
  nodes
    .map(blockText)
    .filter((text) => text !== '')
    .join('\n\n');

const isList = (node: AdfNode): boolean =>
  node.type === 'bulletList' || node.type === 'orderedList';

// Una línea por elemento ("- a" o "1. a"); las listas anidadas se indentan 2 espacios por nivel.
const listLines = (list: AdfNode, depth: number): string[] => {
  const padding = '  '.repeat(depth);
  const ordered = list.type === 'orderedList';
  const lines: string[] = [];

  childrenOf(list).forEach((item, index) => {
    const marker = ordered ? `${index + 1}.` : '-';
    let isFirstLine = true;
    for (const child of childrenOf(item)) {
      if (isList(child)) {
        lines.push(...listLines(child, depth + 1));
        continue;
      }
      for (const line of blockText(child).split('\n')) {
        if (line === '') continue;
        lines.push(isFirstLine ? `${padding}${marker} ${line}` : `${padding}  ${line}`);
        isFirstLine = false;
      }
    }
  });
  return lines;
};

// Una línea por fila, con las celdas separadas por " | ".
const tableText = (table: AdfNode): string =>
  childrenOf(table)
    .map((row) =>
      childrenOf(row)
        .map((cell) => blocksText(childrenOf(cell)).replace(/\s*\n+\s*/g, ' '))
        .join(' | '),
    )
    .join('\n');

function blockText(node: AdfNode): string {
  switch (node.type) {
    case 'paragraph':
    case 'heading':
    case 'codeBlock':
      return inlineText(childrenOf(node));
    case 'bulletList':
    case 'orderedList':
      return listLines(node, 0).join('\n');
    case 'table':
      return tableText(node);
    default:
      // Nodo que no conocemos (panel, cita...): se usa el texto de sus hijos; sin hijos, nada.
      return blocksText(childrenOf(node));
  }
}

export function adfToText(input: unknown): string {
  if (!isNode(input) || input.type !== 'doc') return '';
  return blocksText(childrenOf(input));
}
