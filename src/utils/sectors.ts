/**
 * Padronização e Normalização Canônica de Setores — Padrão Oficial ANBIMA
 * Consolida setores cadastrais de diversas fontes (ANBIMA, CVM, Securitizadoras,
 * B3, tb_agente_cadastral) para os 27 setores oficiais de Debêntures / Renda Fixa ANBIMA.
 */

export const CANONICAL_SECTORS = [
  'Agropecuária',
  'Alimentos e Bebidas',
  'Assistência Médica',
  'Bioenergia',
  'Comércio Atacadista e Varejista',
  'Comunicação',
  'Construção Civil',
  'Educação',
  'Empreendimentos e Participações',
  'Energia Elétrica',
  'Financeiro',
  'Indústria Automobilística',
  'Indústria e Comércio',
  'Locação de Veículos',
  'Materiais de Construção e Agregados',
  'Metalurgia e Siderurgia',
  'Mineração',
  'Máquinas e Equipamentos',
  'Outros Serviços',
  'Papel e Celulose',
  'Petróleo e Gás',
  'Química e Petroquímica',
  'Saneamento',
  'Serviços Imobiliários',
  'TI e Telecomunicações',
  'Transporte e Logística',
  'Têxtil e Calçados'
] as const;

export type CanonicalSector = typeof CANONICAL_SECTORS[number];

// Tabela de acesso rápido direta (case-insensitive) para os 27 setores oficiais
const ANBIMA_LOOKUP: Record<string, CanonicalSector> = {};
CANONICAL_SECTORS.forEach(sec => {
  ANBIMA_LOOKUP[sec.toLowerCase()] = sec;
});

/**
 * Normaliza qualquer valor bruto de setor para os 27 setores oficiais ANBIMA.
 */
export function normalizeSector(raw?: string | null): string {
  if (!raw) return 'Outros Serviços';
  const clean = String(raw).trim();
  if (!clean) return 'Outros Serviços';

  const lower = clean.toLowerCase();
  if (['nan', 'none', 'n/d', '-', 'null', 'undefined', 'outros'].includes(lower)) {
    return 'Outros Serviços';
  }

  // 1. Mapeamento direto exato (insensível a maiúsculas/minúsculas)
  if (ANBIMA_LOOKUP[lower]) {
    return ANBIMA_LOOKUP[lower];
  }

  // 2. Regras específicas para variações cadastrais de CVM e Securitizadoras

  // Sucroenergético / Cana / Açúcar -> Bioenergia
  if (
    lower.includes('açúcar') ||
    lower.includes('acucar') ||
    lower.includes('açuc') ||
    lower.includes('acuc') ||
    lower.includes('cana') ||
    lower.includes('sucroenerg') ||
    lower.includes('usina') ||
    lower.includes('bioenergia') ||
    lower.includes('biocombust')
  ) {
    return 'Bioenergia';
  }

  // Alimentos / Carnes / Frigorífico -> Alimentos e Bebidas
  if (
    lower.includes('carne') ||
    lower.includes('frigorífico') ||
    lower.includes('frigorifico') ||
    lower.includes('bebida') ||
    lower.includes('alimento') ||
    lower.includes('cerveja') ||
    lower.includes('laticínio') ||
    lower.includes('laticinio')
  ) {
    return 'Alimentos e Bebidas';
  }

  // Saúde / Farma / Hospitais
  if (
    lower.includes('farmac') ||
    lower.includes('saúde') ||
    lower.includes('saude') ||
    lower.includes('hospital') ||
    lower.includes('médic') ||
    lower.includes('medic') ||
    lower.includes('diagnóstic') ||
    lower.includes('diagnostico') ||
    lower.includes('laborat')
  ) {
    // Farmácias de varejo entram em Comércio Atacadista e Varejista
    if (lower.includes('varejo') || lower.includes('comércio') || lower.includes('comercio')) {
      return 'Comércio Atacadista e Varejista';
    }
    return 'Assistência Médica';
  }

  // Veículos / Frotas / Locação
  if (
    lower.includes('locação') ||
    lower.includes('locacao') ||
    lower.includes('frota')
  ) {
    return 'Locação de Veículos';
  }

  // Energia Elétrica & Renováveis
  if (
    lower.includes('solar') ||
    lower.includes('fotovoltaica') ||
    lower.includes('energia elétrica') ||
    lower.includes('energia eletrica') ||
    lower.includes('eólica') ||
    lower.includes('eolica') ||
    lower.includes('hidrelétrica') ||
    lower.includes('hidreletrica') ||
    lower.includes('geração de energia') ||
    lower.includes('energia')
  ) {
    return 'Energia Elétrica';
  }

  // Imobiliário & Shoppings
  if (
    lower.includes('shopping') ||
    lower.includes('imobiliár') ||
    lower.includes('imobiliar') ||
    lower.includes('properties') ||
    lower.includes('incorporação') ||
    lower.includes('incorporacao') ||
    lower.includes('loteamento')
  ) {
    return 'Serviços Imobiliários';
  }

  // Cimento & Materiais de Construção
  if (
    lower.includes('cimento') ||
    lower.includes('materiais de construção') ||
    lower.includes('materiais de construcao') ||
    lower.includes('agregados') ||
    lower.includes('concreto')
  ) {
    return 'Materiais de Construção e Agregados';
  }

  // Construção Civil & Engenharia
  if (
    lower.includes('construção civil') ||
    lower.includes('construcao civil') ||
    lower.includes('construção') ||
    lower.includes('construcao') ||
    lower.includes('engenharia') ||
    lower.includes('obras')
  ) {
    return 'Construção Civil';
  }

  // Varejo & Comércio
  if (
    lower.includes('varejo') ||
    lower.includes('supermercado') ||
    lower.includes('atacadista')
  ) {
    return 'Comércio Atacadista e Varejista';
  }

  // Têxtil, Calçados, Algodão & Denim
  if (
    lower.includes('denim') ||
    lower.includes('algodão') ||
    lower.includes('algodao') ||
    lower.includes('têxtil') ||
    lower.includes('textil') ||
    lower.includes('calçado') ||
    lower.includes('calcado') ||
    lower.includes('vestuário') ||
    lower.includes('vestuario')
  ) {
    return 'Têxtil e Calçados';
  }

  // Educação
  if (
    lower.includes('educação') ||
    lower.includes('educacao') ||
    lower.includes('ensino') ||
    lower.includes('escola') ||
    lower.includes('universidade') ||
    lower.includes('faculdade')
  ) {
    return 'Educação';
  }

  // Metalurgia & Siderurgia
  if (
    lower.includes('metalurgia') ||
    lower.includes('siderurgia') ||
    lower.includes('aço') ||
    lower.includes('aco') ||
    lower.includes('fundição') ||
    lower.includes('fundicao')
  ) {
    return 'Metalurgia e Siderurgia';
  }

  // Máquinas & Equipamentos
  if (
    lower.includes('máquina') ||
    lower.includes('maquina') ||
    lower.includes('equipamento') ||
    lower.includes('trator')
  ) {
    return 'Máquinas e Equipamentos';
  }

  // Mineração
  if (
    lower.includes('mineração') ||
    lower.includes('mineracao') ||
    lower.includes('minério') ||
    lower.includes('minerio')
  ) {
    return 'Mineração';
  }

  // Petróleo & Gás
  if (
    lower.includes('petróleo') ||
    lower.includes('petroleo') ||
    lower.includes('gás') ||
    lower.includes('gas') ||
    lower.includes('combustíve') ||
    lower.includes('combustive')
  ) {
    return 'Petróleo e Gás';
  }

  // Química & Petroquímica
  if (
    lower.includes('química') ||
    lower.includes('quimica') ||
    lower.includes('petroquímica') ||
    lower.includes('petroquimica') ||
    lower.includes('fertilizante')
  ) {
    return 'Química e Petroquímica';
  }

  // Papel & Celulose
  if (lower.includes('papel') || lower.includes('celulose') || lower.includes('embalag')) {
    return 'Papel e Celulose';
  }

  // Transporte & Logística
  if (
    lower.includes('transporte') ||
    lower.includes('logística') ||
    lower.includes('logistica') ||
    lower.includes('rodovia') ||
    lower.includes('porto') ||
    lower.includes('aeroporto') ||
    lower.includes('ferrovia') ||
    lower.includes('concessão rodoviária') ||
    lower.includes('concessao rodoviaria')
  ) {
    return 'Transporte e Logística';
  }

  // Saneamento
  if (
    lower.includes('saneamento') ||
    lower.includes('água') ||
    lower.includes('agua') ||
    lower.includes('esgoto') ||
    lower.includes('resíduos') ||
    lower.includes('residuos')
  ) {
    return 'Saneamento';
  }

  // Agropecuária (commodities, cooperativas, batata, produtor rural)
  if (
    lower.includes('agro') ||
    lower.includes('pecuária') ||
    lower.includes('pecuaria') ||
    lower.includes('rural') ||
    lower.includes('agrícola') ||
    lower.includes('agricola') ||
    lower.includes('batata') ||
    lower.includes('commodity') ||
    lower.includes('commodities') ||
    lower.includes('grão') ||
    lower.includes('grao') ||
    lower.includes('soja') ||
    lower.includes('milho')
  ) {
    return 'Agropecuária';
  }

  // TI e Telecomunicações (palavras inteiras para evitar falsos positivos como 'corporativo' ou 'commodities')
  if (
    /\b(ti|telecom|telefonia|software|tecnologia|informática|informatica)\b/i.test(lower) ||
    lower.includes('comunicação') ||
    lower.includes('comunicacao') ||
    lower.includes('data center') ||
    lower.includes('provedor de internet')
  ) {
    return 'TI e Telecomunicações';
  }

  // Empreendimentos e Participações (Holdings / Corporativo)
  if (
    lower.includes('corporativo') ||
    lower.includes('participações') ||
    lower.includes('participacoes') ||
    lower.includes('holding')
  ) {
    return 'Empreendimentos e Participações';
  }

  // Financeiro
  if (
    lower.includes('banco') ||
    lower.includes('financeir') ||
    lower.includes('securitiz') ||
    lower.includes('crédito') ||
    lower.includes('credito') ||
    lower.includes('leasing')
  ) {
    return 'Financeiro';
  }

  // Indústria Automobilística
  if (
    lower.includes('automobilístic') ||
    lower.includes('automobilistic') ||
    lower.includes('montadora') ||
    lower.includes('autopeças') ||
    lower.includes('autopecas')
  ) {
    return 'Indústria Automobilística';
  }

  // Indústria e Comércio
  if (
    lower.includes('indústria e comércio') ||
    lower.includes('industria e comercio') ||
    lower.includes('manufatura') ||
    lower.includes('indústria') ||
    lower.includes('industria')
  ) {
    return 'Indústria e Comércio';
  }

  return 'Outros Serviços';
}
