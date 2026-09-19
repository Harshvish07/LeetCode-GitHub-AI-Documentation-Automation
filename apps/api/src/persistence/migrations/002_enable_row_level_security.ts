import type { Migration } from './types.js';

/**
 * Turns on Row Level Security for every table, with no policies. On plain
 * PostgreSQL this changes nothing for the API (it connects as the table
 * owner, who bypasses RLS). On Supabase it matters: tables in `public` are
 * otherwise reachable through Supabase's REST API with the public anon key,
 * which would expose submitted code. With RLS on and no policy, that route
 * returns nothing, while the API's direct database connection is unaffected.
 */
export const enableRowLevelSecurity: Migration = {
  id: '002',
  name: 'enable_row_level_security',
  sql: `
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;
`,
};
