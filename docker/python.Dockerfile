FROM ortho32/base AS python

USER root
RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-venv python3.11-dev && \
    rm -rf /var/lib/apt/lists/*

USER ortho
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /workspace
COPY --chown=ortho:ortho python/ ./python/
RUN python3 -m venv .venv && \
    .venv/bin/pip install torch numpy

ENTRYPOINT [".venv/bin/python"]
CMD ["-m", "python.ortho32_invariant"]
