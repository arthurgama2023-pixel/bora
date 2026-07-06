/** Normaliza número de WhatsApp brasileiro: só dígitos, garante DDI 55 na frente. */
export function normalizeBrPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}
