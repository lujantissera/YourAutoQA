-- Quien entra por primera vez queda "Pending" (sin acceso) hasta que un Admin le asigna un rol (D-64).
-- Postgres no deja ampliar un CHECK en su sitio: se borra y se vuelve a crear con el valor nuevo.
-- Los usuarios que ya existen conservan el rol que tienen.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Admin', 'QA Controller', 'QA Executer', 'Pending'));
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'Pending';
