# JAX with CUDA on Jetson Orin. JAX has no first-party Jetson wheel guarantee: confirm that a
# jax/jaxlib/CUDA-plugin combo exists for aarch64 + your CUDA version, or build from jetson-containers.
#   https://github.com/dusty-nv/jetson-containers  (has a `jax` package)
ARG BASE=dustynv/jax:r36.4.0
FROM ${BASE}

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 XLA_PYTHON_CLIENT_PREALLOCATE=false
# Orin shares RAM between CPU and GPU: JAX's default 75% preallocation will starve the node. Keep it off.

WORKDIR /workspace
# If the base image lacks JAX, try (JetPack 6 / CUDA 12 only; verify wheel availability first):
# RUN pip install "jax[cuda12]"
RUN python3 -c "import jax; print(jax.__version__, jax.devices())"
