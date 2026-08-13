/*
 * Goteo de queso — elemento de firma de la marca.
 * Se usa UNA sola vez en toda la página: borde inferior del hero,
 * entre el carrusel de promos y la grilla de menú.
 */
export function CheeseDrip({ fill = "#F5A623" }: { fill?: string }) {
  return (
    <svg
      viewBox="0 0 1440 96"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="block w-full"
      style={{ height: "clamp(44px, 6.5vw, 96px)", marginTop: "-1px" }}
    >
      <path
        fill={fill}
        d="M0,0 H1440 V30
           C1392,42 1344,40 1296,36
           C1290,68 1266,70 1260,38
           C1180,46 1100,42 1020,38
           C1014,88 986,88 980,40
           C900,48 820,44 740,40
           C734,62 712,64 706,42
           C620,50 540,46 460,40
           C454,80 424,80 418,42
           C340,50 260,46 180,40
           C174,58 152,58 146,38
           C96,44 48,40 0,32 Z"
      />
    </svg>
  );
}
