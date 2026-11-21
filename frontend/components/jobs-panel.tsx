'use client';

import { useState } from 'react';
import { JobList } from './job-list';
import { NewJobForm } from './new-job-form';

// Junta el formulario y la lista: al crear un job, la lista se vuelve a cargar.
export function JobsPanel() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <>
      <NewJobForm onCreated={() => setRefreshKey((value) => value + 1)} />
      <JobList refreshKey={refreshKey} />
    </>
  );
}
