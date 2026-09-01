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

The agent container has Multica, OpenSpec, the official Codex CLI, and
OpenCode. Their credentials are stored in the persistent `agent-home` volume,
not in Git.

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
OMP is not added as a separate runtime because Multica does not detect it.
