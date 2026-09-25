# Senten 1.0.0-rc.5 Verification

RC4 is an external-dogfood hardening release derived from findings against `vercel/nextjs-postgres-auth-starter` and `vercel/next-learn`.

Verified locally in the build environment:

- TypeScript typecheck: PASS
- Production build: PASS
- Automated test suite: 108 / 108 PASS
- npm package build: PASS
- Next.js catch-all route canonicalization regression: PASS
- project-root import alias classification regression: PASS
- Drizzle resource/action extraction regression: PASS
- auth-detected-but-unmapped adoption semantics regression: PASS
- adapter provenance deduplication regression: PASS
- structured `senten record` Markdown export regression: PASS

Human checkpoints still required before publishing RC4:

- Windows local preflight and package install
- re-run Dogfood #1 and #2 with RC4
- GitHub Windows/macOS/Linux CI
- GitHub Docker workflow
