#!/usr/bin/env bash
# Control-plane node. Pin K3S_VERSION; do not install "latest" on a cluster you care about.
set -euo pipefail
: "${K3S_VERSION:?set K3S_VERSION, e.g. from https://github.com/k3s-io/k3s/releases}"

curl -sfL https://get.k3s.io | \
  INSTALL_K3S_VERSION="${K3S_VERSION}" \
  INSTALL_K3S_EXEC="server --write-kubeconfig-mode 640 --disable traefik" \
  sh -

echo "agent join token (keep secret):"
sudo cat /var/lib/rancher/k3s/server/node-token
