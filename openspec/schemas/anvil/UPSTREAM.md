# Vendored Anvil schema

This directory is a vendored copy of the [`anvil` workflow
schema](https://github.com/jikkujoyce/openspec-schemas/tree/main/schemas/anvil)
for [OpenSpec](https://github.com/Fission-AI/OpenSpec), used as the project
default for repository changes.

- **Source repository:** https://github.com/jikkujoyce/openspec-schemas
- **Pinned commit:** `73eea60c622712a5d952ec1aec62da4e349f8c33`
- **Vendored contents:** the complete `schemas/anvil` directory at that commit
  (`schema.yaml`, `README.md`, `templates/`), plus the upstream repository-root
  MIT `LICENSE` (the upstream schema directory does not include a license file
  itself), satisfying the upstream license when redistributing the snapshot.
- **Update procedure:** refresh this directory only from a new pinned upstream
  commit, review the upstream diff, re-run `openspec schema validate anvil
  --json`, and re-run the attribution check (`LICENSE` copyright line,
  `UPSTREAM.md` source URL and commit) — see `dev/README.md`.

Do not edit vendored files in place; they are replaced wholesale on refresh.
