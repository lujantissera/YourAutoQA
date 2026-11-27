type PendingApprovalProps = {
  email: string;
  onRecheck: () => void;
  onSignOut: () => void;
};

// Lo que ve alguien que ha entrado con Atlassian pero aún no tiene rol (D-64). Si un Admin lo
// aprueba mientras espera, "Comprobar de nuevo" vuelve a pedir la sesión y le deja pasar.
export function PendingApproval({ email, onRecheck, onSignOut }: PendingApprovalProps) {
  return (
    <main className="page login-page">
      <section className="card login-card" aria-labelledby="pending-title">
        <h1 id="pending-title">Tu cuenta está pendiente de aprobación</h1>
        {email && <p className="login-hint">Has entrado con la cuenta {email}.</p>}
        <p>Pídele a un Admin que te asigne un rol. Hasta entonces no puedes ver ni crear nada.</p>
        <button type="button" onClick={onRecheck}>
          Comprobar de nuevo
        </button>
        <button type="button" className="user-signout" onClick={onSignOut}>
          Cerrar sesión
        </button>
      </section>
    </main>
  );
}
