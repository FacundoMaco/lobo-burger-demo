// Funciones puras de validacion, sin red y sin dependencias -- importables
// tanto desde el cliente como desde un route handler (mismo patron que
// lib/menu.ts y lib/sedes.ts).

// Replica deliberada del regex de app/checkout/page.tsx:56. Si el servidor
// usara un regex distinto, el cliente podria aceptar un email que el
// servidor rechaza y el usuario legitimo quedaria trabado sin entender por
// que. Deliberadamente laxo: no implementa RFC 5322, solo descarta lo
// obviamente roto.
export function validarEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}

// Celular peruano: 9 digitos, empieza en 9 (prefijo movil peruano). Acepta
// prefijo +51/51 opcional y limpia espacios/guiones antes de validar.
// Supuesto A2 (01-RESEARCH.md): confianza MEDIA, validado contra fuentes de
// terceros (no OSIPTEL directamente). Si es incorrecto, se rechaza un
// telefono legitimo -- por eso el mensaje de error en el handler explicita
// el formato esperado.
export function validarTelefono(telefono: string): boolean {
  const limpio = telefono.replace(/[\s-]/g, "");
  return /^(?:\+?51)?9\d{8}$/.test(limpio);
}
