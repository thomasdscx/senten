# Public Release Checklist

Before changing the repository from private to public:

- Run `npm run preflight` on Windows and CI.
- Run `senten doctor` on dogfood projects.
- Run `senten release check --strict` on the repository/project state intended for release.
- Review `git status` and repository history for secrets, credentials, private URLs and customer data.
- Configure GitHub private vulnerability reporting/security advisories.
- Confirm Apache-2.0 licensing and third-party license compatibility.
- Confirm README claims match implemented behavior.
- Review package names/registry availability before publishing npm artifacts.
- Verify Docker and optional Playwright paths on supported environments.
- Run at least one external-project dogfood pass using `discover`, `sandbox`, `crawl/clickthru`, `proof`, and `report`.
- Tag alpha/release-candidate versions truthfully; do not label the API stable until protocol compatibility is intentionally frozen.
