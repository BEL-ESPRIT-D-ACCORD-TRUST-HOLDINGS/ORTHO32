# ortho32-ai-gateway (M on YottaDB) for linux/arm64.
# Build context: the ortho32-ai-gateway repo root.
#   docker buildx build --platform linux/arm64 -f gateway.Dockerfile -t <registry>/ortho32-ai-gateway:<tag> <path-to-ortho32-ai-gateway>
# YottaDB is installed with its own installer at build time. The gateway's tests/e2e.sh was run against r2.06
# on x86_64; the arm64 build of this image has not been built or run.
FROM debian:bookworm-slim AS ydb
ARG YDB_VERSION=r2.06
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl file libelf1 libtinfo6 tar gzip \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL -o /tmp/ydbinstall.sh https://gitlab.com/YottaDB/DB/YDB/-/raw/master/sr_unix/ydbinstall.sh \
    && chmod +x /tmp/ydbinstall.sh \
    && /tmp/ydbinstall.sh --installdir /opt/yottadb --force-install ${YDB_VERSION}

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl jq socat libelf1 libtinfo6 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin ortho \
    && mkdir -p /var/lib/ortho32-ai && chown 10001 /var/lib/ortho32-ai
COPY --from=ydb /opt/yottadb /opt/yottadb
COPY m/ /opt/ortho32-ai/m/
COPY bin/ /opt/ortho32-ai/bin/
ENV ydb_dist=/opt/yottadb ORTHO_DATA=/var/lib/ortho32-ai
USER 10001
# Listens on /tmp/CoreFxPipe_ortho-ai (shared with the host container). Keys: OPENAI_API_KEY / ANTHROPIC_API_KEY.
ENTRYPOINT ["/opt/ortho32-ai/bin/ortho-ai-serve.sh"]
