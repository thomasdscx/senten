# Migration: Senten 0.3.0-alpha.0 -> 0.4.0-alpha.0

No destructive migration is required.

Run:

```bash
npm install
npm run preflight
npm link
senten --version
```

The local SQLite database is migrated automatically on the next Senten command and gains Interaction Assurance tables.

Static crawling requires no additional package.

Browser-driven `clickthru` and `journey run` use Playwright as an optional runtime dependency. To enable them in the Senten development repository:

```bash
npm install -D playwright
npx playwright install chromium
```

Install Firefox/WebKit runtimes only when those engines are needed.
