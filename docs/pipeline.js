(() => {
  'use strict';

  const INSTRUCTIONS = [
    { asm: 'ADD r1, r2, r3', op: 'ADD', rd: 1, rs1: 2, rs2: 3 },
    { asm: 'SUB r4, r5, r6', op: 'SUB', rd: 4, rs1: 5, rs2: 6 },
    { asm: 'NAND r7, r1, r8', op: 'NAND', rd: 7, rs1: 1, rs2: 8 },
    { asm: 'XOR r9, r3, r4', op: 'XOR', rd: 9, rs1: 3, rs2: 4 },
    { asm: 'LOAD r10, [r1+0]', op: 'LOAD', rd: 10, rs1: 1, rs2: 0 },
    { asm: 'STORE [r2+0], r5', op: 'STORE', rd: 0, rs1: 2, rs2: 5 },
    { asm: 'BEQ r1, r0, +4', op: 'BEQ', rd: 0, rs1: 1, rs2: 0 },
    { asm: 'ADD r11, r7, r9', op: 'ADD', rd: 11, rs1: 7, rs2: 9 },
    { asm: 'SHL r12, r1, 2', op: 'SHL', rd: 12, rs1: 1, rs2: 0 },
    { asm: 'SHR r13, r4, 1', op: 'SHR', rd: 13, rs1: 4, rs2: 0 },
    { asm: 'TMUL t0, t1, t2', op: 'TMUL', rd: 0, rs1: 1, rs2: 2 },
    { asm: 'ADD r14, r10, r11', op: 'ADD', rd: 14, rs1: 10, rs2: 11 },
    { asm: 'XOR r15, r12, r13', op: 'XOR', rd: 15, rs1: 12, rs2: 13 },
    { asm: 'SUB r1, r14, r15', op: 'SUB', rd: 1, rs1: 14, rs2: 15 },
    { asm: 'NAND r2, r1, r9', op: 'NAND', rd: 2, rs1: 1, rs2: 9 },
    { asm: 'ADD r3, r2, r4', op: 'ADD', rd: 3, rs1: 2, rs2: 4 },
  ];

  const STAGES = ['if', 'id', 'ex', 'mem', 'wb'];
  const REG_COUNT = 16;

  let cycle = 0;
  let committed = 0;
  let instrPtr = 0;
  let running = false;
  let runInterval = null;
  let pipeline = [null, null, null, null, null];
  let hazardActive = false;
  let flushPending = false;
  let forwardingEnabled = true;
  let registers = new Array(REG_COUNT).fill(0);
  let waveformData = [];
  const MAX_WAVEFORM = 60;

  const $ = id => document.getElementById(id);
  const slot = stage => document.querySelector(`[data-stage="${stage}"]`);

  function nextInstruction() {
    const instr = INSTRUCTIONS[instrPtr % INSTRUCTIONS.length];
    instrPtr++;
    return instr;
  }

  function computeResult(instr) {
    if (!instr) return 0;
    const a = registers[instr.rs1] || 0;
    const b = registers[instr.rs2] || 0;
    switch (instr.op) {
      case 'ADD': return (a + b) & 0xFFFFFFFF;
      case 'SUB': return (a - b) & 0xFFFFFFFF;
      case 'NAND': return (~(a & b)) & 0xFFFFFFFF;
      case 'XOR': return (a ^ b) & 0xFFFFFFFF;
      case 'SHL': return (a << (instr.rs2 || b)) & 0xFFFFFFFF;
      case 'SHR': return (a >>> (instr.rs2 || b)) & 0xFFFFFFFF;
      case 'LOAD': return (a + b) & 0xFFFF;
      default: return 0;
    }
  }

  function advancePipeline() {
    cycle++;

    if (flushPending) {
      pipeline[0] = null;
      pipeline[1] = null;
      flushPending = false;
      recordWaveform('flush');
      updateDisplay();
      if ($('hazard-status')) $('hazard-status').textContent = 'Branch Flush';
      STAGES.forEach((s, i) => {
        const el = $(`stage-${s}`);
        if (el && i < 2) {
          el.classList.add('flushed');
          el.classList.remove('active', 'hazard');
        }
      });
      setTimeout(() => {
        STAGES.forEach(s => {
          const el = $(`stage-${s}`);
          if (el) el.classList.remove('flushed');
        });
        if ($('hazard-status')) $('hazard-status').textContent = 'None';
      }, 600);
      return;
    }

    if (pipeline[4]) {
      committed++;
      const wb = pipeline[4];
      if (wb.rd > 0 && wb.op !== 'STORE' && wb.op !== 'BEQ' && wb.op !== 'BNE') {
        registers[wb.rd] = computeResult(wb);
        highlightRegister(wb.rd);
      }
    }

    for (let i = 4; i > 0; i--) {
      pipeline[i] = pipeline[i - 1];
    }
    pipeline[0] = nextInstruction();

    let fwdEvent = 'none';
    if (hazardActive && forwardingEnabled) {
      hazardActive = false;
      fwdEvent = 'ex-mem';
      if ($('fwd-status')) $('fwd-status').textContent = 'Enabled (active)';
      showForwardingPath('ex-mem');
      setTimeout(() => {
        hideForwardingPath('ex-mem');
        if ($('fwd-status')) $('fwd-status').textContent = 'Enabled';
      }, 500);
    } else if (hazardActive && !forwardingEnabled) {
      if ($('hazard-status')) $('hazard-status').textContent = 'STALL (no forwarding)';
    }

    recordWaveform(fwdEvent);
    updateDisplay();
  }

  function recordWaveform(event) {
    waveformData.push({
      cycle: cycle,
      stages: pipeline.map(p => p ? p.op : null),
      event: event
    });
    if (waveformData.length > MAX_WAVEFORM) waveformData.shift();
    drawWaveform();
  }

  function drawWaveform() {
    const canvas = $('waveform-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const rowH = h / 7;
    const labels = ['CLK', 'IF', 'ID', 'EX', 'MEM', 'WB', 'FWD'];
    const colors = ['#4DC9F6', '#4DC9F6', '#4DC9F6', '#4DC9F6', '#4DC9F6', '#4DC9F6', '#FB3640'];

    ctx.font = '10px monospace';
    ctx.fillStyle = '#627D98';
    labels.forEach((l, i) => {
      ctx.fillText(l, 2, i * rowH + rowH * 0.65);
    });

    const startX = 40;
    const drawW = w - startX;
    const segW = drawW / MAX_WAVEFORM;

    waveformData.forEach((d, idx) => {
      const x = startX + idx * segW;

      ctx.strokeStyle = colors[0];
      ctx.lineWidth = 1;
      ctx.beginPath();
      const clkHigh = (d.cycle % 2 === 0);
      ctx.moveTo(x, 0 * rowH + (clkHigh ? rowH * 0.2 : rowH * 0.8));
      ctx.lineTo(x + segW * 0.5, 0 * rowH + (clkHigh ? rowH * 0.2 : rowH * 0.8));
      ctx.lineTo(x + segW * 0.5, 0 * rowH + (clkHigh ? rowH * 0.8 : rowH * 0.2));
      ctx.lineTo(x + segW, 0 * rowH + (clkHigh ? rowH * 0.8 : rowH * 0.2));
      ctx.stroke();

      for (let s = 0; s < 5; s++) {
        const row = s + 1;
        const y = row * rowH;
        if (d.stages[s]) {
          ctx.fillStyle = d.event === 'flush' && s < 2 ? 'rgba(251, 54, 64, 0.3)' : 'rgba(77, 201, 246, 0.15)';
          ctx.fillRect(x, y + 2, segW - 1, rowH - 4);
          ctx.fillStyle = d.event === 'flush' && s < 2 ? '#FB3640' : '#4DC9F6';
          if (segW > 20) {
            ctx.font = '8px monospace';
            ctx.fillText(d.stages[s], x + 2, y + rowH * 0.6);
          }
        }
      }

      if (d.event === 'ex-mem' || d.event === 'mem-wb') {
        const row = 6;
        const y = row * rowH;
        ctx.fillStyle = 'rgba(251, 54, 64, 0.3)';
        ctx.fillRect(x, y + 2, segW - 1, rowH - 4);
      }
    });
  }

  function highlightRegister(idx) {
    const el = document.querySelector(`[data-reg="${idx}"]`);
    if (el) {
      el.classList.add('reg-updated');
      setTimeout(() => el.classList.remove('reg-updated'), 400);
    }
  }

  function showForwardingPath(path) {
    const line = $(`fwd-line-${path}`);
    if (line) line.classList.add('active');
  }

  function hideForwardingPath(path) {
    const line = $(`fwd-line-${path}`);
    if (line) line.classList.remove('active');
  }

  function updateDisplay() {
    if ($('cycle-count')) $('cycle-count').textContent = cycle;
    if ($('commit-count')) $('commit-count').textContent = committed;
    if ($('cpi-display')) $('cpi-display').textContent = committed > 0 ? (cycle / committed).toFixed(2) : '—';

    STAGES.forEach((s, i) => {
      const el = $(`stage-${s}`);
      const sl = slot(s);
      if (!el || !sl) return;
      if (pipeline[i]) {
        sl.textContent = pipeline[i].asm;
        el.classList.add('active');
        el.classList.remove('hazard', 'flushed');
      } else {
        sl.textContent = '—';
        el.classList.remove('active', 'hazard', 'flushed');
      }
    });

    updateRegistersDisplay();
    updateQueueDisplay();
  }

  function updateRegistersDisplay() {
    const container = $('registers-display');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < REG_COUNT; i++) {
      const div = document.createElement('div');
      div.className = 'reg-cell';
      div.dataset.reg = i;
      div.innerHTML = `<span class="reg-name">r${i}</span><span class="reg-val">0x${(registers[i] >>> 0).toString(16).padStart(8, '0').toUpperCase()}</span>`;
      container.appendChild(div);
    }
  }

  function updateQueueDisplay() {
    const container = $('queue-display');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const idx = (instrPtr + i) % INSTRUCTIONS.length;
      const div = document.createElement('div');
      div.className = 'queue-item';
      div.textContent = INSTRUCTIONS[idx].asm;
      if (i === 0) div.classList.add('queue-next');
      container.appendChild(div);
    }
  }

  function reset() {
    cycle = 0;
    committed = 0;
    instrPtr = 0;
    pipeline = [null, null, null, null, null];
    hazardActive = false;
    flushPending = false;
    registers = new Array(REG_COUNT).fill(0);
    waveformData = [];
    if (runInterval) { clearInterval(runInterval); runInterval = null; running = false; }
    if ($('btn-run')) { $('btn-run').textContent = 'Run'; $('btn-run').dataset.state = 'stopped'; }
    if ($('fwd-status')) $('fwd-status').textContent = forwardingEnabled ? 'Enabled' : 'Disabled';
    if ($('hazard-status')) $('hazard-status').textContent = 'None';
    hideForwardingPath('ex-mem');
    hideForwardingPath('mem-wb');
    updateDisplay();
    drawWaveform();
  }

  function injectHazard() {
    hazardActive = true;
    if ($('hazard-status')) $('hazard-status').textContent = 'RAW Hazard Detected';
    const exStage = $('stage-ex');
    if (exStage) {
      exStage.classList.add('hazard');
      setTimeout(() => exStage.classList.remove('hazard'), 600);
    }
  }

  function branchFlush() {
    flushPending = true;
    advancePipeline();
  }

  function toggleForwarding() {
    forwardingEnabled = !forwardingEnabled;
    if ($('fwd-status')) $('fwd-status').textContent = forwardingEnabled ? 'Enabled' : 'Disabled';
  }

  function toggleRun() {
    if (running) {
      clearInterval(runInterval);
      runInterval = null;
      running = false;
      if ($('btn-run')) { $('btn-run').textContent = 'Run'; $('btn-run').dataset.state = 'stopped'; }
    } else {
      running = true;
      if ($('btn-run')) { $('btn-run').textContent = 'Stop'; $('btn-run').dataset.state = 'running'; }
      runInterval = setInterval(advancePipeline, 600);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ISA EXPLORER
  // ═══════════════════════════════════════════════════════════════════════════

  const ISA_DB = [
    {
      mnemonic: 'ADD', type: 'R', opcode: '000001',
      desc: 'Add two registers',
      encoding: { opcode: [31, 26], rd: [25, 21], rs1: [20, 16], rs2: [15, 11], unused: [10, 0] },
      latency: 1, stages: ['IF', 'ID', 'EX', 'MEM', 'WB'],
      example: 'ADD r1, r2, r3    ; r1 = r2 + r3',
      lean: 'theorem add_deterministic : ∀ s₁ s₂ : State,\n  s₁.regs = s₂.regs → exec ADD s₁ = exec ADD s₂'
    },
    {
      mnemonic: 'SUB', type: 'R', opcode: '000010',
      desc: 'Subtract two registers',
      encoding: { opcode: [31, 26], rd: [25, 21], rs1: [20, 16], rs2: [15, 11], unused: [10, 0] },
      latency: 1, stages: ['IF', 'ID', 'EX', 'MEM', 'WB'],
      example: 'SUB r4, r5, r6    ; r4 = r5 - r6',
      lean: 'theorem sub_deterministic : ∀ s₁ s₂ : State,\n  s₁.regs = s₂.regs → exec SUB s₁ = exec SUB s₂'
    },
    {
      mnemonic: 'NAND', type: 'R', opcode: '000011',
      desc: 'Bitwise NAND of two registers',
      encoding: { opcode: [31, 26], rd: [25, 21], rs1: [20, 16], rs2: [15, 11], unused: [10, 0] },
      latency: 1, stages: ['IF', 'ID', 'EX', 'MEM', 'WB'],
      example: 'NAND r7, r1, r8   ; r7 = ~(r1 & r8)',
      lean: 'theorem nand_correct : ∀ a b : Word32,\n  exec_nand a b = ¬(a ∧ b)'
    },
    {
      mnemonic: 'XOR', type: 'R', opcode: '000100',
      desc: 'Bitwise exclusive OR',
      encoding: { opcode: [31, 26], rd: [25, 21], rs1: [20, 16], rs2: [15, 11], unused: [10, 0] },
      latency: 1, stages: ['IF', 'ID', 'EX', 'MEM', 'WB'],
      example: 'XOR r9, r3, r4    ; r9 = r3 ^ r4',
      lean: 'theorem xor_involutive : ∀ a b : Word32,\n  exec_xor (exec_xor a b) b = a'
    },
    {
      mnemonic: 'SHL', type: 'R', opcode: '000101',
      desc: 'Shift left logical',
      encoding: { opcode: [31, 26], rd: [25, 21], rs1: [20, 16], shamt: [15, 11], unused: [10, 0] },
      latency: 1, stages: ['IF', 'ID', 'EX', 'MEM', 'WB'],
      example: 'SHL r12, r1, 2    ; r12 = r1 << 2',
      lean: 'theorem shl_bounded : ∀ x : Word32, ∀ n : Fin 32,\n  bit_width (exec_shl x n) ≤ 32'
    },
    {
      mnemonic: 'SHR', type: 'R', opcode: '000110',
      desc: 'Shift right logical',
      encoding: { opcode: [31, 26], rd: [25, 21], rs1: [20, 16], shamt: [15, 11], unused: [10, 0] },
      latency: 1, stages: ['IF', 'ID', 'EX', 'MEM', 'WB'],
      example: 'SHR r13, r4, 1    ; r13 = r4 >>> 1',
      lean: 'theorem shr_bounded : ∀ x : Word32, ∀ n : Fin 32,\n  exec_shr x n ≤ x'
    },
    {
      mnemonic: 'LOAD', type: 'I', opcode: '001000',
      desc: 'Load word from data memory',
      encoding: { opcode: [31, 26], rd: [25, 21], rs1: [20, 16], imm: [15, 0] },
      latency: 5, stages: ['IF', 'ID', 'EX', 'MEM*', 'WB'],
      example: 'LOAD r10, [r1+0]  ; r10 = mem[r1 + 0]',
      lean: 'theorem load_timing : ∀ addr : Addr,\n  latency (exec LOAD addr) = 5'
    },
    {
      mnemonic: 'STORE', type: 'I', opcode: '001001',
      desc: 'Store word to data memory',
      encoding: { opcode: [31, 26], rs2: [25, 21], rs1: [20, 16], imm: [15, 0] },
      latency: 5, stages: ['IF', 'ID', 'EX', 'MEM*', 'WB'],
      example: 'STORE [r2+0], r5  ; mem[r2 + 0] = r5',
      lean: 'theorem store_timing : ∀ addr : Addr, ∀ val : Word32,\n  latency (exec STORE addr val) = 5'
    },
    {
      mnemonic: 'BEQ', type: 'B', opcode: '010000',
      desc: 'Branch if registers are equal',
      encoding: { opcode: [31, 26], rs1: [25, 21], rs2: [20, 16], offset: [15, 0] },
      latency: 1, stages: ['IF', 'ID', 'EX (resolve)', 'flush', 'flush'],
      example: 'BEQ r1, r0, +4    ; if r1 == r0 then PC += 4',
      lean: 'theorem branch_penalty_two : ∀ cond : Bool,\n  cond = true → flush_cycles (exec BEQ cond) = 2'
    },
    {
      mnemonic: 'BNE', type: 'B', opcode: '010001',
      desc: 'Branch if registers are not equal',
      encoding: { opcode: [31, 26], rs1: [25, 21], rs2: [20, 16], offset: [15, 0] },
      latency: 1, stages: ['IF', 'ID', 'EX (resolve)', 'flush', 'flush'],
      example: 'BNE r1, r0, +8    ; if r1 != r0 then PC += 8',
      lean: 'theorem bne_penalty_two : ∀ cond : Bool,\n  cond = true → flush_cycles (exec BNE cond) = 2'
    },
    {
      mnemonic: 'JAL', type: 'J', opcode: '010010',
      desc: 'Jump and link (save return address)',
      encoding: { opcode: [31, 26], rd: [25, 21], offset: [20, 0] },
      latency: 1, stages: ['IF', 'ID', 'EX', 'flush', 'flush'],
      example: 'JAL r15, label    ; r15 = PC+4; PC = label',
      lean: 'theorem jal_link_correct : ∀ pc : Addr,\n  (exec JAL pc).link_reg = pc + 4'
    },
    {
      mnemonic: 'TMUL', type: 'T', opcode: '100000',
      desc: 'Tensor multiply (matrix engine, 4×4×4)',
      encoding: { opcode: [31, 26], td: [25, 21], ts1: [20, 16], ts2: [15, 11], unused: [10, 0] },
      latency: 4, stages: ['ISSUE', 'EXECUTE', 'WRITEBACK', 'COMMIT'],
      example: 'TMUL t0, t1, t2   ; t0 = t1 × t2 (4×4 matrix)',
      lean: 'theorem tmul_timing_exact :\n  latency (exec TMUL) = 4'
    },
    {
      mnemonic: 'TLOAD', type: 'T', opcode: '100001',
      desc: 'Load tensor register from scratchpad',
      encoding: { opcode: [31, 26], td: [25, 21], rs1: [20, 16], imm: [15, 0] },
      latency: 5, stages: ['ISSUE', 'ADDR', 'EXECUTE', 'WRITEBACK', 'COMMIT'],
      example: 'TLOAD t0, [r1+0]  ; t0 = scratch[r1 + offset]',
      lean: 'theorem tload_timing_exact :\n  latency (exec TLOAD) = 5'
    },
    {
      mnemonic: 'TSTORE', type: 'T', opcode: '100010',
      desc: 'Store tensor register to scratchpad',
      encoding: { opcode: [31, 26], ts: [25, 21], rs1: [20, 16], imm: [15, 0] },
      latency: 5, stages: ['ISSUE', 'ADDR', 'EXECUTE', 'WRITEBACK', 'COMMIT'],
      example: 'TSTORE [r1+0], t0 ; scratch[r1 + offset] = t0',
      lean: 'theorem tstore_timing_exact :\n  latency (exec TSTORE) = 5'
    }
  ];

  function initISAExplorer() {
    const list = $('isa-list');
    const detail = $('isa-detail');
    const search = $('isa-search');
    if (!list || !detail || !search) return;

    function renderList(filter) {
      list.innerHTML = '';
      const f = (filter || '').toLowerCase();
      ISA_DB.filter(i => !f || i.mnemonic.toLowerCase().includes(f) || i.desc.toLowerCase().includes(f) || i.type.toLowerCase().includes(f))
        .forEach(instr => {
          const btn = document.createElement('button');
          btn.className = 'isa-item';
          btn.setAttribute('aria-label', `${instr.mnemonic} - ${instr.desc}`);
          btn.innerHTML = `<span class="isa-mnemonic">${instr.mnemonic}</span><span class="isa-type">${instr.type}</span>`;
          btn.addEventListener('click', () => showInstruction(instr));
          list.appendChild(btn);
        });
    }

    function showInstruction(instr) {
      document.querySelectorAll('.isa-item').forEach(el => el.classList.remove('active'));
      const active = [...document.querySelectorAll('.isa-item')].find(el =>
        el.querySelector('.isa-mnemonic').textContent === instr.mnemonic
      );
      if (active) active.classList.add('active');

      detail.innerHTML = `
        <div class="isa-detail-header">
          <h3>${instr.mnemonic}</h3>
          <span class="isa-detail-type">${instr.type}-Type</span>
          <span class="isa-detail-latency">${instr.latency} cycle${instr.latency > 1 ? 's' : ''}</span>
        </div>
        <p class="isa-detail-desc">${instr.desc}</p>

        <div class="isa-panel">
          <h4>Encoding [31:0]</h4>
          <div class="encoding-diagram">${renderEncoding(instr)}</div>
        </div>

        <div class="isa-panel">
          <h4>Pipeline Stages</h4>
          <div class="pipeline-stages-mini">${instr.stages.map(s =>
            `<span class="stage-tag${s.includes('flush') ? ' stage-flush' : ''}${s.includes('*') ? ' stage-mem' : ''}">${s}</span>`
          ).join('<span class="stage-arrow-mini">→</span>')}</div>
        </div>

        <div class="isa-panel">
          <h4>Example</h4>
          <pre class="isa-code">${instr.example}</pre>
        </div>

        <div class="isa-panel">
          <h4>Formal Property (Lean 4)</h4>
          <pre class="isa-code isa-lean">${instr.lean}</pre>
        </div>
      `;
    }

    function renderEncoding(instr) {
      const fields = instr.encoding;
      const colors = {
        opcode: '#FB3640', rd: '#4DC9F6', rs1: '#2997FF', rs2: '#86868B',
        td: '#4DC9F6', ts1: '#2997FF', ts2: '#86868B', ts: '#4DC9F6',
        imm: '#627D98', offset: '#627D98', shamt: '#9FB3C8', unused: '#334E68'
      };
      let html = '<div class="encoding-fields">';
      for (const [name, bits] of Object.entries(fields)) {
        const width = bits[0] - bits[1] + 1;
        const pct = (width / 32) * 100;
        const color = colors[name] || '#424245';
        html += `<div class="enc-field" style="width:${pct}%; background: ${color}20; border-color: ${color}">
          <span class="enc-bits">[${bits[0]}:${bits[1]}]</span>
          <span class="enc-name">${name}</span>
          <span class="enc-width">${width}b</span>
        </div>`;
      }
      html += '</div>';
      return html;
    }

    search.addEventListener('input', e => renderList(e.target.value));
    renderList('');
    showInstruction(ISA_DB[0]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ARCHITECTURE DEEP DIVE
  // ═══════════════════════════════════════════════════════════════════════════

  const STAGE_DETAILS = {
    'if': {
      title: 'Instruction Fetch (IF)',
      content: `
        <div class="detail-section"><h4>Function</h4><p>Fetch the next instruction from instruction memory using the current Program Counter.</p></div>
        <div class="detail-section"><h4>Components</h4><ul>
          <li>Program Counter (PC) register</li>
          <li>PC + 4 adder (word-aligned)</li>
          <li>Branch target MUX (selected by EX stage resolution)</li>
          <li>Instruction memory interface (single-port read)</li>
        </ul></div>
        <div class="detail-section"><h4>Timing</h4><p>Single cycle. PC updates on rising clock edge. Instruction available at end of cycle.</p></div>
        <div class="detail-section"><h4>Branch Handling</h4><p>Static not-taken prediction. On taken branch (resolved in EX): 2-cycle flush penalty. Proven exact in Lean 4.</p></div>
      `
    },
    'id': {
      title: 'Instruction Decode (ID)',
      content: `
        <div class="detail-section"><h4>Function</h4><p>Decode opcode, read source registers, generate control signals, detect data hazards.</p></div>
        <div class="detail-section"><h4>Components</h4><ul>
          <li>Instruction decoder (opcode → control word)</li>
          <li>Register file read ports (2 simultaneous combinational reads)</li>
          <li>Immediate generator (sign-extend 16-bit → 32-bit)</li>
          <li>Hazard detection unit (RAW check against EX/MEM destinations)</li>
        </ul></div>
        <div class="detail-section"><h4>Hazard Detection</h4><p>Detects RAW hazards. If load-use and forwarding cannot resolve: insert 1-cycle bubble. All other RAW resolved via forwarding network.</p></div>
        <div class="detail-section"><h4>Register Read</h4><p>Combinational read. Write-through enabled: if WB writes same register this cycle, forwarded value is used.</p></div>
      `
    },
    'ex': {
      title: 'Execute (EX)',
      content: `
        <div class="detail-section"><h4>Function</h4><p>Perform ALU operations, resolve branches, compute memory addresses, select forwarded operands.</p></div>
        <div class="detail-section"><h4>Components</h4><ul>
          <li>Integer ALU: ADD, SUB, NAND, XOR, SHL, SHR, SLT, SLTU</li>
          <li>Branch comparator + target address calculator</li>
          <li>Forwarding MUX (selects between reg-read, EX-forward, MEM-forward)</li>
          <li>Address generator (base register + sign-extended immediate)</li>
        </ul></div>
        <div class="detail-section"><h4>Forwarding</h4><p>EX result available for forwarding to next instruction (EX→EX path). Single-cycle latency for ALU chains.</p></div>
        <div class="detail-section"><h4>Branch Resolution</h4><p>Branch condition evaluated here. On taken: generates flush signal for IF and ID stages (2-cycle penalty, exact).</p></div>
      `
    },
    'mem': {
      title: 'Memory Access (MEM)',
      content: `
        <div class="detail-section"><h4>Function</h4><p>Access data memory for loads and stores. Non-memory instructions pass through unchanged.</p></div>
        <div class="detail-section"><h4>Components</h4><ul>
          <li>Data memory interface (single-port, read or write per cycle)</li>
          <li>Load alignment logic (byte/halfword/word extraction)</li>
          <li>Store alignment + byte-enable generation</li>
          <li>Memory-mapped I/O address decode (upper 256 bytes)</li>
        </ul></div>
        <div class="detail-section"><h4>Forwarding</h4><p>MEM result forwarded to EX of instruction 2 cycles behind (MEM→EX path). Resolves load-followed-by-ALU patterns.</p></div>
        <div class="detail-section"><h4>Scratchpad</h4><p>16KB on-chip SRAM. Single-cycle access. No cache misses. Deterministic by construction.</p></div>
      `
    },
    'wb': {
      title: 'Write Back (WB)',
      content: `
        <div class="detail-section"><h4>Function</h4><p>Write computed or loaded value back to the register file. Instruction is architecturally committed.</p></div>
        <div class="detail-section"><h4>Components</h4><ul>
          <li>Write-back MUX (selects ALU result vs. memory read data)</li>
          <li>Register file write port (single port, rising edge)</li>
          <li>Write-through path to ID stage (same-cycle forwarding)</li>
        </ul></div>
        <div class="detail-section"><h4>Commit Rules</h4><p>r0 is hardwired to zero — all writes to r0 are silently discarded. Instruction count incremented on commit.</p></div>
        <div class="detail-section"><h4>Architectural State</h4><p>After WB, the register write is visible to all subsequent instructions. State transition is irreversible and deterministic.</p></div>
      `
    }
  };

  function initArchExplorer() {
    const stages = document.querySelectorAll('.arch-stage');
    const panel = $('arch-detail-panel');
    if (!stages.length || !panel) return;

    stages.forEach(stage => {
      stage.addEventListener('click', () => {
        const key = stage.dataset.stage;
        const info = STAGE_DETAILS[key];
        if (!info) return;
        stages.forEach(s => s.classList.remove('arch-active'));
        stage.classList.add('arch-active');
        panel.innerHTML = `<h3>${info.title}</h3>${info.content}`;
        panel.classList.add('visible');
      });

      stage.addEventListener('mouseenter', () => stage.classList.add('arch-hover'));
      stage.addEventListener('mouseleave', () => stage.classList.remove('arch-hover'));
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SILICON TAB SELECTOR
  // ═══════════════════════════════════════════════════════════════════════════

  function initSiliconTabs() {
    const tabs = document.querySelectorAll('.silicon-tab');
    const panels = document.querySelectorAll('.silicon-panel');
    if (!tabs.length) return;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = $(`panel-${tab.dataset.target}`);
        if (target) target.classList.add('active');
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REDUCED MOTION + ACCESSIBILITY
  // ═══════════════════════════════════════════════════════════════════════════

  function checkReducedMotion() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.body.classList.add('reduced-motion');
    }
  }

  function initKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          advancePipeline();
          break;
        case 'r':
          if (!e.ctrlKey && !e.metaKey) toggleRun();
          break;
        case 'Escape':
          if (running) toggleRun();
          break;
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SMOOTH SCROLL NAV
  // ═══════════════════════════════════════════════════════════════════════════

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const target = document.querySelector(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════

  function init() {
    checkReducedMotion();

    if ($('btn-clock')) $('btn-clock').addEventListener('click', advancePipeline);
    if ($('btn-step')) $('btn-step').addEventListener('click', advancePipeline);
    if ($('btn-run')) $('btn-run').addEventListener('click', toggleRun);
    if ($('btn-reset')) $('btn-reset').addEventListener('click', reset);
    if ($('btn-hazard')) $('btn-hazard').addEventListener('click', injectHazard);
    if ($('btn-flush')) $('btn-flush').addEventListener('click', branchFlush);
    if ($('btn-toggle-fwd')) $('btn-toggle-fwd').addEventListener('click', toggleForwarding);

    updateDisplay();
    initISAExplorer();
    initArchExplorer();
    initSiliconTabs();
    initKeyboard();
    initSmoothScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
