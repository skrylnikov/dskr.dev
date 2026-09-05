# anvil

A spec-driven OpenSpec schema that drives **test-driven development** and **adversarial review gates** without the full ceremony of the crucible schema it was extracted from. Crucible schema is being reworked currently and will be available soon.

> **How gating works (read this first).** OpenSpec's `requires:` dependencies only enforce that an artifact *file exists* — not what it contains. The REVISE gate, TDD ordering, and "stop" preconditions in this schema are **instructions to the agent**, not mechanical enforcement. They are honored by the coding agent following the schema, not by the OpenSpec CLI. For mechanical enforcement, add a CI/git-hook check (see [Enforcement](#enforcement)).

## Flow

```
proposal → specs → design → review (adversarial gate) → test-plan → tasks → apply → verify
```

## What makes it different from the default schema

| Aspect | OpenSpec default | This schema (`anvil`) |
|--------|------------------------|------------------------------|
| Review gate | None | Adversarial review by a separate context/model, instructed to gate all downstream work |
| Test planning | None | Every spec scenario mapped 1:1 to a named test before tasks exist |
| Task structure | Free-form checklist | Mandatory red-green-refactor ordering per scenario |
| Spec rigor | ≥1 scenario per requirement | ≥1 happy-path AND ≥1 failure/edge scenario per requirement |
| Apply discipline | "Work through tasks" | Failing test must exist before implementation; no completion without evidence |
| Post-apply | None | Formal verification of TDD integrity, review compliance, and task completion |

## Artifacts

| Artifact | Generates | Purpose |
|----------|-----------|---------|
| `proposal` | proposal.md | Why this change is needed |
| `specs` | specs/**/*.md | What the system should do (testable scenarios) |
| `design` | design.md | How to implement it (decisions + rationale) |
| `review` | review.md | Adversarial gate — instructs the agent to block downstream work on REVISE |
| `test-plan` | test-plan.md | Scenario → test mapping (all start 🔴 red) |
| `tasks` | tasks.md | Red-green-refactor ordered checklist |
| `verify` | verify.md | Post-implementation proof of TDD + review compliance |

## Review rules

- **Never** self-review in the same context that authored the artifacts
- Prefer cross-model review (a second, different model reviews the work) using whatever CLI is actually installed — do not assume specific commands or flags
- Fallback: same model, fresh-context subagent (removes anchoring)
- If a spawned reviewer errors or is unavailable, do not self-review or fabricate a verdict — fall back to a fresh-context subagent, or STOP and surface the error
- Reviewer inspects everything read-only (view/grep/glob) and may write only its own review output (`review.md`) — never edits the artifacts under review, source code, or any other file
- **Data locality:** a cross-model reviewer may send `proposal.md`/`design.md`/`specs/` to an external provider. Only use a model your team has approved for this codebase's sensitivity; for confidential/regulated material with no approved external model, review locally (fresh-context subagent) instead. When in doubt, stay local.
- Three verdicts: **APPROVE**, **APPROVE WITH CHANGES**, **REVISE**
- REVISE instructs the agent to block everything until artifacts are fixed and re-reviewed
- **Severity-verdict consistency:** any open Critical finding forbids APPROVE — a review with Critical findings and `VERDICT: APPROVE` is itself invalid
- **Staleness:** a verdict covers only the exact contents reviewed. Editing `proposal.md`, `design.md`, or `specs/` afterward (other than applying listed Required Changes) voids the verdict and requires a new review round
- **Rebuttals are adjudicated:** an author rebuttal of a Critical or Moderate finding counts only after the reviewer re-checks and accepts it; only Suggestions may be declined by the author alone
- **Bounded loops:** each full re-review increments a round counter in `review.md`; after 2 consecutive REVISE rounds, the agent must stop and escalate to a human

## Enforcement

> [!IMPORTANT]
> **The core guarantee is advisory, not enforced.** TDD ordering and adversarial-review gating are *instructions to the agent*, not something the repo or the OpenSpec CLI materially checks. There is **no CI, git hook, or validation script in this bundle**. An author or agent can generate `test-plan.md`/`tasks.md` over a `REVISE` verdict, proceed on an unapplied `APPROVE_WITH_CHANGES`, skip red-green-refactor, or merge on `DECISION: FAIL`, and nothing here will stop them. If these gates must be *guaranteed*, add a mechanical check.

To enforce mechanically, parse these canonical fields (not the prose) in your own CI or pre-commit hook:

- `review.md` — `VERDICT: APPROVE | APPROVE_WITH_CHANGES | REVISE`
- `review.md` — `CHANGES_APPLIED: yes | no | n/a` (completion signal for `APPROVE_WITH_CHANGES`)
- `verify.md` — `DECISION: PASS | PASS_WITH_WARNINGS | FAIL`

**Allowlist success, don't denylist failure:** proceed only on `VERDICT: APPROVE` (or `APPROVE_WITH_CHANGES` with `CHANGES_APPLIED: yes`) and, once `tasks.md` exists, a `verify.md` with `DECISION: PASS`/`PASS_WITH_WARNINGS`. Treat a missing file or unfilled placeholder as blocking — absence of approval is not approval.

Minimal example (pre-commit hook or CI step, run from the change directory):

```bash
#!/usr/bin/env bash
set -euo pipefail

verdict=$(grep -E '^VERDICT: ' review.md | tail -1 || true)
case "$verdict" in
  "VERDICT: APPROVE") ;;
  "VERDICT: APPROVE_WITH_CHANGES")
    grep -qx 'CHANGES_APPLIED: yes' review.md \
      || { echo "BLOCKED: required changes not applied"; exit 1; } ;;
  *) echo "BLOCKED: no approving verdict in review.md"; exit 1 ;;
esac

if [ -f tasks.md ]; then
  decision=$(grep -E '^DECISION: ' verify.md 2>/dev/null | tail -1 || true)
  case "$decision" in
    "DECISION: PASS"|"DECISION: PASS_WITH_WARNINGS") ;;
    *) echo "BLOCKED: no passing decision in verify.md"; exit 1 ;;
  esac
fi
```

This checks only the canonical fields; it does not (and cannot) verify that the review was actually adversarial or the tests actually ran red first — those remain agent-honored.

## TDD rules

- Every spec scenario maps to a named test — a floor, not a ceiling (extra tests are welcome but never substitute for a scenario's named test)
- Tasks are ordered: write failing test → implement → refactor
- Tests must fail for the right reason (not import/syntax errors)
- `test-plan.md` is a live coverage ledger: rows start 🔴 red and are flipped 🟢 green during apply as their tests pass; `verify` blocks on any row left red
- **Spec drift:** if implementation reveals a spec is wrong, the agent must stop, amend the spec, re-run the review (the old verdict is void), and update the test plan — never silently edit the spec or weaken a test to match observed behavior
- No task is complete without a fresh test run as evidence; the final full-suite command and result summary are recorded in `verify.md`
- Verify checks: no skipped tests, no weakened assertions, no deleted tests without a REMOVED requirement
- **Non-executable changes** (docs, config, pure schema) are exempt from code tests: map each scenario to an equivalent mechanical check (e.g. `openspec schema validate`, a linter, a CI job) marked `N/A — non-executable`, and confirm that check passes in `verify`. Prose sign-off does not qualify.

## Usage

See [INSTALL.md](../../INSTALL.md) to install this schema into your project, then select it with `openspec new change <name> --schema anvil` (or set `schema: anvil` in `openspec/config.yaml`).

## Origin

Extracted from the crucible schema. Keeps TDD discipline and adversarial reviews; drops Superpowers skill dependencies, checksum pinning, brainstorming, brownfield baselines, retrospectives, and git-worktree orchestration.
