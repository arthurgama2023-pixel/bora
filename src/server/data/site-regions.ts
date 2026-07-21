// Lista COMPLETA de bairros/localidades por zona — a mesma cobertura real do
// site (ss-chopp/src/data/zones.ts). Fonte única compartilhada entre a UI da
// aba "Preços do Site" (precos-site.tsx) e o agente de IA (agent.ts via
// site-pricing.ts) — assim os dois enxergam exatamente a mesma cobertura
// base, antes de aplicar extraRegions/removedRegions (por empresa, no banco).
export const REGIONS_BY_CITY: Record<string, string[]> = {
  // Duque de Caxias + São João de Meriti + Belford Roxo + Mesquita +
  // Nilópolis são todos municípios da Baixada Fluminense e SEMPRE usaram a
  // mesma tabela de preço fixo — por isso viram UMA zona só. "Centro" existe
  // em 2 municípios: desambiguado abaixo.
  "Baixada Fluminense": [
    "Centro (Duque de Caxias)", "São Bento", "Jardim Primavera", "Jardim Gramacho", "Gramacho",
    "Saracuruna", "Parque Fluminense", "Suécia", "Pantanal", "Vila Rosário",
    "Pilar", "Wona", "Jardim Leal", "Olavo Bilac", "Jardim Metrópolis",
    "Centenário", "Periquito", "Lagunas", "Prainha", "25 de Agosto",
    "Jardim Rotsen", "Chácara Rio Petrópolis", "Campos Elíseos", "Xerém",
    "Capivari", "Cidade dos Meninos", "Figueira", "Chácara Arcampo", "Eldorado",
    "Vila Ouro Preto", "Sarapuí", "Vila Urussaí", "Mangueirinha", "Santuário",
    "Bar dos Cavaleiros", "Santa Catarina", "Jardim Panamá", "São Vicente",
    "Sgt Roncali", "Bom Pastor", "Bairro das Graças", "Areia Branca",
    "Heliópolis", "Vila São Sebastião", "Apollo 11", "Boa Esperança",
    "Engenheiro Belford", "Parque Analândia", "Parque Tietê", "Vila Norma",
    "Amapá", "Jardim América", "Ana Porto", "Senhor do Bonfim", "Corte 8",
    "Itatiaia", "Andrade de Araújo", "Parque Lafaiete", "Jardim Vila Nova",
    "Vila Operária", "Vila São Luiz", "Laureano", "Lafayete", "Lote XV",
    "Vila São José", "Cangulo",
    "Parque Duque", "Santa Lúcia", "Santa Cruz da Serra", "Imbariê",
    "Parada Angélica", "Jardim Anhangá", "Parada Morabi", "Taquara",
    "Parque Paulista", "Parque Equitativa", "Alto da Serra",
    "Santo Antônio da Serra", "Mantiqueira", "Jardim Olimpo", "Lamarão",
    // São João de Meriti
    "Centro (São João de Meriti)", "São João de Meriti", "Vilar dos Teles", "Parque Araruama",
    "Coelho da Rocha", "Jardim Meriti", "Éden", "Vila Rosali", "Tomazinho",
    "São Mateus", "Vale do Ipê", "Jardim Sumaré", "Vila Tiradentes",
    "Parque Novo Rio", "Agostinho Porto", "Jardim Metrópoles", "Engenho do Porto",
    "Jardim Redentor",
    // Municípios vizinhos (hoje 1 entrada genérica cada)
    "Belford Roxo", "Mesquita", "Nilópolis",
  ],
  "Zona Norte": [
    "Brás de Pina", "Cordovil", "Parada de Lucas", "Penha", "Vista Alegre",
    "Olaria", "Ramos", "Vila da Penha", "Vicente de Carvalho", "Vigário Geral",
  ],
  // Zona Sul, Centro e Zona Oeste começam SEM bairro cadastrado — o usuário
  // decide quais adicionar (botão "Adicionar região" / campo de bairro).
  "Zona Sul": [],
  "Centro": [],
  "Zona Oeste": [],
};
