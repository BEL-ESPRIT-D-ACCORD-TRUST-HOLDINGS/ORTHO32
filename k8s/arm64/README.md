# ORTHO32 on an ARM64 Kubernetes cluster (k3s)

Status: **foundation only, not end-to-end.** Nothing here has been built or run on hardware.
What was checked: shell syntax, YAML parsing, and `ortho32-mcp`'s own test suite on `mawk`.
Not checked: any image build (`host.Dockerfile` needs the .NET SDK, which was unavailable), any `kubectl apply`.

## Decisions

| Choice | Why |
| --- | --- |
| k3s, version pinned by you | Small, ARM64-native, one binary per node. |
| No Python, no PyTorch/JAX, no Ray | None of the ORTHO32 service repos needs them. |
| No GPU runtime on the Orin nodes | Nothing in the repos uses the Orin GPU, so the NVIDIA runtime and device plugin would be unused moving parts. Add them when a workload needs them. |
| Custom CUDA stays on the RTX 3080 | It targets `sm_86` and (for `hyperkitty-loader`) the `nouveau` driver, which conflicts with the standard cluster GPU stack. Reach it as an external service: `manifests/40-external-cuda.yaml.example`. |
| One pod, shared `/tmp` | `ortho-host` / `ortho-ai` are local named pipes (Unix sockets on Linux). Peers must share the pod. |

## Layout

- `bootstrap/` — node prep, k3s server, k3s agent.
- `images/` — `host.Dockerfile` (.NET 8, linux/arm64), `mcp.Dockerfile` (AWK, stdio).
- `manifests/` — namespace + default-deny ingress, the `ortho32-core` pod, external-CUDA template.

## Runbook

```sh
# every node
./bootstrap/00-node-prep.sh
# control plane
K3S_VERSION=<pinned> ./bootstrap/10-k3s-server.sh
# each worker
K3S_VERSION=<pinned> K3S_URL=https://<server>:6443 K3S_TOKEN=<token> ./bootstrap/20-k3s-agent.sh

# images (replace <registry>/<tag>)
docker buildx build --platform linux/arm64 -f images/host.Dockerfile -t <registry>/ortho32-host:<tag> --push <path-to-ortho32-host>
docker buildx build --platform linux/arm64 -f images/mcp.Dockerfile  -t <registry>/ortho32-mcp:<tag>  --push <path-to-ortho32-mcp>

# edit REGISTRY/TAG in manifests/10-core.yaml, then
kubectl apply -f manifests/00-namespace.yaml -f manifests/10-core.yaml
```

## Integration gaps (why this is not end-to-end)

Found by reading the code; each blocks a working Linux deployment regardless of Kubernetes.

1. **API cannot reach the host on Linux.** `ortho32-api/app/ipc.py` uses a Windows pipe via `pywin32`, else falls back to TCP `127.0.0.1:7032`. `ortho32-host` has no TCP listener (only `NamedPipeServerStream("ortho-host")`), and 7032 is also the API's own port.
2. **Gateway has no server.** `ortho32-ai-gateway/m/*.m` are routines (`REQ^ORTHOAI`, ...) that write events to stdout (`ORTIPC.m`). Nothing listens on the `ortho-ai` pipe that `ortho32-host/Services/InferenceService.cs` connects to.
3. **Stale connection matrix.** `ortho32-host/RUNTIME_CONNECTION_MATRIX.json` points at `ortho32-ai-gateway/src/ipc/*.ts`, which no longer exists.
4. **Provider keys on the command line.** `ORTPROV.m` builds a `curl ... -H "Authorization: Bearer <key>"` string, so the key is visible in the process list inside the container.
5. **MCP is stdio-only.** `ortho32-mcp` is not a network service; run it with `kubectl run -i` / `exec -i`, or put an adapter in front.

None of these is changed here; they live in other repos.

## Unverified assumptions

- .NET maps named pipes to Unix sockets under `/tmp` (`CoreFxPipe_<name>`), so a shared `/tmp` emptyDir is enough.
- `ortho32-host` builds and starts on Linux (`AddWindowsService` is expected to be a no-op there).
- Pod Security `restricted` is compatible with the host process as written.
