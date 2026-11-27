import { JobsPanel } from '../components/jobs-panel';

export default function Home() {
  return (
    <main className="page">
      <div className="page-head">
        <h1>Jobs</h1>
        <p className="page-sub">
          Genera tests de Robot Framework desde una historia de Jira y deja que el agente los corrija.
        </p>
      </div>
      <JobsPanel />
    </main>
  );
}
