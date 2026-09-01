## Test Plan

<!-- Every scenario from specs/ mapped to a concrete test. The mapping is a -->
<!-- floor, not a ceiling: extra tests are welcome but need no entry here. -->
<!-- LIVE LEDGER: during apply, flip each row 🔴 red → 🟢 green as its test -->
<!-- passes. verify blocks on any row left red. -->

This change has no executable application code (vendored schema files, generated
integration files, Dockerfile pin, documentation). Per the schema's
non-executable rule, every scenario maps to a mechanical CLI/file check instead
of a code test; each check can pass or fail and ran red against the
pre-implementation repository state.

Negative rows marked with `$SCRATCH` run the same check against a disposable
copy of the repository (rsync of the checkout excluding `node_modules`/`.git`)
with one element doctored or removed, outside the tracked tree.

| Requirement | Scenario | Test File | Test Name | Initial State |
|-------------|----------|-----------|-----------|---------------|
| specs/openspec-agent-workflow/spec.md → Repository-local Anvil workflow | Anvil resolves and validates | `openspec schema which anvil && openspec schema validate anvil --json` | anvil-schema-validates | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → Repository-local Anvil workflow | Missing or invalid schema is rejected | `$SCRATCH` copy with corrupted `openspec/schemas/anvil/schema.yaml`: `openspec schema validate anvil --json` | anvil-schema-invalid-rejected | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → Repository-local Anvil workflow | Vendored schema attribution is complete | `test -s openspec/schemas/anvil/LICENSE && grep -Fq 'Copyright (c) 2026 Jikku Joyce' openspec/schemas/anvil/LICENSE && grep -Fq 'https://github.com/jikkujoyce/openspec-schemas' openspec/schemas/anvil/UPSTREAM.md && grep -Fq '73eea60c622712a5d952ec1aec62da4e349f8c33' openspec/schemas/anvil/UPSTREAM.md` | anvil-attribution-complete | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → Repository-local Anvil workflow | Missing vendoring attribution is rejected | `$SCRATCH` copy with `openspec/schemas/anvil/LICENSE` deleted: same attribution check | anvil-attribution-missing-rejected | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → Anvil is the default for new changes | Default schema is selected | `openspec new change <scratch-name> --json` → change metadata `schema` is `anvil`; `openspec status --change <scratch-name> --json` → `schemaName` is `anvil`; scratch change deleted afterwards | default-schema-anvil | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → Anvil is the default for new changes | Explicit schema override remains possible | `openspec new change <scratch-name> --schema spec-driven --json` → metadata `schema` is `spec-driven`; `openspec/config.yaml` still selects `anvil`; scratch change deleted afterwards | schema-override-honored | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → Anvil is the default for new changes | Invalid schema override is rejected | `openspec new change <scratch-name> --schema definitely-not-a-real-schema --json` → exit non-zero, `change_error` status naming available schemas, no change directory created | invalid-schema-override-rejected | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → Codex integration | Codex discovers OpenSpec skills | integration manifest check (see Coverage Notes) against `.agents/skills/`: six `openspec-*` skills present and `.openspec-target` equals `codex` | codex-integration-manifest | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → Codex integration | Incomplete Codex generation is detected | `$SCRATCH` copy with one generated skill deleted: integration manifest check fails | codex-integration-incomplete-rejected | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → OpenCode integration | OpenCode exposes OpenSpec workflows | integration manifest check against `.opencode/skills/` and `.opencode/commands/`: six `openspec-*` skills and six `opsx-*` commands present | opencode-integration-manifest | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → OpenCode integration | Incomplete OpenCode generation is detected | `$SCRATCH` copy with one generated command deleted: integration manifest check fails | opencode-integration-incomplete-rejected | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → OMP integration | OMP exposes OpenSpec workflows | integration manifest check against `.omp/skills/` and `.omp/commands/`: six `openspec-*` skills and six `opsx-*` commands present | omp-integration-manifest | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → OMP integration | Wrong OMP target is rejected | `openspec init . --tools omp --no-animation` in an empty `$SCRATCH` directory exits non-zero, reports `omp` invalid, and creates no integration files; integration manifest check against a tree without `.omp/openspec-*` and `.omp/commands/` fails | omp-wrong-target-rejected | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → Reproducible OpenSpec generation | Development image uses the expected generator | `grep -Fq '@fission-ai/openspec@1.11.0' dev/Dockerfile`; host generator `openspec --version` prints `1.11.0`; container-level check is the documented maintainer command run in the rebuilt `dev-agent` image (host here has no `dev-agent` container runtime) | generator-version-pinned | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → Reproducible OpenSpec generation | Generator drift is detected | clean-diff check (see Coverage Notes): fresh scratch copy of the checkout, rerun `openspec init . --tools codex,opencode,oh-my-pi --no-animation`, `diff -r` the three integration trees against the tracked ones | generator-clean-diff | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → Maintainer guidance | Maintainer can reproduce and validate setup | the nine `grep -Fq` literal checks against `dev/README.md` named in the spec scenario | readme-setup-literals | N/A — non-executable |
| specs/openspec-agent-workflow/spec.md → Maintainer guidance | Advisory gates are not misrepresented | `grep -Fq 'Anvil review and TDD gates are agent-honored; OpenSpec validates artifact structure and dependencies, not verdict contents or execution order.' dev/README.md` exits zero; `grep -Eiq 'OpenSpec( CLI)? (mechanically )?(enforces\|blocks).*(REVISE\|red-green-refactor\|DECISION: FAIL)' dev/README.md` exits non-zero | readme-advisory-gates-wording | N/A — non-executable |

## Coverage Notes

- **Integration manifest check** (rows `codex-integration-manifest`,
  `opencode-integration-incomplete-rejected`, `opencode-integration-manifest`,
  `omp-integration-manifest`, `omp-wrong-target-rejected`): deterministic shell
  snippet parameterized by `$ROOT` and `$TOOLS`; it fails (non-zero) if any of
  the six `openspec-{propose,update-change,apply-change,explore,sync-specs,archive-change}`
  skill directories lacks a `SKILL.md`, if the `opsx-{propose,update,apply,explore,sync,archive}.md`
  commands are missing for the targets that have commands, or if
  `.agents/skills/.openspec-target` is not exactly `codex`:

  ```sh
  set -e
  for s in openspec-propose openspec-update-change openspec-apply-change \
           openspec-explore openspec-sync-specs openspec-archive-change; do
    test -f "$ROOT/.agents/skills/$s/SKILL.md"
    test -f "$ROOT/.opencode/skills/$s/SKILL.md"
    test -f "$ROOT/.omp/skills/$s/SKILL.md"
  done
  for c in opsx-propose opsx-update opsx-apply opsx-explore opsx-sync opsx-archive; do
    test -f "$ROOT/.opencode/commands/$c.md"
    test -f "$ROOT/.omp/commands/$c.md"
  done
  test "$(cat "$ROOT/.agents/skills/.openspec-target")" = "codex"
  ```

  The negative rows run the same snippet against a doctored scratch copy and
  assert a non-zero exit.

- **Non-executable justification**: the change adds configuration, vendored
  schema files, generated agent instructions, and documentation only — there is
  no code path a unit test could exercise. Each mapped check is a real tool
  invocation (`openspec schema validate`, `openspec new change`, `grep`, `test`,
  `diff -r`) with a binary result, satisfying the "mechanically checkable by
  SOME tool" rule. No prose sign-off is used anywhere.

- **Test infrastructure**: negative checks require only a scratch copy of the
  checkout (any full-copy mechanism excluding `node_modules`, `.git`, caches,
  and task scratch dirs) under `/tmp`, plus the pinned OpenSpec 1.11.0 CLI; no
  fixtures or shared utilities are needed. The host environment for this apply
  runs OpenSpec 1.11.0 (`/usr/local/bin/openspec`), matching the pinned
  Dockerfile version.

### Applied-state check run (2026-09-01, apply/verify)

All 17 checks ran against the implemented tree; every row's equivalent
mechanical validation is green. Negative rows were exercised against doctored
scratch copies outside the tracked tree:

- `anvil-schema-validates` — `openspec schema which anvil` resolves from
  `openspec/schemas/anvil` (`Source: project`); `openspec schema validate
  anvil --json` → `valid: true`, `issues: []`. ✅
- `anvil-schema-invalid-rejected` — corrupted `schema.yaml` (`version: bogus`)
  in a scratch copy → `valid: false`, exit 1. ✅
- `anvil-attribution-complete` — `test -s LICENSE` + copyright line +
  `UPSTREAM.md` URL and commit: exit 0; vendored files are byte-identical to
  the pinned commit (`cmp`/`diff -r`). ✅
- `anvil-attribution-missing-rejected` — scratch copy without `LICENSE` →
  check exits 1. ✅
- `default-schema-anvil` — `openspec new change <probe> --json` → change
  metadata `schema: anvil`; `openspec status --change <probe> --json` →
  `schemaName: anvil`; probe change deleted. ✅
- `schema-override-honored` — `--schema spec-driven` → change metadata
  `spec-driven`; `openspec/config.yaml` still `schema: anvil`; probe deleted. ✅
- `invalid-schema-override-rejected` — `--schema definitely-not-a-real-schema`
  → exit 1, `change_error` naming available schemas, no change directory. ✅
- `codex-integration-manifest` / `opencode-integration-manifest` /
  `omp-integration-manifest` — full manifest snippet green on the tracked
  trees (6 skills each, 6 `opsx-*` commands for OpenCode and OMP, target
  marker `codex`). ✅
- `codex-integration-incomplete-rejected` — scratch copy missing
  `openspec-explore/SKILL.md` → manifest exits 1. ✅
- `opencode-integration-incomplete-rejected` — scratch copy missing
  `opsx-sync.md` → manifest exits 1. ✅
- `omp-wrong-target-rejected` — `openspec init . --tools omp --no-animation`
  in an empty scratch dir → exit 1, `Invalid tool(s): omp`, no files created. ✅
- `generator-version-pinned` — `grep -Fq '@fission-ai/openspec@1.11.0'
  dev/Dockerfile` exit 0; host `openspec --version` → `1.11.0`. The
  container-level command for the rebuilt `dev-agent` image is documented in
  `dev/README.md` (this host has no `dev-agent` container runtime). ✅
- `generator-clean-diff` — fresh scratch copy, rerun
  `openspec init . --tools codex,opencode,oh-my-pi --no-animation`,
  `diff -r` on all three integration trees → zero drift. ✅
- `readme-setup-literals` — all ten required literals found in
  `dev/README.md` (nine spec literals plus the required `valid: true`
  literal is among them). ✅
- `readme-advisory-gates-wording` — required disclaimer sentence found
  (exit 0); forbidden enforcement-claim pattern not found (exit 1). ✅

No row remains red; no scenario is unmapped.
