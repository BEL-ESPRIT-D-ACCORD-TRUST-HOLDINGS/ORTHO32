/-- BitVec32, Fin32, Word17, Word27 from first principles -/
namespace Ortho32

/-- 32-bit word as Nat -/
@[inline] def UInt32 := Nat
@[inline] def UInt5 := Nat
@[inline] def UInt17 := Nat
@[inline] def UInt27 := Nat

@[inline] def mask32 (x : UInt32) : UInt32 := x % (2 ^ 32)
@[inline] def mask5 (x : UInt5) : UInt5 := x % (2 ^ 5)
@[inline] def mask17 (x : UInt17) : UInt17 := x % (2 ^ 17)
@[inline] def mask27 (x : UInt27) : UInt27 := x % (2 ^ 27)

/-- Bit operations -/
@[inline] def bitAnd (a b : UInt32) : UInt32 := mask32 (a &&& b)
@[inline] def bitOr (a b : UInt32) : UInt32 := mask32 (a ||| b)
@[inline] def bitXor (a b : UInt32) : UInt32 := mask32 (a ^^^ b)
@[inline] def bitNot (a : UInt32) : UInt32 := mask32 (~~~a)
@[inline] def bitShl (a : UInt32) (n : UInt32) : UInt32 := mask32 (a <<< (n % 32).toNat)
@[inline] def bitShr (a : UInt32) (n : UInt32) : UInt32 := a >>> (n % 32).toNat

@[inline] def add32 (a b : UInt32) : UInt32 := mask32 (a + b)
@[inline] def sub32 (a b : UInt32) : UInt32 := mask32 (a + (2 ^ 32) - b)

/-- Sign extension -/
@[inline] def signExt17 (x : UInt17) : UInt32 :=
  if x < 2 ^ 16 then x else x + (2 ^ 32 - 2 ^ 17)

@[inline] def signExt27 (x : UInt27) : UInt32 :=
  if x < 2 ^ 26 then x else x + (2 ^ 32 - 2 ^ 27)

/-- Finite types as subtypes -/
def Fin32 := { n : Nat // n < 32 }

@[inline] def Fin32.val (x : Fin32) : Nat := x.val

/-- Flags record -/
structure Flags where
  z : Bool
  n : Bool
  c : Bool
  v : Bool
  deriving DecidableEq

/-- Register file -/
def RegFile := Fin32 → UInt32

@[inline] def RegFile.zero : RegFile := fun _ => 0
@[inline] def RegFile.update (rf : RegFile) (rd : Fin32) (val : UInt32) : RegFile :=
  fun r => if r = rd then val else rf r

/-- Memory -/
def Memory := UInt32 → UInt32

@[inline] def Memory.zero : Memory := fun _ => 0
@[inline] def Memory.update (mem : Memory) (addr : UInt32) (val : UInt32) : Memory :=
  fun a => if a = addr then val else mem a

/-- Architectural state -/
structure ArchState where
  pc : UInt32
  rf : RegFile
  mem : Memory
  flags : Flags
  halted : Bool
  deriving DecidableEq

end Ortho32
