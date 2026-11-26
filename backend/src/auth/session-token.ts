import { createHash, randomBytes } from 'node:crypto';

// El token es lo que viaja en la cookie: 32 bytes aleatorios (256 bits), imposibles de adivinar.
export const generateSessionToken = (): string => randomBytes(32).toString('base64url');

// En la base de datos solo se guarda el HASH del token. Así, si alguien lee la tabla `sessions`
// (copia de seguridad, SQL injection...), no puede usar esos valores como cookie. SHA-256 basta
// (y no hace falta bcrypt) porque el token ya es aleatorio y largo: no hay nada que adivinar.
export const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
