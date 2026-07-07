/** Normaliza número de WhatsApp brasileiro: só dígitos, garante DDI 55 na frente. */
export function normalizeBrPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/**
 * Chave canônica para COMPARAR dois telefones que podem estar em formatos
 * diferentes (com/sem DDI 55, com/sem o 9º dígito do celular, com máscara).
 * Ex.: "5521987975565", "21 98797-5565" e "2187975565" produzem a MESMA chave.
 *
 * Estratégia: só dígitos → remove DDI 55 → DDD (2 primeiros) + 8 últimos dígitos
 * (o "9" do celular fica entre o DDD e esses 8, então é ignorado de propósito).
 * Retorna null quando não há dígitos suficientes para uma comparação confiável.
 */
export function phoneMatchKey(input?: string | null): string | null {
  if (!input) return null;
  let d = input.replace(/\D/g, "");
  if (d.length < 8) return null;
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  const ddd = d.length >= 10 ? d.slice(0, 2) : "";
  const sub = d.slice(-8);
  return ddd + sub;
}
