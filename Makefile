.PHONY: help test test-edge docker-build docker-test clean

help:
	@echo "ORTHO-32 Build System"
	@echo ""
	@echo "Available targets:"
	@echo "  test          - Run Python test suite"
	@echo "  test-edge     - Run edge case tests"
	@echo "  docker-build  - Build Docker images"
	@echo "  docker-test   - Run tests in Docker"
	@echo "  clean         - Remove build artifacts"

test:
	python python/ortho32_invariant.py
	python python/ortho32_llm_runtime.py

test-edge:
	pytest tests/test_edge_cases.py -v --tb=short -x

docker-build:
	docker-compose build

docker-test:
	docker-compose up python llm-runtime

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	rm -rf .pytest_cache/
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info/
