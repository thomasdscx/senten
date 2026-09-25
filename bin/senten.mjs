#!/usr/bin/env node
import('../dist/packages/cli/src/index.js')
  .then(({ main }) => main(process.argv.slice(2)))
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    if (process.env.SENTEN_DEBUG && error instanceof Error && error.stack) console.error(error.stack);
    process.exitCode = 1;
  });
