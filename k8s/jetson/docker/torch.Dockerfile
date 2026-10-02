# PyTorch (+ your custom CUDA ops) for Jetson Orin. Build natively on a Jetson, or with buildx + QEMU
# (QEMU is fine for pip installs but NOT for compiling large CUDA extensions -- build those on-device).
#
# BASE must match the JetPack/L4T on the nodes (JetPack 6.x == L4T r36.x). Verify the tag exists:
#   https://github.com/dusty-nv/jetson-containers
ARG BASE=dustynv/l4t-pytorch:r36.4.0
FROM ${BASE}

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TORCH_CUDA_ARCH_LIST="8.7"
# 8.7 == Orin (Ampere, sm_87). Not 8.6 (that's the desktop RTX 3080) -- kernels built for 8.6 won't load on Orin.

# NOTE: do NOT `pip install torch` here -- on aarch64 PyPI serves CPU-only wheels and would
# shadow the CUDA build that ships in the base image.
RUN pip install "ray[default]==2.40.0" numpy pytest

WORKDIR /workspace
COPY python/ ./python/
COPY tests/ ./tests/

# Custom CUDA extension: uncomment and point at your source (none exists in these repos yet).
# COPY csrc/ ./csrc/
# RUN pip install --no-build-isolation ./csrc

CMD ["python3", "-m", "python.ortho32_invariant"]
