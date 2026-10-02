# ortho32-api (FastAPI) for linux/arm64. Only fastapi/uvicorn/pydantic/python-jose/httpx: no ML packages.
# Build context: the ortho32-api repo root. Needs the packaging fix in ortho32-api#1 (hatch wheel packages = ["app"]).
#   docker buildx build --platform linux/arm64 -f api.Dockerfile -t <registry>/ortho32-api:<tag> <path-to-ortho32-api>
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /srv
COPY pyproject.toml README.md ./
COPY app ./app
RUN pip install . && useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin ortho
# Reaches the host over its Unix socket in the shared /tmp (see app/ipc.py: ORTHO_HOST_SOCKET).
ENV ORTHO_HOST_SOCKET=/tmp/CoreFxPipe_ortho-host
USER 10001
EXPOSE 7032
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7032"]
