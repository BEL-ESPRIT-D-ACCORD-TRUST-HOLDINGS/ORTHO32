#!/usr/bin/env bash
# Run on EVERY Jetson Orin node (JetPack 6.x / L4T r36.x assumed) before installing k3s.
set -euo pipefail

# 1. Max performance, no thermal/power surprises mid-job
sudo nvpmodel -m 0 || true          # MAXN mode (model numbers differ per module; check `nvpmodel -q`)
sudo jetson_clocks || true

# 2. Kubernetes requirements: no swap/zram, cgroup memory
sudo swapoff -a
sudo systemctl disable --now nvzramconfig.service 2>/dev/null || true
sudo sed -i '/swap/d' /etc/fstab

# 3. NVIDIA container runtime (ships with JetPack; make sure it's present)
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit nvidia-container-runtime
# k3s auto-registers the `nvidia` containerd runtime ONLY if the binary exists when k3s first starts.
command -v nvidia-container-runtime

# 4. Kernel modules / sysctls for CNI
cat <<'EOF' | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay br_netfilter
cat <<'EOF' | sudo tee /etc/sysctl.d/99-k8s.conf
net.bridge.bridge-nf-call-iptables = 1
net.ipv4.ip_forward = 1
EOF
sudo sysctl --system

# 5. Storage: put container images/ephemeral data on NVMe, not the SD card
echo "Mount NVMe at /var/lib/rancher before installing k3s (see README)."
