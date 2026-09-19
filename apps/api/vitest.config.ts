import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Several test files each boot their own in-process Postgres (PGlite, a
    // WebAssembly build of Postgres). Booting is quick alone but slows a lot when
    // the files start in parallel, so the default 10s hook timeout is too tight.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
