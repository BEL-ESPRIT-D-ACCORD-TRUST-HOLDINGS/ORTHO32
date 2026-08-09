# ORTHO-32 Docker Infrastructure

Complete Docker and Kubernetes setup for running ORTHO-32 verification pipeline.

## Quick Start

### Local Testing with Docker Compose

```bash
# Build images
docker-compose build

# Run Python tests
docker-compose up python

# Run LLM runtime tests
docker-compose up llm-runtime

# Run all tests
docker-compose up
```

## Docker Images

### Base Image (`docker/base.Dockerfile`)
- Ubuntu 22.04
- Common build tools
- Non-root `ortho` user

### Python Image (`docker/python.Dockerfile`)
- Python 3.11
- PyTorch + NumPy
- ORTHO-32 Python implementation
- Entry point: `ortho32_invariant.py`

## Directory Structure

```
ortho32-local/
├── docker/
│   ├── base.Dockerfile         # Common base
│   └── python.Dockerfile       # Python runtime
├── docker-compose.yml          # Local orchestration
├── tests/
│   └── test_edge_cases.py      # Edge case test suite
├── .github/
│   └── workflows/
│       └── test.yml            # GitHub Actions CI
└── Makefile                    # Build shortcuts
```

## Running Tests

### Local (No Docker)
```bash
# Core tests
python python/ortho32_invariant.py
python python/ortho32_llm_runtime.py

# Edge cases
pytest tests/test_edge_cases.py -v
```

### With Docker
```bash
make docker-test
```

### With Make
```bash
make test          # Run all tests
make test-edge     # Run edge cases only
make clean         # Clean build artifacts
```

## Test Categories

**Determinism Tests:**
- Single vector determinism
- Batch determinism
- 100-run zero variance
- Shape-agnostic determinism

**Entropy Tests:**
- H=0.0 verification
- Entropy reduction vs random

**Boundary Tests:**
- Zero vectors
- Single elements
- Large/small values
- Negative values

**Linearity Tests:**
- Scaling property: f(2x) = 2f(x)
- Addition property: f(x+y) = f(x)+f(y)

**GPU Tests:**
- CUDA execution
- CPU/GPU equivalence

**LLM Integration:**
- Attention layers
- Feed-forward networks
- Transformer blocks
- Complete GPT model
- Token generation

## GitHub Actions

Automatic testing on:
- Push to `main` or `develop`
- Pull requests to `main`

Tests run on:
- Python 3.10
- Python 3.11

## Makefile Targets

```bash
make help         # Show available targets
make test         # Run core tests
make test-edge    # Run edge case tests
make docker-build # Build Docker images
make docker-test  # Run tests in Docker
make clean        # Remove artifacts
```

## Results

All tests verify:
- ✅ H=0.0 entropy (deterministic)
- ✅ Perfect reproducibility (0 variance)
- ✅ Shape preservation
- ✅ Linearity maintained
- ✅ GPU acceleration supported

---

**Status:** Production-ready test infrastructure
**Last Updated:** 2026-08-09
