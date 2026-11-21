import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../lib/api';
import { NewJobForm } from './new-job-form';

const created = {
  id: 'job-9',
  issueKey: 'PROJ-123',
  summary: 'Login',
  status: 'generating' as const,
};

const typeKey = (key: string) => userEvent.type(screen.getByLabelText('Clave de la historia'), key);

const submit = () =>
  userEvent.click(screen.getByRole('button', { name: /Generar test|Generando/ }));

describe('NewJobForm', () => {
  it('sends the trimmed key, reports the created job and clears the field', async () => {
    const createJob = vi.fn().mockResolvedValue(created);
    const onCreated = vi.fn();
    render(<NewJobForm createJob={createJob} onCreated={onCreated} />);

    await typeKey('  PROJ-123  ');
    await submit();

    expect(createJob).toHaveBeenCalledWith('PROJ-123');
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(screen.getByLabelText('Clave de la historia')).toHaveValue('');
  });

  it('disables the button while the job is being created', async () => {
    const createJob = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<NewJobForm createJob={createJob} onCreated={vi.fn()} />);

    await typeKey('PROJ-123');
    await submit();

    expect(screen.getByRole('button', { name: 'Generando…' })).toBeDisabled();
  });

  it('does not allow sending an empty key', () => {
    render(<NewJobForm createJob={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Generar test' })).toBeDisabled();
  });

  it('explains in Spanish why Jira rejected the key and keeps what was typed', async () => {
    const createJob = vi
      .fn()
      .mockRejectedValue(new ApiError('not_found', 'Issue PROJ-999 not found.'));
    render(<NewJobForm createJob={createJob} onCreated={vi.fn()} />);

    await typeKey('PROJ-999');
    await submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('No existe esa historia en Jira.');
    expect(screen.getByLabelText('Clave de la historia')).toHaveValue('PROJ-999');
  });
});
