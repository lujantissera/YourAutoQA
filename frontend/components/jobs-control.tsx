'use client';

import { useState } from 'react';
import type { JobSummary } from '../lib/api';
import { JOB_FILTERS, type JobFilter } from '../lib/dashboard';
import { JobList } from './job-list';

type JobsControlProps = {
  loadJobs?: () => Promise<JobSummary[]>;
  pollIntervalMs?: number;
};

// Control de tests (RF-7): todos los jobs, con filtros por estado. El filtro se aplica en el
// navegador sobre la lista que ya se carga y se refresca sola mientras algo está en curso.
export function JobsControl({ loadJobs, pollIntervalMs }: JobsControlProps) {
  const [filter, setFilter] = useState<JobFilter>('all');

  return (
    <>
      <div className="filters" role="group" aria-label="Filtrar por estado">
        {JOB_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className="filter-chip"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <JobList loadJobs={loadJobs} pollIntervalMs={pollIntervalMs} filter={filter} />
    </>
  );
}
