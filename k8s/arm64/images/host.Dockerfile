# ORTHOHost (.NET 8) for linux/arm64.
# Build context: the ortho32-host repo root.
#   docker buildx build --platform linux/arm64 -f host.Dockerfile -t <registry>/ortho32-host:<tag> <path-to-ortho32-host>
# Pure managed publish, so the SDK stage can run on any build machine.
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ortho32-host.csproj ./
RUN dotnet restore -r linux-arm64
COPY . .
RUN dotnet publish ortho32-host.csproj -c Release -r linux-arm64 --self-contained false --no-restore -o /out

FROM mcr.microsoft.com/dotnet/runtime:8.0
# Named pipes map to Unix sockets under $TMPDIR (default /tmp); the pod mounts an emptyDir there.
ENV DOTNET_EnableDiagnostics=0
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin ortho
WORKDIR /app
COPY --from=build /out ./
USER 10001
ENTRYPOINT ["dotnet", "ortho32-host.dll"]
