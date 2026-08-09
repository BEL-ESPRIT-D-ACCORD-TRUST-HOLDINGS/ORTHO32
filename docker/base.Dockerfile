# syntax = docker/dockerfile:1.4
FROM ubuntu:22.04 AS base

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC \
    LANG=C.UTF-8

RUN --mount=type=cache,target=/var/cache/apt \
    --mount=type=cache,target=/var/lib/apt \
    apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git gnupg2 lsb-release \
    build-essential cmake ninja-build pkg-config \
    python3 python3-pip python3-venv \
    wget unzip xz-utils && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
ARG UID=1000
ARG GID=1000
RUN groupadd -g ${GID} ortho && \
    useradd -m -u ${UID} -g ${GID} -s /bin/bash ortho

WORKDIR /workspace
RUN chown ortho:ortho /workspace
USER ortho
