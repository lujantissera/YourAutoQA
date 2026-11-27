import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PendingApproval } from './pending-approval';

describe('PendingApproval', () => {
  it('explica que la cuenta espera aprobación y con qué cuenta ha entrado', () => {
    render(
      <PendingApproval email="ana@x.com" onRecheck={() => undefined} onSignOut={() => undefined} />,
    );

    expect(screen.getByRole('heading', { name: /pendiente de aprobación/i })).toBeInTheDocument();
    expect(screen.getByText(/ana@x\.com/)).toBeInTheDocument();
    expect(screen.getByText(/pídele a un admin/i)).toBeInTheDocument();
  });

  it('ofrece comprobar de nuevo y cerrar sesión', async () => {
    const onRecheck = vi.fn();
    const onSignOut = vi.fn();
    render(<PendingApproval email="ana@x.com" onRecheck={onRecheck} onSignOut={onSignOut} />);

    await userEvent.click(screen.getByRole('button', { name: /comprobar de nuevo/i }));
    await userEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }));

    expect(onRecheck).toHaveBeenCalledTimes(1);
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('sin email (el usuario lo oculta en Atlassian) no pinta un hueco raro', () => {
    render(<PendingApproval email="" onRecheck={() => undefined} onSignOut={() => undefined} />);
    expect(screen.queryByText(/con la cuenta/i)).not.toBeInTheDocument();
  });
});
