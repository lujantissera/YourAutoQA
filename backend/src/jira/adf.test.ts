import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { splitAcceptanceCriteria } from './acceptance-criteria.js';
import { adfToText } from './adf.js';

// Pequeños constructores para escribir los árboles ADF sin ruido.
const text = (value: string) => ({ type: 'text', text: value });
const paragraph = (...content: unknown[]) => ({ type: 'paragraph', content });
const doc = (...content: unknown[]) => ({ type: 'doc', version: 1, content });
const listItem = (...content: unknown[]) => ({ type: 'listItem', content });

// Respuestas reales de Jira (sanitizadas): ver fixtures/.
const fixture = (name: string): { fields: { description: unknown } } =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));

describe('adfToText (US-03.1)', () => {
  it.each([null, undefined, 42, 'texto suelto', {}, [], { type: 'doc' }])(
    'devuelve cadena vacía si la entrada no es un documento: %j',
    (input) => {
      expect(adfToText(input)).toBe('');
    },
  );

  it('devuelve cadena vacía para un documento sin contenido', () => {
    expect(adfToText(doc())).toBe('');
  });

  it('convierte un párrafo en su texto', () => {
    expect(adfToText(doc(paragraph(text('Como cliente quiero entrar.'))))).toBe(
      'Como cliente quiero entrar.',
    );
  });

  it('separa los párrafos con una línea en blanco', () => {
    expect(adfToText(doc(paragraph(text('Uno.')), paragraph(text('Dos.'))))).toBe('Uno.\n\nDos.');
  });

  it('convierte hardBreak en un salto de línea', () => {
    const input = doc(paragraph(text('Dado A'), { type: 'hardBreak' }, text('Cuando B')));

    expect(adfToText(input)).toBe('Dado A\nCuando B');
  });

  it('trata un encabezado como un párrafo más', () => {
    const input = doc(
      { type: 'heading', attrs: { level: 2 }, content: [text('Título')] },
      paragraph(text('Cuerpo.')),
    );

    expect(adfToText(input)).toBe('Título\n\nCuerpo.');
  });

  it('convierte una lista con viñetas', () => {
    const input = doc({
      type: 'bulletList',
      content: [listItem(paragraph(text('uno'))), listItem(paragraph(text('dos')))],
    });

    expect(adfToText(input)).toBe('- uno\n- dos');
  });

  it('convierte una lista numerada', () => {
    const input = doc({
      type: 'orderedList',
      content: [listItem(paragraph(text('uno'))), listItem(paragraph(text('dos')))],
    });

    expect(adfToText(input)).toBe('1. uno\n2. dos');
  });

  it('indenta 2 espacios las listas anidadas', () => {
    const input = doc({
      type: 'bulletList',
      content: [
        listItem(paragraph(text('a')), {
          type: 'bulletList',
          content: [listItem(paragraph(text('a1')))],
        }),
        listItem(paragraph(text('b'))),
      ],
    });

    expect(adfToText(input)).toBe('- a\n  - a1\n- b');
  });

  it('conserva las líneas de un bloque de código', () => {
    const input = doc({ type: 'codeBlock', content: [text('x = 1\ny = 2')] });

    expect(adfToText(input)).toBe('x = 1\ny = 2');
  });

  it('ignora los formatos y se queda con el texto', () => {
    const input = doc(
      paragraph({ type: 'text', text: 'negrita', marks: [{ type: 'strong' }] }, text(' y '), {
        type: 'text',
        text: 'enlace',
        marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
      }),
    );

    expect(adfToText(input)).toBe('negrita y enlace');
  });

  it('convierte menciones, emojis y tarjetas en su texto', () => {
    const input = doc(
      paragraph(
        { type: 'mention', attrs: { id: 'abc', text: '@Lujan' } },
        text(' '),
        { type: 'emoji', attrs: { shortName: ':smile:', text: '😄' } },
        text(' '),
        { type: 'inlineCard', attrs: { url: 'https://example.com/doc' } },
      ),
    );

    expect(adfToText(input)).toBe('@Lujan 😄 https://example.com/doc');
  });

  it('convierte una tabla en una línea por fila, con las celdas separadas por " | "', () => {
    const cell = (value: string) => ({
      type: 'tableCell',
      content: [paragraph(text(value))],
    });
    const input = doc({
      type: 'table',
      content: [
        { type: 'tableRow', content: [cell('A'), cell('B')] },
        { type: 'tableRow', content: [cell('C'), cell('D')] },
      ],
    });

    expect(adfToText(input)).toBe('A | B\nC | D');
  });

  it('usa el texto de los hijos de un nodo desconocido y descarta los que no tienen', () => {
    const input = doc(
      paragraph(text('Antes.')),
      { type: 'media', attrs: { id: 'imagen' } },
      { type: 'panel', content: [paragraph(text('Aviso.'))] },
      paragraph(text('Después.')),
    );

    expect(adfToText(input)).toBe('Antes.\n\nAviso.\n\nDespués.');
  });
});

describe('adfToText + splitAcceptanceCriteria sobre historias reales', () => {
  it('YAQ-1: separa la descripción y los criterios (US-03.1)', () => {
    const story = splitAcceptanceCriteria(adfToText(fixture('yaq-1').fields.description));

    expect(story).toEqual({
      description:
        'Como usuario registrado quiero iniciar sesión en la tienda web con el usuario standard_user y la contraseña secret_sauce para acceder al catálogo de productos.',
      acceptanceCriteria: [
        'Dado un usuario que está en la página de inicio de sesión',
        'Cuando introduce el usuario standard_user y la contraseña secret_sauce y pulsa el botón de login',
        'Entonces se muestra la página de productos con el título "Products"',
      ].join('\n'),
    });
  });

  it('YAQ-2: sin criterios, toda la descripción se conserva (US-03.3)', () => {
    const story = splitAcceptanceCriteria(adfToText(fixture('yaq-2').fields.description));

    expect(story).toEqual({
      description:
        'Como cliente quiero añadir la mochila "Sauce Labs Backpack" al carrito para comprarla. Inicio sesión con standard_user / secret_sauce.',
      acceptanceCriteria: null,
    });
  });
});
