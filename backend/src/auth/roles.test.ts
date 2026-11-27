import { describe, expect, it } from 'vitest';
import { ACTIONS, DEFAULT_ROLE, ROLES, can, isRole, type Action, type Role } from './roles.js';

// La matriz de US-02, escrita como tabla: una fila por acción y qué roles pueden hacerla.
const EXPECTED: Record<Action, Record<Role, boolean>> = {
  'job:read': { Admin: true, 'QA Controller': true, 'QA Executer': true },
  'job:create': { Admin: true, 'QA Controller': true, 'QA Executer': false },
  'job:clarify': { Admin: true, 'QA Controller': true, 'QA Executer': false },
  'admin:manage': { Admin: true, 'QA Controller': false, 'QA Executer': false },
};

describe('roles', () => {
  it('el rol por defecto es QA Executer, el de menos privilegios (D-25)', () => {
    expect(DEFAULT_ROLE).toBe('QA Executer');
  });

  it('isRole acepta los tres roles y rechaza cualquier otro texto', () => {
    for (const role of ROLES) expect(isRole(role)).toBe(true);
    expect(isRole('Tester')).toBe(false);
    expect(isRole('admin')).toBe(false);
    expect(isRole(42)).toBe(false);
  });

  describe('can(rol, acción) respeta la matriz de US-02', () => {
    for (const action of ACTIONS) {
      for (const role of ROLES) {
        it(`${role} ${EXPECTED[action][role] ? 'puede' : 'NO puede'} ${action}`, () => {
          expect(can(role, action)).toBe(EXPECTED[action][role]);
        });
      }
    }
  });
});
