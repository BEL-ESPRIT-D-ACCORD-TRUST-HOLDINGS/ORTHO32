#!/usr/bin/env bash
# Worker node. Usage: K3S_VERSION=... K3S_URL=https://<server>:6443 K3S_TOKEN=... ./20-k3s-agent.sh
set -euo pipefail
: "${K3S_VERSION:?}" "${K3S_URL:?}" "${K3S_TOKEN:?}"

curl -sfL https://get.k3s.io | \
  INSTALL_K3S_VERSION="${K3S_VERSION}" K3S_URL="${K3S_URL}" K3S_TOKEN="${K3S_TOKEN}" \
  INSTALL_K3S_EXEC="agent" \
  sh -
