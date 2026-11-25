import Link from 'next/link';
import { JobDetailView } from '../../../components/job-detail';

// En Next 16 `params` llega como una promesa: hay que esperarla para leer el id de la URL.
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="page">
      <Link href="/" className="back-link">
        <span aria-hidden="true">←</span> Volver a los jobs
      </Link>
      <JobDetailView jobId={id} />
    </main>
  );
}
