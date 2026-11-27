import { AdminUsers } from '../../components/admin-users';

export default function AdminPage() {
  return (
    <main className="page">
      <div className="page-head">
        <h1>Administración</h1>
        <p className="page-sub">
          Quien entra por primera vez queda sin acceso hasta que le asignes un rol. Aparece arriba,
          en «Sin acceso (pendiente)». También puedes devolver a alguien a ese estado para quitarle
          el acceso.
        </p>
      </div>
      <AdminUsers />
    </main>
  );
}
