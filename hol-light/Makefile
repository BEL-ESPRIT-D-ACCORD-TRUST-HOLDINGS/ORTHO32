# HOL Light Build for ORTHO-32
# Minimal trusted kernel verification

HOL_DIR = $(HOME)/hol-light
HOL = $(HOL_DIR)/hol

# Core library
ORTHO32_LIB = ortho32_lib.ml

# Theory files (dependency order)
THEORIES = \
	isa/isa_types.ml \
	isa/isa_semantics.ml \
	isa/isa_theorems.ml \
	rtl/rtl_types.ml \
	rtl/rtl_step.ml \
	rtl/forwarding.ml \
	rtl/rtl_theorems.ml \
	refinement/abstraction.ml \
	refinement/refinement_proof.ml \
	refinement/simulation.ml \
	tensor/tensor_types.ml \
	tensor/tensor_semantics.ml \
	tensor/tensor_theorems.ml \
	timing/timing_contracts.ml \
	extraction/ocaml_extract.ml

.PHONY: all build check_axioms test extract clean

all: ortho32_verified.ml

build:
	@echo "Building HOL Light ORTHO-32 theories..."
	$(HOL) < build.sml

ortho32_verified.ml: $(ORTHO32_LIB) $(THEORIES)
	@echo "Extracting verified OCaml code..."
	$(HOL) -eval 'loadt "$(ORTHO32_LIB)";; \
	              loadt "extraction/ocaml_extract.ml";; \
	              write_verified_simulator ();;'

check_axioms:
	@echo "Checking axioms (should only be standard)..."
	$(HOL) -eval 'loadt "$(ORTHO32_LIB)";; print_axioms ();;'
	@echo ""
	@echo "Expected: propext, Classical.choice, Quot.sound, Num, Real"
	@echo "If you see others, STOP and investigate!"

test:
	@echo "Running regression tests..."
	$(HOL) -eval 'loadt "$(ORTHO32_LIB)";; run_tests ();;'

extract: ortho32_verified.ml
	@echo "Compiling extracted OCaml..."
	ocamlfind ocamlopt -o ortho32_verified \
		-package num,zarith \
		ortho32_verified.ml

cakeml: ortho32_verified.ml
	@echo "Compiling with verified CakeML compiler..."
	cakeml ortho32_verified.ml -o ortho32_cakeml
	@echo "Result: ortho32_cakeml (end-to-end verified binary)"

clean:
	rm -f ortho32_verified.ml ortho32_verified ortho32_cakeml
	rm -f *.cmi *.cmx *.o
	find . -name "*.vo" -delete
	find . -name "*.glob" -delete

help:
	@echo "HOL Light ORTHO-32 Build System"
	@echo ""
	@echo "Targets:"
	@echo "  make build         - Build all HOL Light theories"
	@echo "  make check_axioms  - Verify only standard axioms used"
	@echo "  make test          - Run regression tests"
	@echo "  make extract       - Extract verified OCaml simulator"
	@echo "  make cakeml        - Compile with verified CakeML compiler"
	@echo "  make clean         - Remove build artifacts"
