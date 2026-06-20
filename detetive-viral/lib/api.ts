// URL base da API. Em produção, defina NEXT_PUBLIC_API_URL no ambiente.
// Em dev, cai no localhost:3003.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';
