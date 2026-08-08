/** Strict scan session — Person → IN|OUT → tool(s) */
const ScanEngine = (() => {
  const DIRECTIONS = ["IN", "OUT"];
  const DUPLICATE_MS = 450;

  let session = {
    personCode: null,
    personLabel: null,
    direction: null,
    toolCount: 0,
    toolsInBatch: [],
    awaitingDirectionChoice: false
  };

  let lastScanKey = "";
  let lastScanAt = 0;

  function emptySession() {
    return {
      personCode: null,
      personLabel: null,
      direction: null,
      toolCount: 0,
      toolsInBatch: [],
      awaitingDirectionChoice: false
    };
  }

  function normalize(raw) {
    return String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function classify(code) {
    if (!code) return "empty";
    if (DIRECTIONS.includes(code)) return "direction";
    if (code.startsWith("P")) return "person";
    if (typeof isTool === "function" && isTool(code)) return "tool";
    return "unknown";
  }

  function validatePerson(code) {
    if (!/^P[A-Z0-9\-_.]+$/i.test(code) || code.length < 2) {
      return "Invalid person code — use P… (e.g. P101)";
    }
    return null;
  }

  function validateTool(code) {
    if (!/^[IEBC][A-Z0-9\-_.]+$/i.test(code) || code.length < 2) {
      return "Invalid tool code — must start with I, E, C, or B";
    }
    return null;
  }

  function isDuplicateBurst(code) {
    const now = Date.now();
    if (code === lastScanKey && now - lastScanAt < DUPLICATE_MS) return true;
    lastScanKey = code;
    lastScanAt = now;
    return false;
  }

  function getSession() {
    return { ...session, toolsInBatch: [...session.toolsInBatch] };
  }

  function setPersonLabel(code, label) {
    if (session.personCode === code) session.personLabel = label;
  }

  function getStepState() {
    if (session.awaitingDirectionChoice) {
      return { step: "conflict", person: true, direction: false, tools: false };
    }
    if (!session.personCode) return { step: "person", person: false, direction: false, tools: false };
    if (!session.direction) return { step: "direction", person: true, direction: false, tools: false };
    return {
      step: session.toolCount > 0 ? "tools-active" : "tools",
      person: true,
      direction: true,
      tools: session.toolCount > 0
    };
  }

  function updateStepUi() {
    const el = document.getElementById("scanSteps");
    if (!el) return;
    const s = getStepState();
    el.querySelectorAll(".tc-step").forEach(node => {
      const key = node.dataset.step;
      node.classList.remove("active", "done");
      if (key === "person") {
        if (s.person) node.classList.add("done");
        if (s.step === "person") node.classList.add("active");
      }
      if (key === "direction") {
        if (s.direction) node.classList.add("done");
        if (s.step === "direction" || s.step === "conflict") node.classList.add("active");
      }
      if (key === "tools") {
        if (s.tools) node.classList.add("done");
        if (s.step === "tools" || s.step === "tools-active") node.classList.add("active");
      }
    });
    const hint = document.getElementById("scanStepHint");
    if (!hint) return;
    const tr = typeof t === "function" ? t : (k, v) => k;
    const hints = {
      person: tr("step1"),
      direction: tr("step2"),
      conflict: tr("conflictSub"),
      tools: tr("step3"),
      "tools-active": tr("step3active", { n: session.toolCount })
    };
    hint.textContent = hints[s.step] || hints.person;
  }

  function syncUi() {
    updateStepUi();
    if (typeof window.syncSessionUi === "function") window.syncSessionUi();
  }

  function rebuildFromQueue(scans) {
    session = emptySession();
    const pending = (scans || []).filter(s => !s.sent).sort((a, b) => a.seq - b.seq);
    for (const scan of pending) {
      const code = normalize(scan.code);
      const kind = classify(code);
      if (kind === "person") {
        session.personCode = code;
        session.personLabel = code;
        session.direction = null;
        session.toolCount = 0;
        session.toolsInBatch = [];
        session.awaitingDirectionChoice = false;
      } else if (kind === "direction") {
        session.direction = code;
        session.toolCount = 0;
        session.toolsInBatch = [];
        session.awaitingDirectionChoice = false;
      } else if (kind === "tool") {
        session.toolCount++;
        session.toolsInBatch.push(code);
      }
    }
    syncUi();
  }

  /** @returns {{ ok: boolean, type?: string, code?: string, message?: string, conflict?: boolean, queue?: boolean, logDesc?: string, dirLabel?: string }} */
  function process(codeRaw) {
    const code = normalize(codeRaw);
    if (!code) return { ok: false, type: "empty" };
    const kind = classify(code);

    if (kind !== "tool" && isDuplicateBurst(code)) {
      return { ok: false, type: "burst", code, message: "Duplicate scan ignored — wait a moment" };
    }

    if (kind === "unknown") {
      return { ok: false, type: "unknown", code, message: "Unknown code — ignored" };
    }

    if (kind === "person") {
      const err = validatePerson(code);
      if (err) return { ok: false, type: "person", code, message: err };
      session.personCode = code;
      session.personLabel = code;
      session.direction = null;
      session.toolCount = 0;
      session.toolsInBatch = [];
      session.awaitingDirectionChoice = false;
      syncUi();
      return { ok: true, type: "person", code, queue: true, logDesc: (typeof t === "function" ? t("personSelectDir") : "Person — select IN or OUT") };
    }

    if (kind === "direction") {
      if (session.awaitingDirectionChoice) {
        return { ok: false, type: "direction", code, message: "Pick IN or OUT in the dialog first", danger: true };
      }
      if (!session.personCode) {
        return { ok: false, type: "direction", code, message: "Scan person (P code) first", danger: true };
      }
      if (session.direction === code) {
        return {
          ok: false, type: "direction", code,
          message: code === "IN" ? "Already IN — scan tools for this person" : "Already OUT — scan tools for this person"
        };
      }
      if (session.direction && session.toolCount > 0) {
        return {
          ok: false, type: "direction", code,
          message: `Scan a new person (P) before ${code}`, danger: true
        };
      }
      if (session.direction && session.direction !== code) {
        session.direction = null;
        session.awaitingDirectionChoice = true;
        syncUi();
        return {
          ok: false, type: "direction", code,
          message: "IN and OUT conflict — choose final direction",
          conflict: true, danger: true, removeDirections: true
        };
      }
      session.direction = code;
      syncUi();
      return {
        ok: true, type: "direction", code, queue: true,
        logDesc: code === "OUT"
          ? (typeof t === "function" ? t("directionOut") : "Direction: OUT")
          : (typeof t === "function" ? t("directionIn") : "Direction: IN")
      };
    }

    if (kind === "tool") {
      const err = validateTool(code);
      if (err) return { ok: false, type: "tool", code, message: err, danger: true };

      if (session.awaitingDirectionChoice) {
        return { ok: false, type: "tool", code, message: "Choose IN or OUT in the dialog first", danger: true };
      }
      if (!session.personCode) {
        return { ok: false, type: "tool", code, message: "Scan person (P code) first", danger: true };
      }
      if (!session.direction) {
        return { ok: false, type: "tool", code, message: "Select IN or OUT first", needsWarning: true, danger: true };
      }
      // Same code may be scanned multiple times = quantity. Accidental
      // rapid double-scans are still blocked by the duplicate burst guard above.
      const who = session.personLabel || session.personCode;
      const isCons = typeof isConsumable === "function" && isConsumable(code);
      const dirLabel = session.direction === "OUT"
        ? (isCons ? `Issued · ${who}` : `OUT · ${who}`)
        : (isCons ? `Returned to stock · ${who}` : `IN · ${who}`);
      // Do NOT commit to batch yet — terminal may need PPE confirmation first
      return {
        ok: true, type: "tool", code, queue: true, logDesc: dirLabel, dirLabel,
        direction: session.direction, personCode: session.personCode, needsCommit: true
      };
    }

    return { ok: false, type: "unknown", code, message: "Unknown code" };
  }

  function commitTool(code) {
    const c = normalize(code);
    if (!c) return false;
    session.toolCount++;
    session.toolsInBatch.push(c);
    syncUi();
    return true;
  }

  function uncommitTool(code) {
    const c = normalize(code);
    const i = session.toolsInBatch.lastIndexOf(c);
    if (i < 0) return false;
    session.toolsInBatch.splice(i, 1);
    session.toolCount = Math.max(0, session.toolCount - 1);
    syncUi();
    return true;
  }

  function resolveConflict(dir) {
    if (!DIRECTIONS.includes(dir)) return null;
    session.awaitingDirectionChoice = false;
    session.direction = dir;
    syncUi();
    return {
      ok: true, type: "direction", code: dir, queue: true,
      logDesc: dir === "OUT"
        ? (typeof t === "function" ? t("directionOutOk") : "Direction: OUT (confirmed)")
        : (typeof t === "function" ? t("directionInOk") : "Direction: IN (confirmed)")
    };
  }

  function cancelConflict() {
    session.awaitingDirectionChoice = false;
    session.direction = null;
    syncUi();
  }

  function clearSession() {
    session = emptySession();
    syncUi();
  }

  /** Clear IN/OUT only (keep person) when no tools committed in this batch. */
  function resetDirection() {
    if (session.toolCount > 0) return false;
    session.direction = null;
    session.awaitingDirectionChoice = false;
    session.toolsInBatch = [];
    syncUi();
    return true;
  }

  return {
    normalize, classify, process, resolveConflict, cancelConflict, clearSession,
    commitTool, uncommitTool, resetDirection,
    rebuildFromQueue, getSession, setPersonLabel, getStepState, updateStepUi
  };
})();
