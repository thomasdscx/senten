#!/usr/bin/env node
import('../dist/packages/cli/src/index.js')
  .then(({ main }) => main(process.argv.slice(2)))
  .catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
