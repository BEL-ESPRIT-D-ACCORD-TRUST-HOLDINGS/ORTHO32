#!/bin/bash
# ORTHO-32 Kubernetes Manifest Validation
# Validates YAML syntax and Kubernetes API compatibility

set -e

echo "==================================="
echo "ORTHO-32 Manifest Validation"
echo "==================================="
echo ""

MANIFESTS=(
    "namespace.yaml"
    "pvc.yaml"
    "configmap.yaml"
    "rbac.yaml"
    "verification-job.yaml"
    "cronjob.yaml"
)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "ERROR: kubectl not found in PATH"
    echo "Install kubectl: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

echo "kubectl version: $(kubectl version --client --short 2>/dev/null || kubectl version --client)"
echo ""

# Validate each manifest
TOTAL=0
PASSED=0
FAILED=0

for manifest in "${MANIFESTS[@]}"; do
    TOTAL=$((TOTAL + 1))
    echo -n "Validating $manifest... "

    if [ ! -f "$manifest" ]; then
        echo "FAILED (file not found)"
        FAILED=$((FAILED + 1))
        continue
    fi

    # Dry-run validation
    if kubectl apply --dry-run=client -f "$manifest" &> /dev/null; then
        echo "PASSED"
        PASSED=$((PASSED + 1))
    else
        echo "FAILED"
        echo "  Error details:"
        kubectl apply --dry-run=client -f "$manifest" 2>&1 | sed 's/^/    /'
        echo ""
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "==================================="
echo "Validation Summary"
echo "==================================="
echo "Total:  $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "✓ All manifests valid!"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy infrastructure:  make deploy"
    echo "  2. Verify status:          make verify"
    echo "  3. Run verification job:   make run"
    echo "  4. Deploy nightly runs:    make run-nightly"
    exit 0
else
    echo "✗ Some manifests failed validation"
    echo "Review errors above and fix before deploying"
    exit 1
fi
