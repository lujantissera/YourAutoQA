import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoginCard } from './login-card';

describe('LoginCard', () => {
  it('ofrece iniciar sesión con Atlassian con un enlace (navegación completa, no fetch)', () => {
    render(<LoginCard />);
    const link = screen.getByRole('link', { name: /iniciar sesión con atlassian/i });
    expect(link).toHaveAttribute('href', '/api/auth/login');
  });

  it('no pide contraseñas propias y lo dice (US-01.6)', () => {
    render(<LoginCard />);
    expect(screen.queryByLabelText(/contraseña/i)).not.toBeInTheDocument();
    expect(screen.getByText(/no guardamos contraseñas/i)).toBeInTheDocument();
  });

  it('sin error no muestra ningún aviso', () => {
    render(<LoginCard />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('si el usuario canceló en Atlassian lo explica (US-01.4)', () => {
    render(<LoginCard errorCode="cancelled" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/cancelaste/i);
  });

  it('un código de error desconocido no muestra nada', () => {
    render(<LoginCard errorCode="<img src=x>" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
