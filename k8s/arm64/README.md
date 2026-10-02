# ORTHO32 on an ARM64 Kubernetes cluster (k3s)

Status: **manifests and images written; not yet built or run on a cluster.** The service-level fixes this
depends on were tested separately (see below), but the full chain host ⇄ gateway ⇄ API has never run together,
and no image has been built (no Docker daemon or .NET SDK was available).

## Decisions

| Choice | Why |
| --- | --- |
| k3s, version pinned by you | Small, ARM64-native, one binary per node. |
| No PyTorch/JAX/Ray, no GPU runtime on the Orin nodes | No service repo uses them. The API is Python (FastAPI) but needs no ML packages. |
| Custom CUDA stays on the RTX 3080 | It targets `sm_86` and (for `hyperkitty-loader`) the `nouveau` driver, which conflicts with the standard cluster GPU stack. Reach it as an external service: `manifests/40-external-cuda.yaml.example`. |
| One pod: host + gateway + API, shared `/tmp` | Their IPC is local Unix sockets (.NET named pipes on Linux). |

## Layout

- `bootstrap/` — node prep, k3s server, k3s agent.
- `images/` — `host.Dockerfile` (.NET 8), `gateway.Dockerfile` (M on YottaDB + socat/jq/curl), `api.Dockerfile` (FastAPI), `mcp.Dockerfile` (AWK, stdio).
- `manifests/` — namespace + default-deny ingress, the `ortho32-core` pod, `Service`, external-CUDA template.

## Runbook

```sh
# every node
./bootstrap/00-node-prep.sh
K3S_VERSION=<pinned> ./bootstrap/10-k3s-server.sh                                   # control plane
K3S_VERSION=<pinned> K3S_URL=https://<server>:6443 K3S_TOKEN=<token> ./bootstrap/20-k3s-agent.sh   # workers

# images (build from each repo's root; replace <registry>/<tag>)
docker buildx build --platform linux/arm64 -f images/host.Dockerfile    -t <registry>/ortho32-host:<tag>        --push <ortho32-host>
docker buildx build --platform linux/arm64 -f images/gateway.Dockerfile -t <registry>/ortho32-ai-gateway:<tag>  --push <ortho32-ai-gateway>
docker buildx build --platform linux/arm64 -f images/api.Dockerfile     -t <registry>/ortho32-api:<tag>         --push <ortho32-api>

# secrets (see the header of manifests/10-core.yaml), then edit REGISTRY/TAG and apply
kubectl apply -f manifests/00-namespace.yaml
kubectl -n ortho32 create secret generic ortho32-api --from-literal=secret-key="$(openssl rand -hex 32)"
kubectl -n ortho32 create secret generic ortho32-provider-keys --from-literal=openai=... --from-literal=anthropic=...
kubectl apply -f manifests/10-core.yaml
```

## Fixes this relies on (separate PRs, merge first)

The repos could not run together on Linux. Each item was found by reading the code and, where noted, confirmed by running it.

| Problem | Fix | Tested |
| --- | --- | --- |
| API connected to its own port 7032; wire schema differs from the host's (every request would be a ProtocolError); `pip install` failed | `ortho32-api#1` | 11 tests incl. a fake host over Unix socket and TCP |
| Gateway crashed on its first call (`DO` vs `$$`), never ran `curl` (`$ZF(-1)` is a no-op), had shell injection and key-on-argv, invalid JSON escaping, wrong event shape, and no server | `ortho32-ai-gateway#1` | 15 end-to-end checks vs a mock provider, on YottaDB r2.06 (x86_64) |
| Connection matrix pointed at deleted TypeScript files | `ortho32-host#1` | JSON validity only |

## Still unverified

- `ortho32-host` has not been built or run on Linux (no .NET SDK here). Assumed: it builds, `AddWindowsService` is a no-op, and named pipes appear as `/tmp/CoreFxPipe_<name>`.
- The API's `type` values are assumed to match the host router's `Action` names.
- The gateway has only been run against a mock provider, on x86_64, as root. The arm64 image, running YottaDB as uid 10001, and real OpenAI/Anthropic calls are untested.
- The gateway keeps its request/event log in an `emptyDir`; it is lost when the pod restarts.
- `ortho32-mcp` is stdio-only; run it with `kubectl run -i` / `exec -i`, or put an adapter in front. `ortho32-bridge` (referenced by the connection matrix) was not available to check.
- The API's built-in JWT secret is a public dev value; the manifest forces `SECRET_KEY` from a Secret.
