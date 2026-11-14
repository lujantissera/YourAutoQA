// Recibe el entorno como parámetro (en producción `process.env`) para poder probarlo sin tocar
// variables globales. Nunca imprime el valor: la dirección lleva la contraseña.
export function loadDatabaseUrl(env: Record<string, string | undefined>): string {
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new Error('Missing required environment variable: DATABASE_URL');
  return url;
}
