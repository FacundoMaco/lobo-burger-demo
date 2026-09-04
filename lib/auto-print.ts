// Scheduler puro del auto-print secuencial del KDS. Sin "use client", sin
// DOM, sin React (mismo contrato que lib/menu.ts) para poder testearlo con
// fake timers sin montar el componente entero.
//
// Regla de oro: onPrinted(o) SOLO se llama despues de que onPrint(o) termino
// sin lanzar excepcion. Si onPrint falla, el pedido no se marca y la cola
// sigue con el siguiente pedido.

export interface ScheduleAutoPrintOptions<T> {
  orders: T[];
  onStage: (order: T) => void;
  onPrint: (order: T) => void;
  onPrinted: (order: T) => void;
  intervalMs?: number;
  printDelayMs?: number;
}

export interface AutoPrintHandle<T> {
  timers: ReturnType<typeof setTimeout>[];
  cancel: () => T[];
}

export function scheduleAutoPrint<T>({
  orders,
  onStage,
  onPrint,
  onPrinted,
  intervalMs = 1500,
  printDelayMs = 300,
}: ScheduleAutoPrintOptions<T>): AutoPrintHandle<T> {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const pending = new Set<T>(orders);
  let cancelled = false;

  orders.forEach((order, i) => {
    const stageTimer = setTimeout(() => {
      if (cancelled) return;
      onStage(order);

      const printTimer = setTimeout(() => {
        if (cancelled) return;
        try {
          onPrint(order);
          pending.delete(order);
          onPrinted(order);
        } catch {
          // Impresion fallida: el pedido queda sin marcar y el resto de la
          // cola sigue su curso normal.
        }
      }, printDelayMs);

      timers.push(printTimer);
    }, i * intervalMs);

    timers.push(stageTimer);
  });

  const cancel = (): T[] => {
    if (cancelled) return [];
    cancelled = true;
    timers.forEach(clearTimeout);
    timers.length = 0;
    const remaining = Array.from(pending);
    pending.clear();
    return remaining;
  };

  return { timers, cancel };
}
