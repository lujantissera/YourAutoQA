import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError, type JobDetail } from '../lib/api';
import { ClarificationForm } from './clarification-form';

const QUESTION = '¿Qué credenciales de prueba debo usar?';

const resumed: JobDetail = {
  id: 'job-1',
  issueKey: 'PROJ-123',
  summary: 'Login',
  status: 'generating',
  attempts: [],
  tokensUsed: 0,
  question: null,
  failureReason: null,
  createdAt: new Date('2026-11-25T10:00:00.000Z'),
};

const renderForm = (clarify = vi.fn().mockResolvedValue(resumed), onAnswered = vi.fn()) => {
  render(
    <ClarificationForm
      jobId="job-1"
      question={QUESTION}
      clarify={clarify}
      onAnswered={onAnswered}
    />,
  );
  return { clarify, onAnswered };
};

const typeAnswer = (text: string) => userEvent.type(screen.getByLabelText('Tu respuesta'), text);
const send = () =>
  userEvent.click(screen.getByRole('button', { name: /Enviar respuesta|Enviando/ }));

describe('ClarificationForm', () => {
  it('shows the question of the agent and warns to use test credentials only', () => {
    renderForm();

    expect(screen.getByText(QUESTION)).toBeInTheDocument();
    expect(screen.getByText(/credenciales de prueba, nunca reales/i)).toBeInTheDocument();
  });

  it('sends the trimmed answer for the job, reports it and clears the field', async () => {
    const { clarify, onAnswered } = renderForm();

    await typeAnswer('  usuario@test.com / Test1234  ');
    await send();

    expect(clarify).toHaveBeenCalledWith('job-1', 'usuario@test.com / Test1234');
    expect(onAnswered).toHaveBeenCalledWith(resumed);
    expect(screen.getByLabelText('Tu respuesta')).toHaveValue('');
  });

  it('does not allow sending an empty answer', () => {
    renderForm();

    expect(screen.getByRole('button', { name: 'Enviar respuesta' })).toBeDisabled();
  });

  it('disables the button while the answer is being sent', async () => {
    renderForm(vi.fn().mockReturnValue(new Promise(() => {})));

    await typeAnswer('hola');
    await send();

    expect(screen.getByRole('button', { name: 'Enviando…' })).toBeDisabled();
  });

  it('shows how many characters of the maximum have been used', async () => {
    renderForm();

    await typeAnswer('hola');

    expect(screen.getByText('4 / 2000')).toBeInTheDocument();
  });

  it('explains the error next to the field and keeps what was typed', async () => {
    renderForm(
      vi.fn().mockRejectedValue(new ApiError('not_awaiting_clarification', 'Job is not waiting.')),
    );

    await typeAnswer('hola');
    await send();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este job ya no espera tu respuesta.',
    );
    expect(screen.getByLabelText('Tu respuesta')).toHaveValue('hola');
  });
});
