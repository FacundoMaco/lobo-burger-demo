// RED (D-23): este archivo se escribe ANTES de que exista lib/validacion.ts.
// La corrida debe fallar por resolucion de modulo, no por un assert -- eso
// confirma de paso que el alias "@/*" esta activo en Vitest.

import { describe, expect, it } from "vitest";
import { validarEmail, validarTelefono } from "@/lib/validacion";

describe("validarEmail", () => {
  it.each([
    ["jaime@loboburger.com", true],
    ["a@b.co", true],
    ["  jaime@loboburger.com  ", true], // se hace trim antes
    ["asdf", false], // sin arroba
    ["a@b", false], // sin punto en el dominio
    ["a b@c.com", false], // espacio interno
    ["", false], // vacio
    // Regex laxo (identico al del cliente, app/checkout/page.tsx:56): esto
    // se rechaza porque \S+ antes del @ exige al menos un caracter y "@b.co"
    // no tiene ninguno. Se fija el comportamiento REAL, no el deseado --
    // divergir del cliente seria peor que ser laxo.
    ["@b.co", false],
  ])("validarEmail(%s) === %s", (email, esperado) => {
    expect(validarEmail(email)).toBe(esperado);
  });
});

describe("validarTelefono", () => {
  it.each([
    ["987654321", true], // 9 digitos, empieza en 9
    ["+51987654321", true], // prefijo +51
    ["51987654321", true], // prefijo 51 sin +
    ["987 654 321", true], // separado por espacios
    ["987-654-321", true], // separado por guiones
    ["+51 987 654 321", true], // prefijo + espacios
    ["12345678", false], // 8 digitos
    ["1234567890", false], // 10 digitos
    ["887654321", false], // 9 digitos pero no empieza en 9
    ["abcdefghi", false], // no numerico
    ["", false], // vacio
  ])("validarTelefono(%s) === %s", (telefono, esperado) => {
    expect(validarTelefono(telefono)).toBe(esperado);
  });
});
