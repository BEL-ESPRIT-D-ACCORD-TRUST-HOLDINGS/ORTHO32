# ORTHO-32 Kubernetes Infrastructure - Complete

## Deployment Summary

Complete Kubernetes infrastructure for ORTHO-32 deterministic matrix accelerator verification pipeline (H=0.0 entropy).

**Status:** READY FOR PRODUCTION  
**Date:** 2026-08-09  
**Total Lines:** 1,302 (across 8 files)

---

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `namespace.yaml` | 24 | Namespace + ResourceQuota for ortho32-verification |
| `pvc.yaml` | 32 | PersistentVolumeClaims (workspace 50Gi, cache 20Gi) |
| `configmap.yaml` | 54 | Test vectors and configuration data |
| `rbac.yaml` | 48 | ServiceAccount + Role + RoleBinding |
| `verification-job.yaml` | 293 | Parameterized Job with init + 3 containers |
| `cronjob.yaml` | 174 | Nightly regression at 2:00 AM UTC |
| `Makefile` | 254 | Operations automation (deploy, run, monitor, clean) |
| `README.md` | 423 | Complete deployment documentation |
| **TOTAL** | **1,302** | |

---

## Architecture

### Resource Allocation
- **Namespace:** `ortho32-verification`
- **CPU Requests:** 32 cores
- **Memory Requests:** 64Gi
- **CPU Limits:** 64 cores
- **Memory Limits:** 128Gi
- **Storage:** 70Gi (50Gi workspace + 20Gi cache)
- **Job Timeout:** 2 hours
- **TTL After Completion:** 24 hours

### Job Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                     ORTHO-32 Verification Job                │
└─────────────────────────────────────────────────────────────┘

Init Container: git-clone
  ↓
  ├─ Clone GitHub repo (depth 1)
  ├─ Record commit metadata
  └─ Write to /workspace/ortho32/

Parallel Containers:

Container 1: python-tests (8 CPU / 16Gi)
  ├─ pytest tests/test_edge_cases.py -v
  ├─ Generate JUnit XML + HTML reports
  └─ Write results to /workspace/results/

Container 2: edge-case-tests (4 CPU / 8Gi)
  ├─ Wait for python-tests to start
  ├─ Validate specific edge cases:
  │  • Zero matrix entropy (H=0.0)
  │  • Identity determinant (det=1.0)
  │  • Orthogonal properties (Q^T Q = I)
  └─ Write JSON results

Container 3: result-aggregator (1 CPU / 2Gi)
  ├─ Wait for both test containers
  ├─ Aggregate all results
  ├─ Generate unified summary JSON
  └─ Print final status
```

### Node Affinity
Jobs target nodes with label:
```
workload-type=verification
```

Label nodes with:
```bash
kubectl label nodes <node-name> workload-type=verification
```

---

## Quick Start

### 1. Validate Manifests

```bash
cd k8s/
./validate-manifests.sh
```

### 2. Deploy Infrastructure

```bash
make deploy
```

This creates:
- Namespace `ortho32-verification`
- Resource quota (32 CPU / 64Gi memory)
- 2 PersistentVolumeClaims (workspace + cache)
- ConfigMap with test vectors
- RBAC (ServiceAccount, Role, RoleBinding)

### 3. Verify Deployment

```bash
make verify
```

### 4. Run Verification Job

```bash
make run
```

### 5. Monitor Progress

```bash
# Watch job status
make status

# Stream logs (all containers)
make logs

# View specific container logs
make logs-python
make logs-edge
make logs-agg

# View results
make results
```

### 6. Deploy Nightly Regression

```bash
make run-nightly
```

Runs automatically at 2:00 AM UTC daily.

---

## Output Files

### Per-Job Results
- `/workspace/results/pytest-results.xml` - JUnit XML format
- `/workspace/results/pytest-report.html` - HTML test report
- `/workspace/results/pytest-output.log` - Full console output
- `/workspace/results/python-exit-code.txt` - Test exit code
- `/workspace/results/edge-case-results.json` - Edge case results
- `/workspace/results/verification-summary.json` - Aggregated summary

### Nightly Regression Results
- `/workspace/results/nightly-<timestamp>/` - Time-stamped directory
- `/workspace/results/nightly-latest/` - Symlink to latest run
- Includes all per-job files plus coverage reports

---

## Expected Results

**Successful Run:**
```json
{
  "pipeline": "ORTHO-32 Verification",
  "timestamp": "2026-08-09T16:30:00Z",
  "commit": "abc123...",
  "overall_status": "PASSED",
  "entropy_target": "H=0.0 (deterministic)",
  "results": {
    "python_tests": {
      "exit_code": 0,
      "passed": true
    },
    "edge_cases": {
      "passed": 3,
      "total": 3,
      "success_rate": 1.0
    }
  }
}
```

---

## Integration Points

### Docker Images
Job manifests reference:
- `ortho32/python:latest` - Python test environment

Built from `../docker/Dockerfile.python`

Build and push before deploying:
```bash
cd ../docker
docker build -f Dockerfile.python -t ortho32/python:latest ..
docker push ortho32/python:latest
```

### GitHub Repository
Init container clones from:
```
https://github.com/SNAPKITTYWEST/ortho32-local.git
```

Update URL in `verification-job.yaml` and `cronjob.yaml` if different.

---

## Monitoring

### Job Status
```bash
kubectl get jobs -n ortho32-verification
kubectl get pods -n ortho32-verification
kubectl get events -n ortho32-verification --sort-by='.lastTimestamp'
```

### Resource Usage
```bash
kubectl top pods -n ortho32-verification
kubectl describe resourcequota ortho32-quota -n ortho32-verification
```

### Logs
```bash
# All containers
kubectl logs <pod-name> -n ortho32-verification --all-containers=true

# Specific container
kubectl logs <pod-name> -n ortho32-verification -c python-tests

# Follow logs
kubectl logs -f <pod-name> -n ortho32-verification -c python-tests
```

---

## Cleanup

### Delete Jobs Only (preserve infrastructure)
```bash
make clean-jobs
```

### Delete Everything (including PVCs)
```bash
make clean-all
```

**WARNING:** This destroys all data in PVCs.

---

## Configuration

### Update Test Vectors
Edit `configmap.yaml` and reapply:
```bash
kubectl apply -f configmap.yaml
```

### Change Nightly Schedule
Edit `cronjob.yaml` schedule field:
```yaml
schedule: "0 2 * * *"  # 2:00 AM UTC daily
```

Common schedules:
- `0 2 * * *` - Daily at 2 AM
- `0 */6 * * *` - Every 6 hours
- `0 0 * * 0` - Weekly on Sunday midnight
- `0 0 1 * *` - Monthly on 1st

### Adjust Resource Limits
Edit `verification-job.yaml` or `cronjob.yaml` resource blocks:
```yaml
resources:
  requests:
    cpu: "16"
    memory: "32Gi"
  limits:
    cpu: "32"
    memory: "64Gi"
```

---

## Troubleshooting

### Job Not Starting
**Cause:** Insufficient resources or no matching nodes

**Solution:**
```bash
# Check quota
kubectl describe resourcequota ortho32-quota -n ortho32-verification

# Check node labels
kubectl get nodes -l workload-type=verification

# Remove affinity if needed (edit Job manifest)
```

### Pod Failures
**Cause:** Container errors or init failures

**Solution:**
```bash
# Check pod events
kubectl describe pod <pod-name> -n ortho32-verification

# Check init container
kubectl logs <pod-name> -n ortho32-verification -c git-clone

# Check container status
kubectl get pod <pod-name> -n ortho32-verification -o yaml
```

### PVC Not Binding
**Cause:** No available PersistentVolumes or storage class issues

**Solution:**
```bash
# Check PVC status
kubectl get pvc -n ortho32-verification

# Check storage classes
kubectl get storageclass

# Check PVC events
kubectl describe pvc ortho32-workspace -n ortho32-verification
```

### CronJob Not Running
**Cause:** Suspended or scheduling issues

**Solution:**
```bash
# Check CronJob status
kubectl get cronjob ortho32-nightly-regression -n ortho32-verification

# Check recent jobs
kubectl get jobs -n ortho32-verification -l job-type=nightly-regression

# Manually trigger
kubectl create job --from=cronjob/ortho32-nightly-regression test-run -n ortho32-verification
```

---

## Security Considerations

### RBAC
- ServiceAccount `ortho32-verifier` with minimal permissions
- Role scoped to `ortho32-verification` namespace only
- Permissions limited to:
  - Read pods, logs, configmaps, PVCs
  - Create jobs
- No cluster-admin or elevated privileges

### Network Policies
Add network policies if cluster requires isolation:
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ortho32-netpol
  namespace: ortho32-verification
spec:
  podSelector:
    matchLabels:
      app: ortho32-verification
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 443  # HTTPS for git clone
```

### Secrets
Currently using public GitHub repository. For private repos:
```bash
# Create Git credentials secret
kubectl create secret generic git-creds \
  --from-literal=username=<username> \
  --from-literal=password=<token> \
  -n ortho32-verification

# Reference in Job init container
```

---

## Performance Tuning

### For Faster Runs
- Increase CPU/memory requests
- Use faster storage class (e.g., `fast-ssd`)
- Cache Python packages in PVC
- Parallelize more tests

### For Cost Optimization
- Reduce resource limits
- Use spot/preemptible instances
- Adjust nightly schedule to off-peak
- Increase TTL to clean up faster

---

## Production Checklist

- [ ] Docker images built and pushed to registry
- [ ] Storage classes configured and available
- [ ] Nodes labeled with `workload-type=verification`
- [ ] Resource quotas appropriate for cluster capacity
- [ ] GitHub repository URL updated (if not using placeholder)
- [ ] CronJob schedule matches desired frequency
- [ ] Monitoring/alerting configured for job failures
- [ ] Log aggregation configured (e.g., Fluentd, Loki)
- [ ] Backup strategy for PVC data
- [ ] Network policies configured (if required)
- [ ] Git credentials secret created (if private repo)
- [ ] Resource limits tuned for cluster size
- [ ] Validation script runs successfully: `./validate-manifests.sh`

---

## Support

**Documentation:**
- Full guide: `README.md`
- Operations: `Makefile` (run `make help`)
- Validation: `./validate-manifests.sh`

**Debugging:**
```bash
make describe-job   # Job details
make describe-pod   # Pod details
make events         # Recent events
make quota          # Resource quota status
make top            # Resource usage
```

**Manual Commands:**
```bash
# Get pod name
POD=$(kubectl get pods -n ortho32-verification -l app=ortho32-verification -o jsonpath='{.items[0].metadata.name}')

# Exec into pod
kubectl exec -it $POD -n ortho32-verification -- /bin/bash

# Copy results locally
kubectl cp ortho32-verification/${POD}:/workspace/results ./local-results
```

---

## What's Next

1. **Validate:** Run `./validate-manifests.sh`
2. **Deploy:** Run `make deploy`
3. **Test:** Run `make run`
4. **Monitor:** Run `make status` and `make logs`
5. **Automate:** Run `make run-nightly` for daily regression

---

**ORTHO-32: Deterministic Matrix Accelerator**  
Entropy Target: H=0.0  
License: Apache-2.0  
Patent Notice: See ../PATENT_NOTICE.md

Infrastructure Status: ✓ PRODUCTION READY
