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

## Multica

The agent container has Multica, OpenSpec, and the official Codex CLI. The
Multica profile and Codex login are stored in the persistent `agent-home`
volume. Complete headless login inside the container with the official
Multica self-host setup/token flow, then restart `dev-agent` so it discovers
Codex.

OpenCode and OMP are not installed as Multica runtimes because the current
Multica supported-runtime list does not detect them. Add them later only if
Multica adds support or they are needed for manual, non-Multica work.
