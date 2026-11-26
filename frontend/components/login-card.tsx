import { loginErrorMessage } from '../lib/auth';

// La pantalla de login. El botón es un enlace normal (<a>), no un fetch: el navegador tiene que
// hacer una navegación completa para ir a Atlassian y volver con la cookie puesta. Next reenvía
// /api/* al backend, que redirige a Atlassian.
export function LoginCard({ errorCode }: { errorCode?: string }) {
  const error = loginErrorMessage(errorCode);

  return (
    <main className="page login-page">
      <section className="card login-card" aria-labelledby="login-title">
        <h1 id="login-title">Iniciar sesión</h1>
        <p className="page-sub">
          Entra con tu cuenta de Atlassian para generar y revisar tests de Robot Framework.
        </p>

        {error && (
          <p role="alert" className="auth-notice" data-tone="fail">
            {error}
          </p>
        )}

        <a className="login-button" href="/api/auth/login">
          Iniciar sesión con Atlassian
        </a>
        <p className="login-hint">No guardamos contraseñas: la identidad la verifica Atlassian.</p>
      </section>
    </main>
  );
}
