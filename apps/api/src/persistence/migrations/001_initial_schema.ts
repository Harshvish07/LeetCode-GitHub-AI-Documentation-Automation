import type { Migration } from './types.js';

/** The fixed id of the built-in local user every row belongs to until Phase 9 adds authentication. */
export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export const initialSchema: Migration = {
  id: '001',
  name: 'initial_schema',
  sql: `
CREATE TABLE users (
  id           uuid PRIMARY KEY,
  handle       text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO users (id, handle, display_name)
VALUES ('${DEFAULT_USER_ID}', 'local', 'Local user')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE problems (
  id          uuid PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  number      integer,
  title       text NOT NULL,
  difficulty  text CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  url         text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX problems_number_idx ON problems (number);
CREATE INDEX problems_difficulty_idx ON problems (difficulty);

CREATE TABLE submissions (
  id           uuid PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  problem_id   uuid NOT NULL REFERENCES problems (id) ON DELETE CASCADE,
  language     text,
  code         text NOT NULL,
  status       text,
  runtime      text,
  memory       text,
  source       text NOT NULL,
  extracted_at timestamptz NOT NULL,
  received_at  timestamptz NOT NULL
);
CREATE INDEX submissions_user_received_idx ON submissions (user_id, received_at DESC);
CREATE INDEX submissions_problem_received_idx ON submissions (problem_id, received_at DESC);
CREATE INDEX submissions_user_status_idx ON submissions (user_id, status);

CREATE TABLE analyses (
  id               uuid PRIMARY KEY,
  submission_id    uuid NOT NULL UNIQUE REFERENCES submissions (id) ON DELETE CASCADE,
  result           jsonb NOT NULL,
  patterns         jsonb NOT NULL DEFAULT '[]'::jsonb,
  time_complexity  text NOT NULL,
  space_complexity text NOT NULL,
  confidence       text NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analyses_patterns_idx ON analyses USING gin (patterns);

CREATE TABLE reviews (
  id                         uuid PRIMARY KEY,
  submission_id              uuid NOT NULL UNIQUE REFERENCES submissions (id) ON DELETE CASCADE,
  analysis_id                uuid REFERENCES analyses (id) ON DELETE SET NULL,
  result                     jsonb NOT NULL,
  agreement                  jsonb NOT NULL,
  patterns                   jsonb NOT NULL DEFAULT '[]'::jsonb,
  time_complexity            text NOT NULL,
  space_complexity           text NOT NULL,
  is_optimal                 boolean NOT NULL,
  correctness_concerns_count integer NOT NULL CHECK (correctness_concerns_count >= 0),
  improvements_count         integer NOT NULL CHECK (improvements_count >= 0),
  has_disagreement           boolean NOT NULL,
  confidence                 text NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  quality_score              integer NOT NULL CHECK (quality_score BETWEEN 0 AND 100),
  created_at                 timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reviews_patterns_idx ON reviews USING gin (patterns);
CREATE INDEX reviews_quality_idx ON reviews (quality_score);

CREATE TABLE documents (
  id            uuid PRIMARY KEY,
  submission_id uuid NOT NULL UNIQUE REFERENCES submissions (id) ON DELETE CASCADE,
  review_id     uuid REFERENCES reviews (id) ON DELETE SET NULL,
  filename      text NOT NULL,
  content       text NOT NULL,
  github_path   text,
  github_url    text,
  commit_url    text,
  published_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
`,
};
