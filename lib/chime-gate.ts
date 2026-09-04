// Gate puro de espaciado minimo entre chimes del KDS. Sin "use client", sin
// DOM, sin React, sin Date.now() interno (mismo contrato que lib/auto-print.ts):
// el tiempo entra como parametro `now` para poder testearlo sin montar el
// componente.
//
// Bug que previene: el chime inmediato de un pedido entrante y el tick del
// interval de 2.5s del timbre persistente son mecanismos independientes y
// pueden solaparse en un doble beep.

export const CHIME_MIN_GAP_MS = 1200;

export interface ChimeGate {
  shouldPlay(now: number): boolean;
  reset(): void;
}

export function createChimeGate(minGapMs: number = CHIME_MIN_GAP_MS): ChimeGate {
  let lastAt: number | null = null;

  return {
    shouldPlay(now: number): boolean {
      if (lastAt === null || now - lastAt >= minGapMs) {
        lastAt = now;
        return true;
      }
      return false;
    },
    reset(): void {
      lastAt = null;
    },
  };
}
