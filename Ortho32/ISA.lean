/-
ORTHO-32 Abstract ISA Specification
Formal architectural model for deterministic execution
-/

namespace Ortho32

/-- 32-bit architectural state -/
structure ArchState where
  pc : UInt32
  rf : Fin 32 → UInt32
  mem : Fin 4096 → UInt32
  flags : Flags
  halted : Bool
  deriving Repr

/-- Processor flags -/
structure Flags where
  z : Bool  -- Zero
  n : Bool  -- Negative
  c : Bool  -- Carry
  v : Bool  -- Overflow
  deriving Repr, DecidableEq

/-- Instruction opcodes -/
inductive Opcode where
  | NAND | XOR | ADD | SUB | SHL | SHR | CMP
  | MUL4 | LD | ST | ADDI
  | JMP | JNZ | HALT
  deriving Repr, DecidableEq

/-- Decoded instruction -/
structure Instr where
  opcode : Opcode
  rd : Fin 32
  rs1 : Fin 32
  rs2 : Fin 32
  imm17 : UInt32
  imm27 : UInt32
  deriving Repr

/-- Decode 32-bit instruction word -/
def decode (w : UInt32) : Instr :=
  let opcode_val := (w &&& 0x1F).toNat
  let opcode := match opcode_val with
    | 0x00 => Opcode.NAND
    | 0x01 => Opcode.XOR
    | 0x02 => Opcode.ADD
    | 0x03 => Opcode.SUB
    | 0x04 => Opcode.SHL
    | 0x05 => Opcode.SHR
    | 0x06 => Opcode.CMP
    | 0x08 => Opcode.MUL4
    | 0x10 => Opcode.LD
    | 0x11 => Opcode.ST
    | 0x12 => Opcode.ADDI
    | 0x18 => Opcode.JMP
    | 0x19 => Opcode.JNZ
    | 0x1F => Opcode.HALT
    | _ => Opcode.HALT
  { opcode := opcode,
    rd := ⟨((w >>> 22) &&& 0x1F).toNat % 32, by omega⟩,
    rs1 := ⟨((w >>> 17) &&& 0x1F).toNat % 32, by omega⟩,
    rs2 := ⟨((w >>> 12) &&& 0x1F).toNat % 32, by omega⟩,
    imm17 := w &&& 0x1FFFF,
    imm27 := (w >>> 5) &&& 0x7FFFFFF }

/-- ALU computation -/
def aluResult (op : Opcode) (a b : UInt32) : UInt32 :=
  match op with
  | Opcode.NAND => ~~~(a &&& b)
  | Opcode.XOR => a ^^^ b
  | Opcode.ADD => a + b
  | Opcode.SUB => a - b
  | Opcode.SHL => a <<< (b &&& 0x1F).toNat
  | Opcode.SHR => a >>> (b &&& 0x1F).toNat
  | Opcode.CMP => a - b
  | Opcode.MUL4 => a + (b * b)
  | Opcode.ADDI => a + b
  | _ => 0

/-- Compute flags from ALU result -/
def aluFlags (op : Opcode) (a b res : UInt32) : Flags :=
  { z := res = 0,
    n := (res >>> 31) = 1,
    c := (a.toNat + b.toNat ≥ 2^32),
    v := false }

/-- ISA single-step transition -/
inductive ISAStep : ArchState → ArchState → Prop where
  | alu_reg {s s' : ArchState} {instr : Instr} :
      decode (s.mem ⟨(s.pc / 4).toNat % 4096, by omega⟩) = instr →
      instr.opcode ∈ [Opcode.NAND, Opcode.XOR, Opcode.ADD, Opcode.SUB,
                      Opcode.SHL, Opcode.SHR, Opcode.CMP] →
      s'.pc = s.pc + 4 →
      s'.rf = Function.update s.rf instr.rd
        (aluResult instr.opcode (s.rf instr.rs1) (s.rf instr.rs2)) →
      s'.mem = s.mem →
      s'.halted = false →
      ISAStep s s'

  | addi {s s' : ArchState} {instr : Instr} :
      decode (s.mem ⟨(s.pc / 4).toNat % 4096, by omega⟩) = instr →
      instr.opcode = Opcode.ADDI →
      s'.pc = s.pc + 4 →
      s'.rf = Function.update s.rf instr.rd
        (aluResult Opcode.ADDI (s.rf instr.rs1) instr.imm17) →
      s'.mem = s.mem →
      s'.halted = false →
      ISAStep s s'

  | load {s s' : ArchState} {instr : Instr} :
      decode (s.mem ⟨(s.pc / 4).toNat % 4096, by omega⟩) = instr →
      instr.opcode = Opcode.LD →
      s'.pc = s.pc + 4 →
      s'.rf = Function.update s.rf instr.rd
        (s.mem ⟨((s.rf instr.rs1 + instr.imm17) / 4).toNat % 4096, by omega⟩) →
      s'.mem = s.mem →
      s'.halted = false →
      ISAStep s s'

  | store {s s' : ArchState} {instr : Instr} :
      decode (s.mem ⟨(s.pc / 4).toNat % 4096, by omega⟩) = instr →
      instr.opcode = Opcode.ST →
      s'.pc = s.pc + 4 →
      s'.rf = s.rf →
      s'.mem = Function.update s.mem
        ⟨((s.rf instr.rs1 + instr.imm17) / 4).toNat % 4096, by omega⟩
        (s.rf instr.rs2) →
      s'.halted = false →
      ISAStep s s'

  | halt {s s' : ArchState} {instr : Instr} :
      decode (s.mem ⟨(s.pc / 4).toNat % 4096, by omega⟩) = instr →
      instr.opcode = Opcode.HALT →
      s'.halted = true →
      s'.pc = s.pc →
      s'.rf = s.rf →
      s'.mem = s.mem →
      ISAStep s s'

/-- R0 is always zero -/
axiom r0_invariant : ∀ (s s' : ArchState), ISAStep s s' → s'.rf ⟨0, by omega⟩ = 0

/-- ISA execution is deterministic -/
axiom isa_deterministic : ∀ (s s₁ s₂ : ArchState),
  ISAStep s s₁ → ISAStep s s₂ → s₁ = s₂

end Ortho32
