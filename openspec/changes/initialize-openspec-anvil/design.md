## Context

`dev/Dockerfile` already installs OpenSpec with `@latest`, OpenCode with `opencode-ai`, the official Codex CLI, and OMP 18.0.11. `dev/README.md` documents authentication for the three runtimes, and `agent-home` persists credentials outside Git. The tracked repository contains no `openspec/`, `.agents/skills/`, `.opencode/`, or `.omp/` integration tree.

Research used OpenSpec 1.11.0 and Anvil upstream commit `73eea60c622712a5d952ec1aec62da4e349f8c33`. OpenSpec 1.11.0 accepts `codex`, `opencode`, and `oh-my-pi` in `openspec init --tools`; a disposable initialization generated six shared Codex skills, six OpenCode skills plus six commands, and six OMP skills plus six commands. A separate disposable bootstrap confirmed that `openspec init` preserves a pre-existing `openspec/changes/` directory.

Anvil defines `proposal → specs → design → review → test-plan → tasks → apply → verify`. Its `requires` graph checks artifact existence only. Verdict semantics, stale-review handling, test-first ordering, and verification decisions are instructions to agents unless the repository adds a separate CI or git-hook checker.

## Goals / Non-Goals

**Goals:**

- Make Anvil available locally and default for repository changes.
- Give Codex, OpenCode, and OMP the OpenSpec-generated repository instructions they natively discover.
- Make generation and schema provenance reproducible and mechanically checkable.
- Preserve the current credential boundary: generated files are tracked; credentials remain only in `agent-home`.

**Non-Goals:**

- Change application or production runtime behavior.
- Authenticate any AI provider or commit credentials.
- Add or redesign OpenSpec workflows beyond the upstream Anvil snapshot.
- Add mechanical CI enforcement of Anvil verdict/TDD semantics in this change.
- Implement or apply this change as part of specification authoring.

## Decisions

### Vendor Anvil as a pinned project-local schema

Copy the complete upstream `schemas/anvil` directory into `openspec/schemas/anvil` from commit `73eea60c622712a5d952ec1aec62da4e349f8c33`. Also copy the repository-root MIT `LICENSE` to `openspec/schemas/anvil/LICENSE` and add `openspec/schemas/anvil/UPSTREAM.md` containing the source URL and exact commit. Project-local vendoring follows the upstream installation model, satisfies the upstream license, works offline after checkout, and makes schema changes visible in code review.

Rejected alternatives:

- Fetch `main` during every setup: non-reproducible and network-dependent.
- Git submodule: adds checkout/update ceremony for a small schema bundle.
- Reimplement Anvil locally: risks semantic drift from the requested schema.

### Pin the generator and commit generated integrations

Replace `@fission-ai/openspec@latest` in `dev/Dockerfile` with `@fission-ai/openspec@1.11.0`, then run:

```sh
openspec init . --tools codex,opencode,oh-my-pi --no-animation
```

Commit the resulting `.agents/skills`, `.opencode`, and `.omp` files. This makes agent discovery work immediately after checkout and keeps `openspec update .` reviewable. The generated Codex integration intentionally lives under `.agents/skills`, not `.codex`, because that is OpenSpec 1.11.0's Codex target layout.

Rejected alternatives:

- Keep `@latest`: future image rebuilds can produce instructions different from the committed files.
- Hand-author agent commands: duplicates generator logic and makes `openspec update` unsafe.
- Generate integrations only at container startup: mutates the mounted checkout and obscures review ownership.

### Set Anvil as the project default

After initialization and schema copy, set `schema: anvil` in `openspec/config.yaml`. Individual changes retain the standard `--schema` override. The existing pre-initialization change directory is preserved by the CLI and its `.openspec.yaml` already binds this change to Anvil.

### Validate structure and use agent-honored gates

Acceptance uses OpenSpec's schema and change validators plus deterministic file/version checks. The owner confirmed that agent-honored enforcement is sufficient for this repository, so this change does not add a CI or git-hook gate. Documentation must explicitly state that the CLI does not enforce Anvil's canonical `VERDICT`, `CHANGES_APPLIED`, or `DECISION` fields.

The owner designated Reviewer dskr.dev as the independent reviewer and the first review was performed locally in a fresh context, without sending artifacts to an external model. Future changes must obtain the same explicit data-locality approval before using an external reviewer.

## Risks / Trade-offs

- **Vendored schema can lag upstream** → record the source commit, update intentionally, and review upstream diffs before replacement.
- **OpenSpec schema commands are marked experimental in 1.11.0** → pin the CLI and require validation after every CLI or schema update.
- **Generated instructions are numerous** → treat them as generated artifacts and refresh only through the pinned CLI.
- **Anvil gates are advisory** → state this prominently; consider a follow-up CI checker if bypass prevention is required.
- **A future cross-model review could transmit specifications externally** → current review stays local; require explicit owner approval before any external reviewer is used.
- **The current host lacks `opencode`, although `dev/Dockerfile` installs it** → verify executable availability in the rebuilt `dev-agent` image, not on the host running this specification task.

## Migration Plan

1. Pin OpenSpec 1.11.0 in `dev/Dockerfile` and rebuild the development agent image.
2. From the repository root, run OpenSpec initialization for `codex,opencode,oh-my-pi`; preserve this existing change directory.
3. Vendor the pinned Anvil directory, its MIT `LICENSE`, and `UPSTREAM.md`; set `schema: anvil` in `openspec/config.yaml`.
4. Add the maintenance and validation section to `dev/README.md`.
5. Run schema, change, version, integration-manifest, and clean-diff checks defined by the approved test plan.
6. Roll back by reverting the initialization commit; no database or production migration is involved.

## Open Questions

None. The owner designated Reviewer dskr.dev for a local fresh-context review and confirmed that agent-honored Anvil gates are sufficient; mechanical CI enforcement is out of scope.

Review round 1 returned `APPROVE_WITH_CHANGES`. Per Anvil, `test-plan.md` and `tasks.md` remain blocked until Reviewer dskr.dev re-checks these required changes and `review.md` records `CHANGES_APPLIED: yes`.
