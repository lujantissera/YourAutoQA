import { JobList } from '../components/job-list';

export default function Home() {
  return (
    <main className="page">
      <h1>Jobs</h1>
      <JobList />
    </main>
  );
}
