# Dev VM

This stack runs the dskr.dev frontend, IndieWeb backend, PostgreSQL, Caddy,
and the Multica daemon on `192.168.1.32`.

## First start

```sh
cp dev/.env.example dev/.env
# edit dev/.env and set all secret values
dev/devctl bootstrap
```

The VM-side checkout is kept on one branch at a time. `devctl deploy` refuses
dirty worktrees and non-`master` branches, so an active Multica task cannot be
overwritten by deployment.

## Git and deployment

1. Work on a feature branch and push it.
2. Open a PR into `master` and wait for CI.
3. Merge the PR manually.
4. Finish the active task, switch the VM checkout to `master`, and run:

```sh
dev/devctl deploy
```

The command performs a fast-forward-only update, installs from the lockfile,
rebuilds Compose, and checks PostgreSQL, backend, frontend, and Caddy.

## AI runtimes

The agent container has Multica, OpenSpec, the official Codex CLI, OpenCode,
and OMP (Oh My Pi). Their credentials are stored in the persistent `agent-home`
volume, not in Git.

Authenticate Codex with ChatGPT:

```sh
docker compose --env-file dev/.env -f dev/compose.yaml exec -it dev-agent codex --login
```

Authenticate an OpenCode provider interactively:

```sh
docker compose --env-file dev/.env -f dev/compose.yaml exec -it dev-agent opencode
```

Then run `/connect` in OpenCode and select the provider. The Multica daemon
continues to use its own self-host token and detects the installed runtimes.

Authenticate OMP interactively:

```sh
docker compose --env-file dev/.env -f dev/compose.yaml exec -it dev-agent omp
```

Then run `/login` and select the provider. Multica detects OMP as the `omp`
runtime after the daemon is restarted.

## OpenSpec

The repository is an OpenSpec project using the vendored
[`anvil` schema](https://github.com/jikkujoyce/openspec-schemas), pinned at
commit `73eea60c622712a5d952ec1aec62da4e349f8c33` (provenance and update
policy: `openspec/schemas/anvil/UPSTREAM.md`). New changes default to Anvil;
pass `--schema` to use a different installed schema for a single change.

The generated agent integrations are tracked in Git under `.agents/skills`
(Codex), `.opencode` (skills and slash commands), and `.omp` (skills and slash
commands). Refresh them only with the pinned CLI:

```sh
openspec update .
```

To (re)initialize the integrations from scratch — the command preserves
existing `openspec/changes/` content:

```sh
openspec init . --tools codex,opencode,oh-my-pi --no-animation
```

If a refresh or regeneration changes tracked integration files, review the
diff before accepting it (generator-drift check).

The `dev-agent` image pins the generator as `@fission-ai/openspec@1.11.0`.
After rebuilding the image, confirm the container generator matches the
version that produced the tracked files:

```sh
docker compose --env-file dev/.env -f dev/compose.yaml exec -it dev-agent openspec --version
# must print 1.11.0
```

Validate the setup after every schema, CLI, or configuration change:

```sh
openspec schema validate anvil --json
openspec validate --all --strict --json
```

Both must report `valid: true` / zero issues.

Anvil review and TDD gates are agent-honored; OpenSpec validates artifact structure and dependencies, not verdict contents or execution order. There is no CI or git-hook gate for these semantics in this repository; add one if bypass prevention becomes necessary. Verdict values such as REVISE are honored by the agents following the schema instructions, not by the CLI.

Coexistence note: `.omp/skills/` also contains runtime-managed skills
installed by the Multica daemon, and `.opencode/` contains OpenCode's local
package files ignored via its own `.gitignore`. Only the OpenSpec-generated
`openspec-*` skills, `opsx-*` commands, and `.agents/skills/.openspec-target`
belong to this setup; never hand-edit generated files.
