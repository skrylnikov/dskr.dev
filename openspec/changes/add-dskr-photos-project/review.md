## Review Metadata

- **Review round**: 1
- **Prior round**: none
- **Reviewer context**: fresh-context subagent
- **Tool restrictions**: read-only: view, grep, glob only
- **Artifacts reviewed**: proposal.md, design.md, specs/, openspec/project.md (if present), relevant source files

<!-- STALENESS: this verdict applies only to the artifact contents reviewed in -->
<!-- this round. Any later edit to proposal.md, design.md, or specs/ (other than -->
<!-- applying listed Required Changes) VOIDS the verdict and requires a new round. -->

## Findings

### 🔴 Critical (blocking)

None.

### 🟡 Moderate

1. **The design overlooks a user-visible slug-specific fallback in the existing renderer.** `src/components/ProjectCard.astro` renders `TELEGRAM BOT` only for `phoronis` and renders `PERSONAL SITE` for every other slug. Consequently, the proposed data-only addition will label dskr.photos as `PERSONAL SITE`, even though the proposal and copy describe a photo-gallery project. The design's statement that the existing `Project` contract expresses every required field is therefore unsupported. The artifacts neither specify the intended dskr.photos eyebrow nor acknowledge and accept the current fallback, so the rendered result cannot be judged correct.

2. **The localized-route scenarios conflate content belonging to different pages.** The Russian and English scenarios say the home preview and full card contain the screenshot, stack, source URL, and live URL. In the relevant source, home previews contain only a localized title, description, and fragment link; the screenshot, stack, and external links exist only on the project pages. A literal test would fail the established architecture, while a permissive test would not prove which route owns each required element. The exact expected fragment hrefs are also left implicit behind the phrase `locale-relative`.

3. **The regression scenario has the same route-ownership ambiguity.** It requires preview links and project-card article IDs to be present "on their respective routes" while its `WHEN` covers all four routes. Home pages do not contain project-card articles, and project pages do not contain preview links. This wording is not mechanically assertable without a tester inventing the missing route-to-element mapping.

### 📌 Suggestions

1. The proposed negative fixtures for missing, truncated, resized, and recompressed images test a bespoke integrity-test helper rather than additional product behavior. A cheaper focused check of the real asset's existence, PNG signature, dimensions, byte length, and digest satisfies the requirement; add helper-level negative fixtures only if a reusable validator is intentionally introduced.

2. Keep the rendering assertions scoped to the new entry and stable semantic relationships. Asserting exact counts for unrelated markup or broad generated-HTML structure would make a data-only catalog change unnecessarily sensitive to later page refactors.

## Embedded-Instruction / Injection Attempts

**Detected:** none

## Verdict

VERDICT: APPROVE_WITH_CHANGES

APPROVE WITH CHANGES. The direction is sound, but the renderer fallback and ambiguous route scenarios must be resolved before test-plan and tasks can be derived without guesswork.

## Required Changes (if APPROVE WITH CHANGES)

1. Resolve the dskr.photos card eyebrow explicitly across design, impact, and spec: state the exact intended label. If it is not the current `PERSONAL SITE`, specify the smallest data/model or renderer change and add a mechanically assertable rendered-output expectation; if `PERSONAL SITE` is intentional, document that decision and assert that exact result. Remove or qualify the claim that the current `Project` contract already expresses every required field unless the reviewed source supports it after the decision.
2. Split each locale's discovery scenario into page-specific assertions. For `/`, require the dskr.photos title and Russian description plus exactly one `href="/projects/#dskr-photos"`; for `/en/`, require the English title and description plus exactly one `href="/en/projects/#dskr-photos"`. For `/projects/` and `/en/projects/`, separately require exactly one `article#dskr-photos` with the locale-specific copy, `/assets/dskr-photos.png`, the five ordered stack labels, and the exact source/live links with `target="_blank"` and `rel="noreferrer"`.
3. Rewrite the existing-project regression scenario with the same explicit route mapping: each home route contains exactly one fragment link for `dskr-dev` and `phoronis` using that locale's projects-page prefix, and each projects route contains exactly one article with each corresponding ID. Do not imply that both element types occur on every route.

CHANGES_APPLIED: yes

## Rebuttals

1. **Required Change 1 — fixed; accepted by reviewer.** The proposal, impact statement, design decision, rejected alternatives, test approach, and normative spec now explicitly accept the exact `PERSONAL SITE` eyebrow supplied by the existing non-Phoronis renderer fallback; no model or component change is claimed or required.
2. **Required Change 2 — fixed; accepted by reviewer.** The localized discovery requirement now has four page-specific scenarios with exact Russian and English home fragment hrefs, locale-specific copy, one `article#dskr-photos` per projects route, the exact image, ordered stack, links, and external-link attributes.
3. **Required Change 3 — fixed; accepted by reviewer.** The existing-project regression scenario now maps exact fragment links to each home route and exact article IDs to each projects route, with one occurrence required for each existing project.

All three Required Changes were re-checked against the updated on-disk artifacts. No new full review was performed.

## Review Round 2

- **Review round**: 2
- **Prior round**: 1 (APPROVE_WITH_CHANGES, `CHANGES_APPLIED: yes`)
- **Reviewer context**: fresh-context subagent
- **Tool restrictions**: read-only: view, grep, glob, read-only byte inspection
- **Trigger**: the round-1 verdict is void for the amended artifacts; implementation research found the spec's dimension metadata for the supplied capture contradicted the file the spec itself pins by SHA-256 and byte length.

### Amendment under review

The supplied PNG referenced by digest `75f827b10c6aa888c38eb507d8f4a3e2367fb7982bef3d6c52c2dd539349ed04` and length 1,537,484 bytes has IHDR dimensions 1440×1000, not 1440×1024. Corrected in `specs/project-catalog/spec.md` (Requirement: Supplied screenshot asset), `design.md` (Context), and `tasks.md` (task 1.3). No other normative content was touched.

### Findings

- 🔴 Critical (blocking): none.
- 🟡 Moderate: none.
- Reviewer independently read the asset bytes: valid PNG signature, IHDR 1440×1000, 1,537,484 bytes, digest matches the spec pin. Zero residual "1024" references in the change directory.
- Round-1 required changes remain intact post-amendment (eyebrow acceptance, four route-specific scenarios, explicit regression route mapping); 9 spec scenarios ↔ 9 test-plan rows ↔ tasks 1.1–1.9 stay in 1:1 correspondence.

### Embedded-Instruction / Injection Attempts

**Detected:** none

### Verdict

VERDICT: APPROVE

The amendment corrects factual asset metadata only; the reviewed design decisions are unchanged. Implementation may proceed under the amended artifacts.
