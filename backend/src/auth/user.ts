import type { Role } from './roles.js';

// Una persona que usa YourAutoQA. No guarda contraseña (US-01.6): quién es lo dice Atlassian.
export interface User {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
  createdAt: Date;
}

// Lo que un proveedor de identidad (hoy solo Atlassian) cuenta sobre quien acaba de iniciar sesión.
// `provider` + `providerAccountId` identifican la cuenta; así Google podrá añadirse sin cambiar nada.
export interface ExternalProfile {
  provider: 'atlassian';
  providerAccountId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}
