/** True quando não há FAL_KEY configurada — o app roda em modo demonstração. */
export function isMockMode(): boolean {
  return !process.env.FAL_KEY;
}
