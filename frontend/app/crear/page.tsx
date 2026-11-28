import { CreateTest } from '../../components/create-test';

export default function CreateTestPage() {
  return (
    <main className="page">
      <div className="page-head">
        <h1>Crear test</h1>
        <p className="page-sub">
          Genera un test de Robot Framework a partir de una historia de Jira.
        </p>
      </div>
      <CreateTest />
    </main>
  );
}
