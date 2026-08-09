# ORTHO-32 Kubernetes Deployment

Complete Kubernetes infrastructure for ORTHO-32 deterministic matrix accelerator verification pipeline (H=0.0 entropy).

## Manifest Files

1. **namespace.yaml** - Namespace + ResourceQuota
2. **pvc.yaml** - PersistentVolumeClaims (workspace 50Gi, cache 20Gi)
3. **configmap.yaml** - Test vectors and configuration
4. **rbac.yaml** - ServiceAccount + Role + RoleBinding
5. **verification-job.yaml** - Parameterized Job template with 3 containers
6. **cronjob.yaml** - Nightly regression at 2:00 AM UTC daily

## Resource Allocation

- **Requests:** 32 CPU / 64Gi memory
- **Limits:** 64 CPU / 128Gi memory
- **Job timeout:** 2 hours
- **TTL after completion:** 24 hours
- **Node affinity:** `workload-type=verification`

## Quick Start

### 1. Deploy Infrastructure

```bash
# Create namespace and resource quota
kubectl apply -f namespace.yaml

# Create persistent volume claims
kubectl apply -f pvc.yaml

# Create test configuration
kubectl apply -f configmap.yaml

# Create RBAC (ServiceAccount, Role, RoleBinding)
kubectl apply -f rbac.yaml
```

### 2. Verify Setup

```bash
# Check namespace
kubectl get namespace ortho32-verification

# Check resource quota
kubectl get resourcequota -n ortho32-verification

# Check PVCs
kubectl get pvc -n ortho32-verification

# Check ConfigMap
kubectl get configmap -n ortho32-verification

# Check RBAC
kubectl get serviceaccount,role,rolebinding -n ortho32-verification
```

### 3. Run Verification Job

```bash
# Deploy one-time verification job
kubectl apply -f verification-job.yaml

# Watch job progress
kubectl get jobs -n ortho32-verification -w

# Check pod status
kubectl get pods -n ortho32-verification

# View logs (replace <pod-name> with actual pod)
kubectl logs -n ortho32-verification <pod-name> -c python-tests
kubectl logs -n ortho32-verification <pod-name> -c edge-case-tests
kubectl logs -n ortho32-verification <pod-name> -c result-aggregator
```

### 4. Deploy Nightly Regression

```bash
# Deploy CronJob for nightly runs
kubectl apply -f cronjob.yaml

# Check CronJob status
kubectl get cronjobs -n ortho32-verification

# View CronJob schedule
kubectl describe cronjob ortho32-nightly-regression -n ortho32-verification

# Manually trigger a run (optional)
kubectl create job --from=cronjob/ortho32-nightly-regression \
  ortho32-manual-run -n ortho32-verification
```

## Job Architecture

### Init Container: git-clone
- Clones ORTHO-32 repository from GitHub
- Records commit hash and metadata
- Writes to `/workspace/ortho32/`

### Container 1: python-tests
- Runs `pytest tests/test_edge_cases.py -v`
- Generates JUnit XML and HTML reports
- Writes results to `/workspace/results/`
- Exit code saved for aggregation

### Container 2: edge-case-tests
- Validates specific edge cases:
  - Zero matrix entropy (H=0.0)
  - Identity matrix determinant (det=1.0)
  - Orthogonal matrix properties (Q^T Q = I)
- Waits for python-tests to start
- Writes JSON results

### Container 3: result-aggregator
- Waits for both test containers to complete
- Aggregates all results into unified summary
- Generates `/workspace/results/verification-summary.json`
- Prints final status to logs

## Accessing Results

### From Within Cluster

```bash
# Exec into a pod
kubectl exec -it <pod-name> -n ortho32-verification -- /bin/bash

# View results directory
ls -lh /workspace/results/

# Read summary
cat /workspace/results/verification-summary.json
```

### Copy Results Locally

```bash
# Get pod name
POD=$(kubectl get pods -n ortho32-verification -l job-type=verification -o jsonpath='{.items[0].metadata.name}')

# Copy results directory
kubectl cp ortho32-verification/${POD}:/workspace/results ./local-results
```

### View Nightly Regression Results

```bash
# Latest nightly results (symlink)
kubectl exec -it <pod-name> -n ortho32-verification -- \
  cat /workspace/results/nightly-latest/nightly-summary.json

# Specific nightly run
kubectl exec -it <pod-name> -n ortho32-verification -- \
  ls -lh /workspace/results/nightly-*
```

## Monitoring

### Job Status

```bash
# All jobs
kubectl get jobs -n ortho32-verification

# Job details
kubectl describe job ortho32-verification -n ortho32-verification

# Pod events
kubectl get events -n ortho32-verification --sort-by='.lastTimestamp'
```

### Resource Usage

```bash
# Resource quota status
kubectl describe resourcequota ortho32-quota -n ortho32-verification

# Pod resource consumption
kubectl top pods -n ortho32-verification
```

### Logs

```bash
# Stream all container logs
kubectl logs -f -n ortho32-verification <pod-name> --all-containers=true

# Specific container
kubectl logs -n ortho32-verification <pod-name> -c python-tests -f

# Previous run (if pod restarted)
kubectl logs -n ortho32-verification <pod-name> -c python-tests --previous
```

## Configuration

### Update Test Vectors

Edit `configmap.yaml` and reapply:

```bash
kubectl apply -f configmap.yaml

# Verify update
kubectl get configmap ortho32-test-vectors -n ortho32-verification -o yaml
```

### Change CronJob Schedule

Edit `cronjob.yaml` schedule field:

```yaml
schedule: "0 2 * * *"  # 2:00 AM daily
# schedule: "0 */6 * * *"  # Every 6 hours
# schedule: "0 0 * * 0"  # Weekly on Sunday midnight
```

Then reapply:

```bash
kubectl apply -f cronjob.yaml
```

### Adjust Resource Limits

Edit resource requests/limits in `verification-job.yaml` or `cronjob.yaml`:

```yaml
resources:
  requests:
    cpu: "16"      # Increase/decrease
    memory: "32Gi"
  limits:
    cpu: "32"
    memory: "64Gi"
```

## Troubleshooting

### Job Not Starting

```bash
# Check resource quota
kubectl describe resourcequota ortho32-quota -n ortho32-verification

# Check node affinity
kubectl get nodes -l workload-type=verification

# Check pending pods
kubectl get pods -n ortho32-verification -o wide
```

### Pod Failures

```bash
# Check pod events
kubectl describe pod <pod-name> -n ortho32-verification

# Check init container logs
kubectl logs <pod-name> -n ortho32-verification -c git-clone

# Check container status
kubectl get pod <pod-name> -n ortho32-verification -o jsonpath='{.status.containerStatuses[*].state}'
```

### PVC Not Binding

```bash
# Check PVC status
kubectl get pvc -n ortho32-verification

# Describe PVC for events
kubectl describe pvc ortho32-workspace -n ortho32-verification

# Check available storage classes
kubectl get storageclass
```

### CronJob Not Running

```bash
# Check CronJob suspend status
kubectl get cronjob ortho32-nightly-regression -n ortho32-verification

# Check recent job runs
kubectl get jobs -n ortho32-verification -l job-type=nightly-regression

# Manually trigger to test
kubectl create job --from=cronjob/ortho32-nightly-regression test-run -n ortho32-verification
```

## Cleanup

### Delete Single Job

```bash
kubectl delete job ortho32-verification -n ortho32-verification
```

### Delete CronJob

```bash
kubectl delete cronjob ortho32-nightly-regression -n ortho32-verification
```

### Delete Everything

```bash
# Delete all resources in namespace
kubectl delete namespace ortho32-verification

# This removes:
# - All Jobs and CronJobs
# - All Pods
# - PVCs (data will be deleted!)
# - ConfigMaps
# - RBAC resources
```

### Preserve Data

```bash
# Delete jobs but keep PVCs
kubectl delete job --all -n ortho32-verification
kubectl delete cronjob --all -n ortho32-verification

# PVCs remain for future use
kubectl get pvc -n ortho32-verification
```

## Integration with Docker

The Job manifests reference Docker images built from `../docker/`:

- `ortho32/python:latest` - Python test environment

Build and push before deploying:

```bash
cd ../docker
docker build -f Dockerfile.python -t ortho32/python:latest ..
docker push ortho32/python:latest
```

Or use Docker Compose to build:

```bash
cd ..
docker-compose build
```

## Security

- **ServiceAccount:** `ortho32-verifier` with minimal permissions
- **Role:** Limited to reading pods/logs/configmaps, creating jobs
- **No cluster-admin:** All permissions scoped to `ortho32-verification` namespace
- **Read-only ConfigMap:** Test vectors cannot be modified by pods
- **Network policies:** Add network policies if cluster requires isolation

## Node Affinity

Jobs require nodes labeled `workload-type=verification`:

```bash
# Label nodes
kubectl label nodes <node-name> workload-type=verification

# Verify labels
kubectl get nodes -l workload-type=verification --show-labels
```

If no nodes match, remove affinity from Job manifests or label existing nodes.

## Performance Tuning

### For Faster Runs

- Increase CPU/memory requests
- Use faster storage class (e.g., `fast-ssd` instead of `standard`)
- Reduce `--depth` in git clone (already set to 1)
- Cache Python packages in PVC

### For Cost Optimization

- Reduce CPU/memory limits
- Use spot/preemptible instances for nodes
- Increase TTL to clean up jobs faster
- Adjust CronJob schedule to off-peak hours

## Expected Results

**Successful Run:**
- All pytest tests pass (exit code 0)
- Edge cases: 3/3 passed
- Overall status: PASSED
- Entropy target: H=0.0 maintained

**Output Files:**
- `/workspace/results/pytest-results.xml` - JUnit format
- `/workspace/results/pytest-report.html` - Human-readable HTML
- `/workspace/results/pytest-output.log` - Full console output
- `/workspace/results/edge-case-results.json` - Edge case results
- `/workspace/results/verification-summary.json` - Aggregated summary

## Production Checklist

- [ ] Docker images built and pushed to registry
- [ ] Storage classes configured and available
- [ ] Nodes labeled with `workload-type=verification`
- [ ] Resource quotas appropriate for cluster capacity
- [ ] GitHub repository URL updated in Job manifests
- [ ] CronJob schedule matches desired regression frequency
- [ ] Monitoring/alerting configured for job failures
- [ ] Log aggregation configured for result analysis
- [ ] Backup strategy for PVC data

---

**ORTHO-32: Deterministic Matrix Accelerator**  
Entropy Target: H=0.0  
License: Apache-2.0  
Patent Notice: See ../PATENT_NOTICE.md
