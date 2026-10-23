import { describe, expect, it } from 'vitest';
import { splitAcceptanceCriteria } from './acceptance-criteria.js';

// Textos de Jira escritos a mano: con erratas, espacios sobrantes y comillas tipográficas.
// Se construyen con join('\n') para que los espacios al final de línea no dependan del editor.
const amazonStory = [
  'El buscador de amazondebe funcionar correctamente en la busqueda de un monitor Samsung. ',
  '',
  'Criterios de aceptacion: ',
  '',
  'Dado un usuario que esta en el buscador de amazon',
  '',
  'Cuando ingrese en texto “Samsung monitor 32 “',
  '',
  'entocnes deben apareces varias opciones de monitores',
].join('\n');

const loginStory = [
  'Como usuario registrado quiero iniciar sesión en la tienda web con el usuario standard_user y la contraseña secret_sauce para acceder al catálogo de productos.',
  '',
  'Criterios de aceptación:',
  '',
  'Dado un usuario que está en la página de inicio de sesión',
  'Cuando introduce el usuario standard_user y la contraseña secret_sauce y pulsa el botón de login',
  'Entonces se muestra la página de productos con el título "Products"',
].join('\n');

// Un texto con una cabecera dada, para probar distintas formas de escribirla.
const withHeading = (heading: string): string =>
  `Texto previo.\n\n${heading}\n\nDado X\nEntonces Y`;

const expectedSplit = {
  description: 'Texto previo.',
  acceptanceCriteria: 'Dado X\nEntonces Y',
};

describe('splitAcceptanceCriteria (US-03.1, US-03.3)', () => {
  it('separa un texto real con erratas, espacios sobrantes y comillas tipográficas', () => {
    expect(splitAcceptanceCriteria(amazonStory)).toEqual({
      description:
        'El buscador de amazondebe funcionar correctamente en la busqueda de un monitor Samsung.',
      acceptanceCriteria: [
        'Dado un usuario que esta en el buscador de amazon',
        '',
        'Cuando ingrese en texto “Samsung monitor 32 “',
        '',
        'entocnes deben apareces varias opciones de monitores',
      ].join('\n'),
    });
  });

  it('separa la historia de login tal como está en YAQ-1', () => {
    expect(splitAcceptanceCriteria(loginStory)).toEqual({
      description:
        'Como usuario registrado quiero iniciar sesión en la tienda web con el usuario standard_user y la contraseña secret_sauce para acceder al catálogo de productos.',
      acceptanceCriteria: [
        'Dado un usuario que está en la página de inicio de sesión',
        'Cuando introduce el usuario standard_user y la contraseña secret_sauce y pulsa el botón de login',
        'Entonces se muestra la página de productos con el título "Products"',
      ].join('\n'),
    });
  });

  it.each([
    'Criterios de aceptación',
    'criterios de aceptacion:',
    'CRITERIOS DE ACEPTACIÓN',
    'Criterio de aceptación:',
  ])('reconoce la cabecera en español %j (con o sin tilde, dos puntos o mayúsculas)', (heading) => {
    expect(splitAcceptanceCriteria(withHeading(heading))).toEqual(expectedSplit);
  });

  it.each(['Acceptance criteria', 'Acceptance Criteria:'])(
    'reconoce la cabecera en inglés %j',
    (heading) => {
      expect(splitAcceptanceCriteria(withHeading(heading))).toEqual(expectedSplit);
    },
  );

  it.each([
    '## Criterios de aceptación',
    '**Criterios de aceptación**',
    '**Criterios de aceptación:**',
    '*Criterios de aceptación*',
    'h2. Criterios de aceptación',
  ])('reconoce la cabecera con decoración %j (Markdown o formato de Jira)', (heading) => {
    expect(splitAcceptanceCriteria(withHeading(heading))).toEqual(expectedSplit);
  });

  it('si no hay apartado de criterios, devuelve null y la descripción completa (US-03.3)', () => {
    const text = 'Como cliente quiero añadir la mochila al carrito para comprarla.';

    expect(splitAcceptanceCriteria(text)).toEqual({ description: text, acceptanceCriteria: null });
  });

  it('si el apartado existe pero está vacío, los criterios son null', () => {
    expect(splitAcceptanceCriteria('Texto previo.\n\nCriterios de aceptación:\n\n')).toEqual({
      description: 'Texto previo.',
      acceptanceCriteria: null,
    });
  });

  it('separa los criterios escritos en la misma línea que la cabecera', () => {
    const text =
      'Texto previo.\n\nCriterios de aceptación: Dado un usuario, cuando entra, entonces ve algo';

    expect(splitAcceptanceCriteria(text)).toEqual({
      description: 'Texto previo.',
      acceptanceCriteria: 'Dado un usuario, cuando entra, entonces ve algo',
    });
  });

  it('funciona con saltos de línea de Windows (\\r\\n) y los normaliza a \\n', () => {
    const text = 'Texto previo.\r\n\r\nCriterios de aceptación:\r\n\r\nDado X\r\nEntonces Y';

    expect(splitAcceptanceCriteria(text)).toEqual(expectedSplit);
  });

  it('también separa si el texto empieza directamente por la cabecera', () => {
    expect(splitAcceptanceCriteria('Criterios de aceptación:\nDado X')).toEqual({
      description: '',
      acceptanceCriteria: 'Dado X',
    });
  });

  it.each([
    'Los criterios de aceptación están definidos en otro documento.',
    'Criterios de aceptación están en otro documento.',
    'Revisa los criterios de aceptación del cliente.',
  ])('no confunde una frase con una cabecera: %j', (text) => {
    expect(splitAcceptanceCriteria(text)).toEqual({ description: text, acceptanceCriteria: null });
  });

  it('un texto vacío da descripción vacía y criterios null', () => {
    expect(splitAcceptanceCriteria('')).toEqual({ description: '', acceptanceCriteria: null });
  });
});
