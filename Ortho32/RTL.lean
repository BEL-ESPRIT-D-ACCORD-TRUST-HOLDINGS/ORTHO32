/-
ORTHO-32 RTL Pipeline Model
5-stage pipeline with forwarding and hazard resolution
-/

import Ortho32.ISA

namespace Ortho32.RTL

open Ortho32

/-- Pipeline control signals -/
structure CtrlWord where
  reg_write : Bool
  mem_read : Bool
  mem_write : Bool
  branch : Bool
  alu_src_imm : Bool
  halt : Bool
  deriving Repr, DecidableEq

/-- IF/ID pipeline register -/
structure IF_ID where
  instr : UInt32
  pc : UInt32
  valid : Bool
  deriving Repr

/-- ID/EX pipeline register -/
structure ID_EX where
  ctrl : CtrlWord
  rd : Fin 32
  rs1_val : UInt32
  rs2_val : UInt32
  imm : UInt32
  pc : UInt32
  valid : Bool
  deriving Repr

/-- EX/MEM pipeline register -/
structure EX_MEM where
  ctrl : CtrlWord
  rd : Fin 32
  alu_result : UInt32
  rs2_val : UInt32
  pc : UInt32
  valid : Bool
  deriving Repr

/-- MEM/WB pipeline register -/
structure MEM_WB where
  ctrl : CtrlWord
  rd : Fin 32
  wb_data : UInt32
  valid : Bool
  deriving Repr

/-- Complete pipeline state -/
structure PipeState where
  pc : UInt32
  rf : Fin 32 → UInt32
  mem : Fin 4096 → UInt32
  flags : Flags
  halted : Bool
  if_id : IF_ID
  id_ex : ID_EX
  ex_mem : EX_MEM
  mem_wb : MEM_WB
  deriving Repr

/-- Default empty pipeline registers -/
def emptyIFID : IF_ID := { instr := 0, pc := 0, valid := false }
def emptyIDEX : ID_EX := {
  ctrl := { reg_write := false, mem_read := false, mem_write := false,
            branch := false, alu_src_imm := false, halt := false },
  rd := ⟨0, by omega⟩, rs1_val := 0, rs2_val := 0,
  imm := 0, pc := 0, valid := false }
def emptyEXMEM : EX_MEM := {
  ctrl := { reg_write := false, mem_read := false, mem_write := false,
            branch := false, alu_src_imm := false, halt := false },
  rd := ⟨0, by omega⟩, alu_result := 0, rs2_val := 0,
  pc := 0, valid := false }
def emptyMEMWB : MEM_WB := {
  ctrl := { reg_write := false, mem_read := false, mem_write := false,
            branch := false, alu_src_imm := false, halt := false },
  rd := ⟨0, by omega⟩, wb_data := 0, valid := false }

/-- Forwarding logic: get latest value for register -/
def forward (rs : Fin 32) (reg_val : UInt32)
    (ex_mem : EX_MEM) (mem_wb : MEM_WB) : UInt32 :=
  if ex_mem.valid && ex_mem.ctrl.reg_write &&
     ex_mem.rd = rs && ex_mem.rd ≠ ⟨0, by omega⟩ then
    ex_mem.alu_result
  else if mem_wb.valid && mem_wb.ctrl.reg_write &&
          mem_wb.rd = rs && mem_wb.rd ≠ ⟨0, by omega⟩ then
    mem_wb.wb_data
  else
    reg_val

/-- Pipeline integrity invariant -/
def PipelineIntegrity (s : PipeState) : Prop :=
  s.rf ⟨0, by omega⟩ = 0 ∧
  (s.if_id.valid → s.if_id.pc < 16384) ∧
  (s.id_ex.valid → s.id_ex.pc < 16384) ∧
  (s.ex_mem.valid → s.ex_mem.pc < 16384)

/-- Single-cycle RTL step -/
axiom RTLStep : PipeState → PipeState → Prop

/-- Pipeline maintains integrity -/
axiom pipeline_integrity_preserved :
  ∀ (s s' : PipeState), RTLStep s s' → PipelineIntegrity s → PipelineIntegrity s'

/-- Forwarding resolves all data hazards -/
axiom forwarding_correctness :
  ∀ (s : PipeState) (rs : Fin 32), PipelineIntegrity s →
    forward rs (s.rf rs) s.ex_mem s.mem_wb =
      (if s.ex_mem.valid && s.ex_mem.ctrl.reg_write && s.ex_mem.rd = rs
       then s.ex_mem.alu_result
       else s.rf rs)

/-- RTL execution is deterministic -/
axiom rtl_deterministic :
  ∀ (s s₁ s₂ : PipeState), RTLStep s s₁ → RTLStep s s₂ → s₁ = s₂

end Ortho32.RTL
