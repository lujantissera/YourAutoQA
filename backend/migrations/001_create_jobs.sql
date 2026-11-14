-- Un job es un pedido de trabajo al agente: "genera y valida el test de esta historia".
CREATE TABLE jobs (
  id             uuid PRIMARY KEY,
  issue_key      text NOT NULL,
  summary        text NOT NULL,
  status         text NOT NULL CHECK (status IN
                   ('generating', 'running', 'done', 'fail', 'awaiting_clarification')),
  tokens_used    integer NOT NULL DEFAULT 0,
  question       text,
  failure_reason text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Cada intento (ejecución) de un job: el test generado y cómo fue.
CREATE TABLE job_attempts (
  job_id       uuid NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  id           integer NOT NULL,
  attempt      integer NOT NULL,
  robot_code   text NOT NULL,
  result       text NOT NULL CHECK (result IN ('PASS', 'FAIL')),
  logs         text NOT NULL,
  timed_out    boolean NOT NULL,
  failure_kind text,
  PRIMARY KEY (job_id, id)
);
