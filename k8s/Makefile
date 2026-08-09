# ORTHO-32 Kubernetes Operations Makefile
# Deterministic Matrix Accelerator - H=0.0 entropy

.PHONY: help deploy verify run logs clean status

NAMESPACE := ortho32-verification
POD := $(shell kubectl get pods -n $(NAMESPACE) -l app=ortho32-verification -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)

help:
	@echo "ORTHO-32 Kubernetes Operations"
	@echo "==============================="
	@echo ""
	@echo "Setup:"
	@echo "  make deploy          Deploy all infrastructure (namespace, PVCs, RBAC, ConfigMap)"
	@echo "  make verify          Verify deployment status"
	@echo ""
	@echo "Run:"
	@echo "  make run             Run verification job"
	@echo "  make run-nightly     Deploy nightly CronJob"
	@echo "  make trigger         Manually trigger nightly job"
	@echo ""
	@echo "Monitor:"
	@echo "  make status          Show job and pod status"
	@echo "  make logs            Stream all container logs"
	@echo "  make logs-python     Stream python-tests logs"
	@echo "  make logs-edge       Stream edge-case-tests logs"
	@echo "  make logs-agg        Stream result-aggregator logs"
	@echo "  make results         Show verification summary"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean-jobs      Delete all jobs (keep infrastructure)"
	@echo "  make clean-all       Delete namespace (DESTROYS DATA)"
	@echo ""

# ============================================================================
# Setup
# ============================================================================

deploy:
	@echo "Deploying ORTHO-32 infrastructure..."
	kubectl apply -f namespace.yaml
	@sleep 2
	kubectl apply -f pvc.yaml
	kubectl apply -f configmap.yaml
	kubectl apply -f rbac.yaml
	@echo ""
	@echo "Infrastructure deployed. Run 'make verify' to check status."

verify:
	@echo "Verification Infrastructure Status"
	@echo "=================================="
	@echo ""
	@echo "Namespace:"
	@kubectl get namespace $(NAMESPACE)
	@echo ""
	@echo "Resource Quota:"
	@kubectl get resourcequota -n $(NAMESPACE)
	@echo ""
	@echo "PVCs:"
	@kubectl get pvc -n $(NAMESPACE)
	@echo ""
	@echo "ConfigMaps:"
	@kubectl get configmap -n $(NAMESPACE)
	@echo ""
	@echo "RBAC:"
	@kubectl get serviceaccount,role,rolebinding -n $(NAMESPACE)
	@echo ""

# ============================================================================
# Run
# ============================================================================

run:
	@echo "Starting ORTHO-32 verification job..."
	kubectl apply -f verification-job.yaml
	@sleep 2
	@echo ""
	@echo "Job started. Monitor with: make status"
	@echo "View logs with: make logs"

run-nightly:
	@echo "Deploying nightly regression CronJob..."
	kubectl apply -f cronjob.yaml
	@echo ""
	@echo "CronJob deployed. Schedule: 2:00 AM UTC daily"
	@kubectl get cronjob -n $(NAMESPACE)

trigger:
	@echo "Manually triggering nightly regression..."
	kubectl create job --from=cronjob/ortho32-nightly-regression \
		ortho32-manual-$(shell date +%Y%m%d-%H%M%S) -n $(NAMESPACE)
	@echo ""
	@echo "Manual run triggered. Monitor with: make status"

# ============================================================================
# Monitor
# ============================================================================

status:
	@echo "ORTHO-32 Status"
	@echo "==============="
	@echo ""
	@echo "Jobs:"
	@kubectl get jobs -n $(NAMESPACE)
	@echo ""
	@echo "CronJobs:"
	@kubectl get cronjobs -n $(NAMESPACE) 2>/dev/null || echo "No CronJobs deployed"
	@echo ""
	@echo "Pods:"
	@kubectl get pods -n $(NAMESPACE) -o wide
	@echo ""
	@echo "Recent Events:"
	@kubectl get events -n $(NAMESPACE) --sort-by='.lastTimestamp' | tail -10

logs:
	@if [ -z "$(POD)" ]; then \
		echo "No pod found. Check status with: make status"; \
		exit 1; \
	fi
	@echo "Streaming logs from $(POD)..."
	kubectl logs -f -n $(NAMESPACE) $(POD) --all-containers=true

logs-python:
	@if [ -z "$(POD)" ]; then \
		echo "No pod found. Check status with: make status"; \
		exit 1; \
	fi
	@echo "Streaming python-tests logs from $(POD)..."
	kubectl logs -f -n $(NAMESPACE) $(POD) -c python-tests

logs-edge:
	@if [ -z "$(POD)" ]; then \
		echo "No pod found. Check status with: make status"; \
		exit 1; \
	fi
	@echo "Streaming edge-case-tests logs from $(POD)..."
	kubectl logs -f -n $(NAMESPACE) $(POD) -c edge-case-tests

logs-agg:
	@if [ -z "$(POD)" ]; then \
		echo "No pod found. Check status with: make status"; \
		exit 1; \
	fi
	@echo "Streaming result-aggregator logs from $(POD)..."
	kubectl logs -f -n $(NAMESPACE) $(POD) -c result-aggregator

results:
	@if [ -z "$(POD)" ]; then \
		echo "No pod found. Check status with: make status"; \
		exit 1; \
	fi
	@echo "Verification Results"
	@echo "===================="
	@echo ""
	kubectl exec -n $(NAMESPACE) $(POD) -- cat /workspace/results/verification-summary.json 2>/dev/null || \
		echo "Results not yet available. Job may still be running."

copy-results:
	@if [ -z "$(POD)" ]; then \
		echo "No pod found. Check status with: make status"; \
		exit 1; \
	fi
	@mkdir -p ./local-results
	@echo "Copying results from $(POD) to ./local-results/..."
	kubectl cp $(NAMESPACE)/$(POD):/workspace/results ./local-results
	@echo "Results copied to ./local-results/"

# ============================================================================
# Cleanup
# ============================================================================

clean-jobs:
	@echo "Deleting all jobs..."
	kubectl delete jobs --all -n $(NAMESPACE)
	kubectl delete cronjobs --all -n $(NAMESPACE) 2>/dev/null || true
	@echo "Jobs deleted. Infrastructure (PVCs, ConfigMaps) preserved."

clean-all:
	@echo "WARNING: This will delete the entire namespace and ALL DATA."
	@echo "Press Ctrl+C to cancel, or Enter to continue..."
	@read confirm
	@echo "Deleting namespace $(NAMESPACE)..."
	kubectl delete namespace $(NAMESPACE)
	@echo "Namespace deleted. All resources destroyed."

# ============================================================================
# Advanced
# ============================================================================

describe-job:
	@JOB=$$(kubectl get jobs -n $(NAMESPACE) -o jsonpath='{.items[0].metadata.name}' 2>/dev/null); \
	if [ -z "$$JOB" ]; then \
		echo "No jobs found."; \
		exit 1; \
	fi; \
	kubectl describe job $$JOB -n $(NAMESPACE)

describe-pod:
	@if [ -z "$(POD)" ]; then \
		echo "No pod found."; \
		exit 1; \
	fi
	kubectl describe pod $(POD) -n $(NAMESPACE)

exec:
	@if [ -z "$(POD)" ]; then \
		echo "No pod found."; \
		exit 1; \
	fi
	@echo "Exec into $(POD)..."
	kubectl exec -it $(POD) -n $(NAMESPACE) -- /bin/bash

quota:
	@echo "Resource Quota Status"
	@echo "====================="
	kubectl describe resourcequota ortho32-quota -n $(NAMESPACE)

top:
	@echo "Pod Resource Usage"
	@echo "=================="
	kubectl top pods -n $(NAMESPACE)

events:
	@echo "Recent Events"
	@echo "============="
	kubectl get events -n $(NAMESPACE) --sort-by='.lastTimestamp'

label-node:
	@if [ -z "$(NODE)" ]; then \
		echo "Usage: make label-node NODE=<node-name>"; \
		exit 1; \
	fi
	@echo "Labeling node $(NODE) with workload-type=verification..."
	kubectl label nodes $(NODE) workload-type=verification
	@echo "Node labeled successfully."

# ============================================================================
# Info
# ============================================================================

info:
	@echo "ORTHO-32 Kubernetes Configuration"
	@echo "=================================="
	@echo "Namespace:          $(NAMESPACE)"
	@echo "Current Pod:        $(POD)"
	@echo "Workspace PVC:      50Gi"
	@echo "Cache PVC:          20Gi"
	@echo "CPU Requests:       32"
	@echo "Memory Requests:    64Gi"
	@echo "Job Timeout:        2 hours"
	@echo "TTL After Finish:   24 hours"
	@echo "Nightly Schedule:   2:00 AM UTC daily"
	@echo "Entropy Target:     H=0.0"
	@echo ""
