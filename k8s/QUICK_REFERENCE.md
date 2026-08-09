# ORTHO-32 Kubernetes Quick Reference

## One-Liner Commands

### Deploy Everything
```bash
make deploy && make verify && make run
```

### Check Status
```bash
make status
```

### View Logs
```bash
make logs
```

### View Results
```bash
make results
```

### Clean Up
```bash
make clean-jobs
```

---

## Essential kubectl Commands

```bash
# Namespace
kubectl get namespace ortho32-verification

# Jobs
kubectl get jobs -n ortho32-verification
kubectl describe job ortho32-verification -n ortho32-verification

# Pods
kubectl get pods -n ortho32-verification
kubectl describe pod <pod-name> -n ortho32-verification

# Logs
kubectl logs <pod-name> -n ortho32-verification -c python-tests
kubectl logs <pod-name> -n ortho32-verification --all-containers=true

# Events
kubectl get events -n ortho32-verification --sort-by='.lastTimestamp'

# Resource Usage
kubectl top pods -n ortho32-verification
kubectl describe resourcequota ortho32-quota -n ortho32-verification

# Exec into Pod
kubectl exec -it <pod-name> -n ortho32-verification -- /bin/bash

# Copy Results
kubectl cp ortho32-verification/<pod-name>:/workspace/results ./local-results

# Delete
kubectl delete job ortho32-verification -n ortho32-verification
kubectl delete namespace ortho32-verification
```

---

## Makefile Commands

```bash
# Setup
make deploy          # Deploy all infrastructure
make verify          # Verify deployment

# Run
make run             # Run verification job
make run-nightly     # Deploy nightly CronJob
make trigger         # Manually trigger nightly

# Monitor
make status          # Show status
make logs            # Stream all logs
make logs-python     # Python tests only
make logs-edge       # Edge cases only
make logs-agg        # Aggregator only
make results         # View summary
make copy-results    # Copy to local

# Advanced
make describe-job    # Job details
make describe-pod    # Pod details
make exec            # Exec into pod
make quota           # Resource quota
make top             # Resource usage
make events          # Recent events

# Cleanup
make clean-jobs      # Delete jobs
make clean-all       # Delete namespace

# Info
make help            # Show all commands
make info            # Show config
```

---

## File Structure

```
k8s/
├── namespace.yaml          # Namespace + ResourceQuota
├── pvc.yaml                # PersistentVolumeClaims (50Gi + 20Gi)
├── configmap.yaml          # Test vectors and config
├── rbac.yaml               # ServiceAccount + Role + RoleBinding
├── verification-job.yaml   # Parameterized Job (3 containers)
├── cronjob.yaml            # Nightly regression (2 AM UTC)
├── Makefile                # Operations automation
├── README.md               # Full documentation
├── DEPLOYMENT_SUMMARY.md   # Deployment summary
├── QUICK_REFERENCE.md      # This file
└── validate-manifests.sh   # YAML validation script
```

---

## Resource Allocation

| Resource | Request | Limit |
|----------|---------|-------|
| CPU | 32 cores | 64 cores |
| Memory | 64Gi | 128Gi |
| Workspace PVC | 50Gi | - |
| Cache PVC | 20Gi | - |
| Job Timeout | 2 hours | - |
| TTL After Finish | 24 hours | - |

---

## Container Breakdown

| Container | CPU | Memory | Purpose |
|-----------|-----|--------|---------|
| git-clone (init) | 0.5 | 512Mi | Clone repo |
| python-tests | 8 | 16Gi | Run pytest |
| edge-case-tests | 4 | 8Gi | Validate edge cases |
| result-aggregator | 1 | 2Gi | Aggregate results |

---

## Expected Output Files

```
/workspace/results/
├── pytest-results.xml          # JUnit XML
├── pytest-report.html          # HTML report
├── pytest-output.log           # Console output
├── python-exit-code.txt        # Exit code
├── edge-case-results.json      # Edge case results
└── verification-summary.json   # Aggregated summary
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Job not starting | Check quota: `make quota` |
| Pod pending | Label node: `make label-node NODE=<name>` |
| PVC not binding | Check storage class: `kubectl get sc` |
| Container failing | Check logs: `make logs-python` |
| CronJob not running | Check schedule: `kubectl get cronjob -n ortho32-verification` |

---

## Common Workflows

### First Time Setup
```bash
./validate-manifests.sh
make deploy
make verify
kubectl label nodes <node-name> workload-type=verification
make run
make status
make logs
make results
```

### Daily Operations
```bash
make status          # Check jobs
make logs            # View logs
make results         # Get results
make copy-results    # Copy locally
```

### Debugging Failed Job
```bash
make status
make describe-job
make describe-pod
make logs-python
make logs-edge
make logs-agg
kubectl get events -n ortho32-verification
```

### Clean and Redeploy
```bash
make clean-jobs
make run
make status
```

---

## Environment Variables

Set in Job/CronJob manifests:

```yaml
env:
  - name: PYTHONUNBUFFERED
    value: "1"
  - name: ORTHO32_TEST_CONFIG
    value: "/config/test-config.yaml"
  - name: ORTHO32_ENTROPY_TARGET
    value: "0.0"
  - name: ORTHO32_REGRESSION_MODE
    value: "nightly"  # (CronJob only)
```

---

## Success Criteria

- [ ] All manifests validate: `./validate-manifests.sh`
- [ ] Infrastructure deploys: `make deploy`
- [ ] Status shows running: `make status`
- [ ] Logs stream cleanly: `make logs`
- [ ] Results show PASSED: `make results`
- [ ] Summary JSON exists: `/workspace/results/verification-summary.json`
- [ ] Overall status: `"overall_status": "PASSED"`
- [ ] Entropy target: `"entropy_target": "H=0.0 (deterministic)"`

---

**ORTHO-32: Deterministic Matrix Accelerator**  
Entropy Target: H=0.0  
Quick Reference v1.0
