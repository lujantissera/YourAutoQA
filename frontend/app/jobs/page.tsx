import { JobsControl } from '../../components/jobs-control';

export default function JobsPage() {
  return (
    <main className="page">
      <div className="page-head">
        <h1>Control de tests</h1>
        <p className="page-sub">Todos los tests generados y cómo va el agente con cada uno.</p>
      </div>
      <JobsControl />
    </main>
  );
}
