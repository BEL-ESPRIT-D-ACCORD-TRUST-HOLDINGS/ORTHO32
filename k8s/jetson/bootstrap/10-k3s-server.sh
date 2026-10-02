#!/usr/bin/env bash
# Run on the control-plane node (one Orin, or a separate arm64 box).
set -euo pipefail

: "${K3S_VERSION:=}"   # pin explicitly, e.g. v1.31.x+k3s1 -- left empty = latest stable

curl -sfL https://get.k3s.io | \
  INSTALL_K3S_VERSION="${K3S_VERSION}" \
  INSTALL_K3S_EXEC="server \
    --write-kubeconfig-mode 644 \
    --disable traefik \
    --default-runtime nvidia \
    --node-label ortho32.io/accelerator=jetson-orin" \
  sh -

# Token for agents:
sudo cat /var/lib/rancher/k3s/server/node-token
# Verify containerd picked up the nvidia runtime:
sudo grep -n 'nvidia' /var/lib/rancher/k3s/agent/etc/containerd/config.toml
