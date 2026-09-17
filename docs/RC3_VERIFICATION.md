# Senten 1.0.0-rc.3 verification

RC3 is a dogfood repair candidate addressing false framework detection in Senten self-analysis.

Required local checkpoint:

1. `npm install`
2. `npm run preflight`
3. `npm pack`
4. install the packed RC3 globally
5. `senten discover` from the Senten repository must not report Next.js, Expo, Supabase, or Tauri merely because their adapters/fixtures are present
6. `senten adopt` must not recommend route adapters for the Senten CLI/library itself
7. `senten scenario verify-all` must remain green
8. `senten release check --rc` must pass
