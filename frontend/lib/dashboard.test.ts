import { describe, expect, it } from 'vitest';
import type { JobSummary } from './api';
import { attentionJobs, filterJobs, JOB_FILTERS, recentJobs, summarizeJobs } from './dashboard';

const job = (id: string, status: JobSummary['status'], createdAt = '2026-11-20T10:00:00Z') =>
  ({
    id,
    issueKey: `YAQ-${id}`,
    summary: `Historia ${id}`,
    status,
    tokensUsed: 0,
    attemptCount: 1,
    createdAt: new Date(createdAt),
  }) satisfies JobSummary;

describe('summarizeJobs', () => {
  it('cuenta el total y cada estado, agrupando los que están en marcha', () => {
    const jobs = [
      job('1', 'done'),
      job('2', 'done'),
      job('3', 'fail'),
      job('4', 'generating'),
      job('5', 'running'),
      job('6', 'awaiting_clarification'),
    ];
    expect(summarizeJobs(jobs)).toEqual({
      total: 6,
      passed: 2,
      failed: 1,
      running: 2,
      waiting: 1,
    });
  });

  it('con una lista vacía todo es cero', () => {
    expect(summarizeJobs([])).toEqual({ total: 0, passed: 0, failed: 0, running: 0, waiting: 0 });
  });
});

describe('attentionJobs', () => {
  it('devuelve solo los que esperan una respuesta, los más recientes primero', () => {
    const jobs = [
      job('1', 'awaiting_clarification', '2026-11-20T10:00:00Z'),
      job('2', 'done'),
      job('3', 'awaiting_clarification', '2026-11-22T10:00:00Z'),
    ];
    expect(attentionJobs(jobs).map((j) => j.id)).toEqual(['3', '1']);
  });
});

describe('recentJobs', () => {
  it('ordena de más reciente a más antiguo y recorta al límite', () => {
    const jobs = [
      job('1', 'done', '2026-11-20T10:00:00Z'),
      job('2', 'done', '2026-11-22T10:00:00Z'),
      job('3', 'done', '2026-11-21T10:00:00Z'),
    ];
    expect(recentJobs(jobs, 2).map((j) => j.id)).toEqual(['2', '3']);
  });

  it('no modifica la lista original', () => {
    const jobs = [
      job('1', 'done', '2026-11-20T10:00:00Z'),
      job('2', 'done', '2026-11-22T10:00:00Z'),
    ];
    recentJobs(jobs, 5);
    expect(jobs.map((j) => j.id)).toEqual(['1', '2']);
  });
});

describe('filterJobs', () => {
  const jobs = [
    job('1', 'done'),
    job('2', 'fail'),
    job('3', 'generating'),
    job('4', 'running'),
    job('5', 'awaiting_clarification'),
  ];
  const ids = (filter: Parameters<typeof filterJobs>[1]) =>
    filterJobs(jobs, filter).map((j) => j.id);

  it('"all" los devuelve todos', () => expect(ids('all')).toEqual(['1', '2', '3', '4', '5']));
  it('"running" agrupa generando y ejecutando', () => expect(ids('running')).toEqual(['3', '4']));
  it('"waiting" son los que preguntan', () => expect(ids('waiting')).toEqual(['5']));
  it('"passed" son los superados', () => expect(ids('passed')).toEqual(['1']));
  it('"failed" son los fallidos', () => expect(ids('failed')).toEqual(['2']));
});

describe('JOB_FILTERS', () => {
  it('ofrece los cinco filtros con su texto, empezando por "Todos"', () => {
    expect(JOB_FILTERS.map((f) => f.value)).toEqual([
      'all',
      'running',
      'waiting',
      'passed',
      'failed',
    ]);
    expect(JOB_FILTERS[0]?.label).toBe('Todos');
  });
});
