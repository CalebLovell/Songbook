# Contributing to Songbook

The web UI is in [`web-ui/`](web-ui/README.md), and its design rules are in
[`web-ui/DESIGN.md`](web-ui/DESIGN.md). The recording and analysis services are in `scripts/`.

## Generated images

Generated images are committed, and these commands, run in `web-ui/`, rebuild them:

```bash
npm run link-images
```

```bash
npm run db:reset && npm run build && npm run screenshots
```

The first renders the link-preview image and home-screen icons. The second captures the README's
screenshots from test data, using a throwaway config so no real station name or coordinates appear.
`db:reset` replaces the local dev database.

## Releases

Releases are automatic. Every push to `main` runs `.github/workflows/release.yml`, which checks the
web UI and then lets [semantic-release](https://semantic-release.gitbook.io/) read the
[Conventional Commits](https://www.conventionalcommits.org/) since the last release to pick the
version:

| Commit message | Release |
| --- | --- |
| `fix(ui): …`, `perf: …` | patch: 1.4.0 → 1.4.1 |
| `feat(ui): …` | minor: 1.4.0 → 1.5.0 |
| `feat(ui)!: …`, or a `BREAKING CHANGE:` footer | major: 1.4.0 → 2.0.0 |
| `test:`, `docs:`, `chore:`, `refactor:`, `style:`, `ci:` | none |

The highest one among the new commits wins. When there is a release, it builds the web UI bundle
(`scripts/package_release.sh`), tags the commit `vX.Y.Z`, and publishes the GitHub release with notes
grouped from the commit messages.

The checks (Biome, TypeScript, tests) run first, and a failing check means no release.
`.githooks/pre-push` runs the same checks before a push to `main`; turn it on once per clone with
`git config core.hooksPath .githooks`.
