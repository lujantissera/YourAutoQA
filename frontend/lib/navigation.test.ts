import { describe, expect, it } from 'vitest';
import type { Action } from './auth';
import { isActive, navItemsFor } from './navigation';

const labels = (permissions: Action[]) => navItemsFor(permissions).map((item) => item.label);

describe('navItemsFor (qué apartados ve cada rol, US-02.1)', () => {
  it('un Admin ve todo', () => {
    expect(labels(['job:read', 'job:create', 'job:clarify', 'admin:manage'])).toEqual([
      'Inicio',
      'Crear test',
      'Control de tests',
      'Administración',
    ]);
  });

  it('un QA Controller no ve Administración', () => {
    expect(labels(['job:read', 'job:create', 'job:clarify'])).toEqual([
      'Inicio',
      'Crear test',
      'Control de tests',
    ]);
  });

  it('un QA Executer solo ve Inicio y Control', () => {
    expect(labels(['job:read'])).toEqual(['Inicio', 'Control de tests']);
  });

  it('sin permisos no ve nada', () => {
    expect(labels([])).toEqual([]);
  });
});

describe('isActive', () => {
  it('Inicio solo está activo en la portada', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/jobs', '/')).toBe(false);
  });

  it('el detalle de un job mantiene activo "Control de tests"', () => {
    expect(isActive('/jobs', '/jobs')).toBe(true);
    expect(isActive('/jobs/abc', '/jobs')).toBe(true);
  });

  it('no confunde rutas que solo comparten el comienzo', () => {
    expect(isActive('/jobsx', '/jobs')).toBe(false);
    expect(isActive('/crear', '/jobs')).toBe(false);
  });
});
