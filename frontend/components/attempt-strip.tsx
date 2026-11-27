export type AttemptCell = { id: number; result: 'PASS' | 'FAIL' };

type AttemptStripProps = {
  attempts: AttemptCell[];
  max: number;
};

const LABEL = { PASS: 'passed', FAIL: 'failed' } as const;
const GLYPH = { PASS: '✓', FAIL: '✕' } as const;

export function AttemptStrip({ attempts, max }: AttemptStripProps) {
  // Una posición por intento posible: las usadas muestran su resultado y el resto queda vacío.
  const cells = Array.from({ length: max }, (_, index) => attempts[index]);

  return (
    <ul className="attempt-strip">
      {cells.map((attempt, index) =>
        attempt ? (
          <li key={attempt.id} data-result={attempt.result}>
            <span aria-hidden="true">{GLYPH[attempt.result]}</span>
            <span className="visually-hidden">
              {`Attempt ${index + 1}: ${LABEL[attempt.result]}`}
            </span>
          </li>
        ) : (
          <li key={`empty-${index}`} data-result="EMPTY">
            <span className="visually-hidden">{`Attempt ${index + 1}: not run`}</span>
          </li>
        ),
      )}
    </ul>
  );
}
