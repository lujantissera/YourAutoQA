-- Una persona que usa la aplicación. No hay contraseña: la identidad la da el proveedor (US-01.6).
-- El rol por defecto es el de menos privilegios (D-25); un Admin lo sube después.
CREATE TABLE users (
  id           uuid PRIMARY KEY,
  email        text NOT NULL,
  display_name text NOT NULL,
  avatar_url   text,
  role         text NOT NULL DEFAULT 'QA Executer'
                 CHECK (role IN ('Admin', 'QA Controller', 'QA Executer')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Con qué cuenta externa entra cada usuario. Separada de `users` para que Google (u otro proveedor)
-- pueda añadirse más adelante sin tocar nada (RF-1). La clave es (proveedor, cuenta): una cuenta de
-- Atlassian solo puede estar vinculada a un usuario.
CREATE TABLE linked_accounts (
  provider            text NOT NULL,
  provider_account_id text NOT NULL,
  user_id             uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, provider_account_id)
);

-- Sesiones abiertas. Se guarda el HASH del token de la cookie, nunca el token (D-55).
CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- Quién creó cada job. Puede ser NULL: los jobs anteriores al login no tienen dueño.
ALTER TABLE jobs ADD COLUMN user_id uuid REFERENCES users (id) ON DELETE SET NULL;
