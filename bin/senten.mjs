#!/usr/bin/env node
import('../dist/packages/cli/src/index.js')
  .then(({ main }) => main(process.argv.slice(2)))
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (process.env.SENTEN_DEBUG && error instanceof Error && error.stack) console.error(error.stack);
    const code = error && typeof error === 'object' ? error.code : undefined;
    process.exitCode = code === 'SENTEN_CANCELLED' ? 130 : code === 'SENTEN_TIMEOUT' ? 124 : code === 'SENTEN_STALLED' ? 125 : code === 'SENTEN_UNAVAILABLE' ? 3 : code === 'SENTEN_DENIED' ? 4 : code === 'SENTEN_SKIPPED' ? 0 : 1;
  });
