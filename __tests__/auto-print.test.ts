import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scheduleAutoPrint } from "@/lib/auto-print";

interface FakeOrder {
  id: string;
}

describe("scheduleAutoPrint", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no llama a onPrinted antes de avanzar los timers (regresion del bug de orden)", () => {
    const orders: FakeOrder[] = [{ id: "A" }, { id: "B" }];
    const calls: string[] = [];

    scheduleAutoPrint({
      orders,
      onStage: o => calls.push(`stage:${o.id}`),
      onPrint: o => calls.push(`print:${o.id}`),
      onPrinted: o => calls.push(`printed:${o.id}`),
    });

    expect(calls.filter(c => c.startsWith("printed:"))).toHaveLength(0);
  });

  it("respeta el escalonado: printed(A) ocurre antes de stage(B)", () => {
    const orders: FakeOrder[] = [{ id: "A" }, { id: "B" }];
    const calls: string[] = [];

    scheduleAutoPrint({
      orders,
      onStage: o => calls.push(`stage:${o.id}`),
      onPrint: o => calls.push(`print:${o.id}`),
      onPrinted: o => calls.push(`printed:${o.id}`),
    });

    vi.advanceTimersByTime(800);

    expect(calls).toEqual(["stage:A", "print:A", "printed:A"]);

    vi.advanceTimersByTime(1000);

    expect(calls).toEqual([
      "stage:A", "print:A", "printed:A",
      "stage:B", "print:B", "printed:B",
    ]);

    const printedAIndex = calls.indexOf("printed:A");
    const stageBIndex = calls.indexOf("stage:B");
    expect(printedAIndex).toBeLessThan(stageBIndex);
  });

  it("si onPrint falla para A, no marca A pero B se imprime y marca normalmente", () => {
    const orders: FakeOrder[] = [{ id: "A" }, { id: "B" }];
    const calls: string[] = [];

    expect(() => {
      scheduleAutoPrint({
        orders,
        onStage: o => calls.push(`stage:${o.id}`),
        onPrint: o => {
          if (o.id === "A") throw new Error("impresora desconectada");
          calls.push(`print:${o.id}`);
        },
        onPrinted: o => calls.push(`printed:${o.id}`),
      });

      vi.advanceTimersByTime(3300);
    }).not.toThrow();

    expect(calls).not.toContain("printed:A");
    expect(calls).toContain("print:B");
    expect(calls).toContain("printed:B");
  });

  it("cancela timers pendientes con clearTimeout y no dispara nada posterior", () => {
    const orders: FakeOrder[] = [{ id: "A" }, { id: "B" }];
    const calls: string[] = [];

    const timers = scheduleAutoPrint({
      orders,
      onStage: o => calls.push(`stage:${o.id}`),
      onPrint: o => calls.push(`print:${o.id}`),
      onPrinted: o => calls.push(`printed:${o.id}`),
    });

    timers.forEach(clearTimeout);

    vi.advanceTimersByTime(5000);

    expect(calls).toHaveLength(0);
  });
});
