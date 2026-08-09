import Lake
open Lake DSL

package ortho32 where
  version := v!"1.0.0"
  keywords := #["verification", "hardware", "formal-methods", "zero-sorry"]
  leanOptions := #[
    ⟨`pp.unicode.fun, true⟩,
    ⟨`pp.proofs.withType, false⟩
  ]

-- NO MATHLIB - Zero dependencies, kernel only

@[default_target]
lean_lib Ortho32 where
  srcDir := "Ortho32"
  globs := #[.andSubmodules `Ortho32]

lean_exe ortho32_check where
  root := `Ortho32.Main
  srcDir := "Ortho32"
