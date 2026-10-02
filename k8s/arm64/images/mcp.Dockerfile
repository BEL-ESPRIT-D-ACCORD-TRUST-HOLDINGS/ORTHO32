# ortho32-mcp: stdio MCP server in AWK. Multi-arch because it is just mawk + one script.
# Build context: the ortho32-mcp repo root. mawk is the awk its test suite was run against.
#   docker buildx build --platform linux/arm64 -f mcp.Dockerfile -t <registry>/ortho32-mcp:<tag> <path-to-ortho32-mcp>
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends mawk \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin ortho
COPY bin/ortho32-mcp.awk /app/ortho32-mcp.awk
USER 10001
# stdio protocol: run with `kubectl run -i` / `kubectl exec -i`, not as a network Service.
ENTRYPOINT ["mawk", "-f", "/app/ortho32-mcp.awk"]
