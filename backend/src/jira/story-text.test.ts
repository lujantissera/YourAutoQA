import { describe, expect, it } from 'vitest';
import type { UserStory } from '../agent/ports.js';
import { storyToPrompt } from './story-text.js';

const story: UserStory = {
  key: 'YAQ-1',
  summary: 'Iniciar sesión con credenciales válidas',
  description: 'Como usuario registrado quiero iniciar sesión.',
  acceptanceCriteria: 'Dado un usuario en el login\nEntonces ve la página de productos',
};

describe('storyToPrompt (US-03)', () => {
  it('pone la clave y el resumen en la primera línea, luego la descripción y los criterios', () => {
    expect(storyToPrompt(story)).toBe(
      [
        'YAQ-1: Iniciar sesión con credenciales válidas',
        '',
        'Como usuario registrado quiero iniciar sesión.',
        '',
        'Criterios de aceptación:',
        'Dado un usuario en el login',
        'Entonces ve la página de productos',
      ].join('\n'),
    );
  });

  it('sin criterios, el texto termina en la descripción (US-03.3)', () => {
    expect(storyToPrompt({ ...story, acceptanceCriteria: null })).toBe(
      [
        'YAQ-1: Iniciar sesión con credenciales válidas',
        '',
        'Como usuario registrado quiero iniciar sesión.',
      ].join('\n'),
    );
  });

  it('sin descripción, solo quedan el título y los criterios, sin líneas en blanco de más', () => {
    expect(storyToPrompt({ ...story, description: '' })).toBe(
      [
        'YAQ-1: Iniciar sesión con credenciales válidas',
        '',
        'Criterios de aceptación:',
        'Dado un usuario en el login',
        'Entonces ve la página de productos',
      ].join('\n'),
    );
  });

  it('sin descripción ni criterios, queda solo el título', () => {
    expect(storyToPrompt({ ...story, description: '', acceptanceCriteria: null })).toBe(
      'YAQ-1: Iniciar sesión con credenciales válidas',
    );
  });
});
