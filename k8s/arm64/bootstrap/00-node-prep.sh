#!/usr/bin/env bash
# Run on EVERY ARM64 node (Ubuntu 22.04+ assumed) before installing k3s.
set -euo pipefail

# Kubernetes requires swap off.
sudo swapoff -a
sudo sed -i '/\sswap\s/d' /etc/fstab
sudo systemctl disable --now nvzramconfig.service 2>/dev/null || true   # Jetson zram swap, if present

# Kernel modules and sysctls for pod networking.
printf 'overlay\nbr_netfilter\n' | sudo tee /etc/modules-load.d/k8s.conf >/dev/null
sudo modprobe overlay
sudo modprobe br_netfilter
printf 'net.bridge.bridge-nf-call-iptables = 1\nnet.ipv4.ip_forward = 1\n' \
  | sudo tee /etc/sysctl.d/99-k8s.conf >/dev/null
sudo sysctl --system >/dev/null

# Fail early if the node is not arm64.
[ "$(uname -m)" = "aarch64" ] || { echo "expected aarch64, got $(uname -m)" >&2; exit 1; }
echo "node prep ok"
