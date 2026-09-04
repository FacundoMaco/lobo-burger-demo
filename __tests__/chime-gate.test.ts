import { describe, it, expect } from "vitest";
import { createChimeGate, CHIME_MIN_GAP_MS } from "@/lib/chime-gate";

describe("createChimeGate", () => {
  it("primera llamada nunca bloquea el primer chime", () => {
    const gate = createChimeGate();
    expect(gate.shouldPlay(1000)).toBe(true);
  });

  it("bloquea una llamada dentro de la ventana (caso doble beep)", () => {
    const gate = createChimeGate();
    expect(gate.shouldPlay(1000)).toBe(true);
    expect(gate.shouldPlay(1100)).toBe(false);
  });

  it("permite una llamada fuera de la ventana, borde inclusivo en 1200ms", () => {
    const gate = createChimeGate();
    expect(gate.shouldPlay(1000)).toBe(true);
    expect(gate.shouldPlay(2200)).toBe(true);
  });

  it("una llamada bloqueada no extiende la ventana", () => {
    const gate = createChimeGate();
    expect(gate.shouldPlay(1000)).toBe(true);
    expect(gate.shouldPlay(1100)).toBe(false);
    expect(gate.shouldPlay(2200)).toBe(true);
  });

  it("reset() libera de inmediato", () => {
    const gate = createChimeGate();
    expect(gate.shouldPlay(1000)).toBe(true);
    gate.reset();
    expect(gate.shouldPlay(1001)).toBe(true);
  });

  it("respeta el gap custom", () => {
    const gate = createChimeGate(500);
    expect(gate.shouldPlay(0)).toBe(true);
    expect(gate.shouldPlay(400)).toBe(false);
    expect(gate.shouldPlay(500)).toBe(true);
  });

  it("dos gates creados por separado no comparten estado", () => {
    const gateA = createChimeGate();
    const gateB = createChimeGate();
    expect(gateA.shouldPlay(1000)).toBe(true);
    expect(gateB.shouldPlay(1000)).toBe(true);
  });

  it("CHIME_MIN_GAP_MS es 1200", () => {
    expect(CHIME_MIN_GAP_MS).toBe(1200);
  });
});
