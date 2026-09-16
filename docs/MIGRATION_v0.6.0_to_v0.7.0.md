# Migration: Senten v0.6.0 → v0.7.0

No destructive migration is required. Build 7 adds a `reports` table to `.senten/senten.db`; it is created automatically on first open.

Run:

```bash
npm install
npm run preflight
npm link
senten --version
```

Then test:

```bash
senten report project --format html
senten report list
senten observatory
```

Observatory is loopback-only by default.
