import { AdminUsers } from '../../components/admin-users';

export default function AdminPage() {
  return (
    <main className="page">
      <div className="page-head">
        <h1>Administración</h1>
        <p className="page-sub">
          Quien entra por primera vez es QA Executer (solo lectura). Desde aquí le subes el rol.
        </p>
      </div>
      <AdminUsers />
    </main>
  );
}
