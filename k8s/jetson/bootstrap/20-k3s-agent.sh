#!/usr/bin/env bash
# Run on every additional Jetson. Usage: K3S_URL=https://<server-ip>:6443 K3S_TOKEN=<token> ./20-k3s-agent.sh
set -euo pipefail
: "${K3S_URL:?}" "${K3S_TOKEN:?}" "${K3S_VERSION:=}"

curl -sfL https://get.k3s.io | \
  INSTALL_K3S_VERSION="${K3S_VERSION}" \
  K3S_URL="${K3S_URL}" K3S_TOKEN="${K3S_TOKEN}" \
  INSTALL_K3S_EXEC="agent \
    --default-runtime nvidia \
    --node-label ortho32.io/accelerator=jetson-orin \
    --node-label workload-type=verification" \
  sh -
