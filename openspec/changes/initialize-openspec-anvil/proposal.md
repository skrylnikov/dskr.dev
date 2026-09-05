## Why

The repository's development image installs OpenSpec, Codex, OpenCode, and Oh My Pi (OMP), but the repository has no tracked OpenSpec root, workflow schema, or agent-specific OpenSpec instructions. Contributors therefore do not share a reproducible specification workflow, and new changes default to OpenSpec's built-in workflow instead of the requested Anvil review and TDD gates.

## What Changes

- Initialize a repository-local OpenSpec root and make `anvil` the default workflow schema.
- Vendor the Anvil schema from `jikkujoyce/openspec-schemas` at researched commit `73eea60c622712a5d952ec1aec62da4e349f8c33`, including its upstream MIT license and provenance metadata, so use does not depend on the mutable `main` branch or network access.
- Generate and track OpenSpec integrations for Codex, OpenCode, and OMP with OpenSpec 1.11.0 (`oh-my-pi` is the OpenSpec tool identifier for OMP).
- Pin the OpenSpec CLI in the development image to the same version that generated the tracked integrations.
- Document schema provenance, refresh procedure, validation commands, and the advisory nature of Anvil's review/TDD gates.

## Capabilities

### New Capabilities

- `openspec-agent-workflow`: A repository-local, reproducible Anvil workflow usable from Codex, OpenCode, and OMP.

### Modified Capabilities

- None.

## Impact

- New tracked paths under `openspec/`, `.agents/skills/`, `.opencode/`, and `.omp/`; the vendored schema includes `openspec/schemas/anvil/LICENSE` and `openspec/schemas/anvil/UPSTREAM.md` for license compliance and provenance.
- `dev/Dockerfile` changes from an unpinned `@fission-ai/openspec@latest` install to OpenSpec 1.11.0.
- `dev/README.md` gains setup, maintenance, and validation instructions.
- Application runtime behavior, public APIs, database state, credentials, and production images are unchanged.
