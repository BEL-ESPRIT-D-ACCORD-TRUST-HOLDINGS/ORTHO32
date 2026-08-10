(() => {
  'use strict';

  const INSTRUCTIONS = [
    'ADD r1, r2, r3',
    'SUB r4, r5, r6',
    'NAND r7, r1, r8',
    'XOR r9, r3, r4',
    'LOAD r10, [r1]',
    'STORE [r2], r5',
    'BEQ r1, r0, +4',
    'ADD r11, r7, r9',
    'SHL r12, r1, 2',
    'SHR r13, r4, 1',
    'TMUL t0, t1, t2',
    'ADD r14, r10, r11',
  ];

  const STAGES = ['if', 'id', 'ex', 'mem', 'wb'];
  let cycle = 0;
  let committed = 0;
  let instrPtr = 0;
  let running = false;
  let runInterval = null;
  let pipeline = [null, null, null, null, null];
  let hazardActive = false;
  let flushPending = false;

  const $ = id => document.getElementById(id);
  const slot = stage => document.querySelector(`[data-stage="${stage}"]`);

  function nextInstruction() {
    const instr = INSTRUCTIONS[instrPtr % INSTRUCTIONS.length];
    instrPtr++;
    return instr;
  }

  function advancePipeline() {
    cycle++;

    if (flushPending) {
      pipeline[0] = null;
      pipeline[1] = null;
      flushPending = false;
      updateDisplay();
      $('hazard-status').textContent = 'Branch Flush';
      STAGES.forEach((s, i) => {
        const el = document.getElementById(`stage-${s}`);
        if (i < 2) {
          el.classList.add('flushed');
          el.classList.remove('active', 'hazard');
        }
      });
      setTimeout(() => {
        STAGES.forEach(s => {
          document.getElementById(`stage-${s}`).classList.remove('flushed');
        });
        $('hazard-status').textContent = 'None';
      }, 600);
      return;
    }

    if (pipeline[4]) {
      committed++;
    }

    for (let i = 4; i > 0; i--) {
      pipeline[i] = pipeline[i - 1];
    }
    pipeline[0] = nextInstruction();

    if (hazardActive) {
      hazardActive = false;
      $('fwd-status').textContent = 'EX→MEM';
      $('fwd-ex-mem').classList.add('active');
      setTimeout(() => {
        $('fwd-ex-mem').classList.remove('active');
        $('fwd-status').textContent = '—';
      }, 500);
    }

    updateDisplay();
  }

  function updateDisplay() {
    $('cycle-count').textContent = cycle;
    $('commit-count').textContent = committed;

    STAGES.forEach((s, i) => {
      const el = document.getElementById(`stage-${s}`);
      const sl = slot(s);
      if (pipeline[i]) {
        sl.textContent = pipeline[i];
        el.classList.add('active');
        el.classList.remove('hazard', 'flushed');
      } else {
        sl.textContent = '—';
        el.classList.remove('active', 'hazard', 'flushed');
      }
    });
  }

  function reset() {
    cycle = 0;
    committed = 0;
    instrPtr = 0;
    pipeline = [null, null, null, null, null];
    hazardActive = false;
    flushPending = false;
    if (runInterval) { clearInterval(runInterval); runInterval = null; running = false; }
    $('fwd-status').textContent = '—';
    $('hazard-status').textContent = 'None';
    $('fwd-ex-mem').classList.remove('active');
    $('fwd-mem-wb').classList.remove('active');
    updateDisplay();
  }

  function injectHazard() {
    hazardActive = true;
    $('hazard-status').textContent = 'RAW Hazard (forwarding)';
    const exStage = document.getElementById('stage-ex');
    exStage.classList.add('hazard');
    setTimeout(() => exStage.classList.remove('hazard'), 600);
  }

  function branchFlush() {
    flushPending = true;
    advancePipeline();
  }

  function toggleRun() {
    if (running) {
      clearInterval(runInterval);
      runInterval = null;
      running = false;
    } else {
      running = true;
      runInterval = setInterval(advancePipeline, 700);
    }
  }

  $('btn-clock').addEventListener('click', advancePipeline);
  $('btn-step').addEventListener('click', advancePipeline);
  $('btn-run').addEventListener('click', toggleRun);
  $('btn-reset').addEventListener('click', reset);
  $('btn-hazard').addEventListener('click', injectHazard);
  $('btn-flush').addEventListener('click', branchFlush);

  updateDisplay();
})();
