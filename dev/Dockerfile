FROM node:24.20.0-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PNPM_STORE_DIR=/pnpm-store
ENV PNPM_CONFIG_STORE_DIR=/pnpm-store
ENV PNPM_CONFIG_VIRTUAL_STORE_TYPE=project
ENV PATH=/pnpm/bin:/pnpm:/usr/local/bin:$PATH

RUN apt-get update \
  && apt-get install --no-install-recommends --yes \
    bash \
    build-essential \
    ca-certificates \
    curl \
    git \
    jq \
    openssh-client \
    python3 \
    wget \
  && npm install --global pnpm@12.1.0 @fission-ai/openspec@latest \
  && pnpm add --global --allow-build=opencode-ai opencode-ai \
  && curl -fsSL https://raw.githubusercontent.com/multica-ai/multica/main/scripts/install.sh | bash \
  && test -x /usr/local/bin/multica || install -m 0755 /root/.local/bin/multica /usr/local/bin/multica \
  && curl -fsSL https://chatgpt.com/codex/install.sh | bash \
  && test -x /usr/local/bin/codex || install -m 0755 /root/.local/bin/codex /usr/local/bin/codex \
  && install -m 0755 /root/.codex/packages/standalone/current/bin/codex-code-mode-host /usr/local/bin/codex-code-mode-host \
  && curl -fsSL https://omp.sh/install | sh \
  && test -x /usr/local/bin/omp || install -m 0755 /root/.local/bin/omp /usr/local/bin/omp \
  && mkdir -p /pnpm /home/node /workspace/node_modules \
  && mkdir -p /pnpm-store \
  && chown -R node:node /pnpm /pnpm-store /workspace /home/node \
  && rm -rf /var/lib/apt/lists/*

COPY dev/agent-entrypoint.sh /usr/local/bin/agent-entrypoint
RUN chmod 0755 /usr/local/bin/agent-entrypoint

USER node
WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/agent-entrypoint"]
