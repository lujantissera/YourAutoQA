import { render, screen } from '@testing-library/react';
import { AttemptStrip } from './attempt-strip';

describe('AttemptStrip', () => {
  it('shows one cell per attempt plus empty cells up to the maximum', () => {
    render(
      <AttemptStrip
        attempts={[
          { id: 1, result: 'FAIL' },
          { id: 2, result: 'PASS' },
        ]}
        max={5}
      />,
    );

    // Cada celda es un elemento de lista; el total siempre es `max`.
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('describes each result with text, not only color', () => {
    render(
      <AttemptStrip
        attempts={[
          { id: 1, result: 'FAIL' },
          { id: 2, result: 'PASS' },
        ]}
        max={5}
      />,
    );

    expect(screen.getByText('Attempt 1: failed')).toBeInTheDocument();
    expect(screen.getByText('Attempt 2: passed')).toBeInTheDocument();
  });
});
