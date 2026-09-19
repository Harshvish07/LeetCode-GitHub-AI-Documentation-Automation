export interface Migration {
  /** Monotonic, zero-padded id — migrations run in id order and are recorded by id. */
  id: string;
  name: string;
  /** One or more statements, run in a single transaction. */
  sql: string;
}
