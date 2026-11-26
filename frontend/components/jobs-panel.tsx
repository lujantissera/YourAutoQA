'use client';

import { useState } from 'react';
import { useOptionalAuth } from './auth-provider';
import { JobList } from './job-list';
import { NewJobForm } from './new-job-form';

// Junta el formulario y la lista: al crear un job, la lista se vuelve a cargar.
export function JobsPanel() {
  const [refreshKey, setRefreshKey] = useState(0);
  // Solo quien puede crear jobs ve el formulario (US-02.1). Es comodidad: el backend lo vuelve a
  // comprobar con un 403. Sin proveedor (tests aislados) se muestra.
  const auth = useOptionalAuth();
  const canCreate = auth ? auth.can('job:create') : true;

  return (
    <>
      {canCreate && <NewJobForm onCreated={() => setRefreshKey((value) => value + 1)} />}
      <JobList refreshKey={refreshKey} />
    </>
  );
}
