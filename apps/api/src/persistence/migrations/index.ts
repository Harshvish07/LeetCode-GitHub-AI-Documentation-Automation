import { initialSchema } from './001_initial_schema.js';
import { enableRowLevelSecurity } from './002_enable_row_level_security.js';
import type { Migration } from './types.js';

/** Every migration, in order. Add new ones to the end — never edit or reorder an applied one. */
export const migrations: Migration[] = [initialSchema, enableRowLevelSecurity];
