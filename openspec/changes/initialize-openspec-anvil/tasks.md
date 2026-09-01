## 1. Pin the OpenSpec generator

- [x] 1.1 Run `grep -Fq '@fission-ai/openspec@1.11.0' dev/Dockerfile` (test-plan `generator-version-pinned`); confirm it fails for the right reason (Dockerfile still installs `@fission-ai/openspec@latest`)
- [x] 1.2 Implement: replace `@fission-ai/openspec@latest` with `@fission-ai/openspec@1.11.0` in `dev/Dockerfile` to pass 1.1
- [x] 1.3 Confirm `openspec --version` on the host reports `1.11.0`; the rebuilt `dev-agent` container check is documented in `dev/README.md` (see 5.2); no other Dockerfile lines change

## 2. Vendor the Anvil schema

- [x] 2.1 Run the test-plan checks `anvil-schema-validates`, `anvil-schema-invalid-rejected` precondition, `anvil-attribution-complete`, `anvil-attribution-missing-rejected` precondition; confirm they fail for the right reason (`openspec/schemas/anvil` does not exist yet)
- [x] 2.2 Implement: copy the complete `schemas/anvil` directory from `jikkujoyce/openspec-schemas` commit `73eea60c622712a5d952ec1aec62da4e349f8c33` into `openspec/schemas/anvil/`, copy the upstream repository-root MIT `LICENSE` to `openspec/schemas/anvil/LICENSE`, and add `openspec/schemas/anvil/UPSTREAM.md` with the source URL and exact commit
- [x] 2.3 Run `openspec schema which anvil` and `openspec schema validate anvil --json`; confirm `valid: true` and no issues; run the attribution check and the doctored-scratch negative variants; all green

## 3. Generate and track agent integrations

- [x] 3.1 Run the integration manifest check (test-plan `codex-integration-manifest`, `opencode-integration-manifest`, `omp-integration-manifest`, `omp-wrong-target-rejected` precondition); confirm it fails for the right reason (`.agents/skills/`, `.opencode/skills|commands/`, `.omp/skills|commands/` not generated yet)
- [x] 3.2 Implement: run `openspec init . --tools codex,opencode,oh-my-pi --no-animation` from the repository root; confirm the pre-existing `openspec/changes/initialize-openspec-anvil/` directory is preserved
- [x] 3.3 Run the integration manifest check against the generated trees and the doctored-scratch negative variants (missing skill, missing command, `--tools omp` alias); all green; leave the multica runtime skills already present under `.omp/skills/` untracked

## 4. Set Anvil as the project default

- [x] 4.1 Run the test-plan checks `default-schema-anvil`, `schema-override-honored`, `invalid-schema-override-rejected` precondition; confirm `default-schema-anvil` fails for the right reason (`openspec/config.yaml` still selects `spec-driven`)
- [x] 4.2 Implement: set `schema: anvil` in `openspec/config.yaml`
- [x] 4.3 Re-run all three checks (scratch changes created, inspected, and deleted afterwards); confirm the default resolves to `anvil`, the override still works without touching the project default, and the invalid override is rejected with `change_error`

## 5. Document setup, validation, and maintenance

- [x] 5.1 Run the test-plan checks `readme-setup-literals` and `readme-advisory-gates-wording`; confirm both fail for the right reason (`dev/README.md` has no OpenSpec section yet)
- [x] 5.2 Implement: add the OpenSpec setup, maintenance, and validation section to `dev/README.md` containing every literal the spec scenario requires: the init command, the upstream repository URL, the pinned commit, both validation commands (`openspec schema validate anvil --json`, `openspec validate --all --strict --json`), the refresh command (`openspec update .`), the three integration paths (`.agents/skills`, `.opencode`, `.omp`), `valid: true`, the rebuilt-image `openspec --version` check, the agent-honored-gates disclaimer sentence, and the coexistence note for generated vs. runtime agent skills
- [x] 5.3 Re-run the nine literal greps and the advisory-gates wording pair (required sentence present, forbidden enforcement-claim pattern absent); all green

## 6. Full validation sweep

- [x] 6.1 Run `openspec schema which anvil && openspec schema validate anvil --json`; confirm `valid: true`
- [x] 6.2 Run `openspec validate --all --strict --json`; confirm the `initialize-openspec-anvil` change and the project validate with zero issues
- [x] 6.3 Run the clean-diff check (test-plan `generator-clean-diff`): fresh scratch copy of the checkout, rerun `openspec init . --tools codex,opencode,oh-my-pi --no-animation`, `diff -r` the three integration trees against the tracked ones; confirm zero drift
- [x] 6.4 Flip every test-plan.md row to its final state (check run green) and mark all tasks `[x]`; hand off to `verify`
