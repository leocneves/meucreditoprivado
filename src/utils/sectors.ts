/**
 * Normalização e Padronização Canônica de Setores
 * Mapeia variações cadastrais, ruídos e cláusulas de objeto social para setores canônicos
 * alinhados ao mercado financeiro e de crédito privado brasileiro (B3 / ANBIMA / CVM).
 */

export const CANONICAL_SECTORS = [
  'Agronegócio & Alimentos',
  'Educação',
  'Energia Elétrica & Renováveis',
  'Financeiro & Seguros',
  'Holdings & Outros Serviços',
  'Imobiliário & Construção',
  'Indústria, Metalurgia & Mineração',
  'Papel, Celulose & Embalagens',
  'Petróleo, Gás & Petroquímica',
  'Saneamento & Utilidades',
  'Saúde & Farmacêutica',
  'Tecnologia & Telecomunicações',
  'Transporte, Logística & Locação',
  'Varejo & Consumo'
] as const;

export type CanonicalSector = typeof CANONICAL_SECTORS[number];

const SECTOR_RULES: [CanonicalSector, string[]][] = [
  [
    'Agronegócio & Alimentos',
    [
      'agro', 'alimento', 'bebida', 'commodit', 'carne', 'batata',
      'cana', 'pecuária', 'pecuaria', 'frigorífico', 'frigorifico',
      'cooperativa', 'produtor rural', 'produtos agropecuários', 'produtos agropecuarios',
      'algodão', 'algodao', 'denim'
    ]
  ],
  [
    'Educação',
    [
      'educação', 'educacao', 'ensino', 'superior', 'escola', 'universidade'
    ]
  ],
  [
    'Energia Elétrica & Renováveis',
    [
      'energia', 'fotovoltaica', 'solar', 'bioenergia',
      'sucroenergético', 'sucroenergetico', 'usina'
    ]
  ],
  [
    'Financeiro & Seguros',
    [
      'financeir', 'banco', 'seguro', 'crédito', 'credito', 'securitiz', 'leasing', 'previdência', 'previdencia'
    ]
  ],
  [
    'Imobiliário & Construção',
    [
      'imobiliár', 'imobiliar', 'construção', 'construcao', 'incorporação',
      'incorporacao', 'shopping', 'commercial properties', 'cimento',
      'engenharia', 'materiais de construção', 'materiais de construcao'
    ]
  ],
  [
    'Indústria, Metalurgia & Mineração',
    [
      'metalurgia', 'siderurgia', 'mineração', 'mineracao', 'máquina', 'maquina',
      'equipamento', 'automobilístic', 'automobilistic', 'indústria e comércio',
      'industria e comercio', 'indústria', 'industria', 'manufatura'
    ]
  ],
  [
    'Papel, Celulose & Embalagens',
    [
      'papel', 'celulose', 'embalag'
    ]
  ],
  [
    'Petróleo, Gás & Petroquímica',
    [
      'petróleo', 'petroleo', 'gás', 'gas', 'petroquímic', 'petroquimic', 'químic', 'quimic', 'combustíve', 'combustive'
    ]
  ],
  [
    'Saneamento & Utilidades',
    [
      'saneamento', 'água', 'agua', 'esgoto', 'resíduos', 'residuos'
    ]
  ],
  [
    'Saúde & Farmacêutica',
    [
      'saúde', 'saude', 'farmacêutic', 'farmaceutic', 'hospital',
      'assistência médica', 'assistencia medica', 'médic', 'medic', 'diagnóstic', 'diagnostico'
    ]
  ],
  [
    'Tecnologia & Telecomunicações',
    [
      'telecomunicaç', 'telecomunicac', 'ti e telecomunicações',
      'tecnologia', 'comunicação', 'comunicacao', 'software', 'informática', 'informatica'
    ]
  ],
  [
    'Transporte, Logística & Locação',
    [
      'transporte', 'logística', 'logistica', 'locação', 'locacao',
      'veículo', 'veiculo', 'frota', 'estacionamento', 'rodovia', 'concessão rodoviária',
      'concessao rodoviaria', 'porto', 'aeroporto'
    ]
  ],
  [
    'Varejo & Consumo',
    [
      'varejo', 'supermercado', 'comércio atacadista', 'comercio atacadista',
      'atacado', 'têxtil', 'textil', 'calçado', 'calcado', 'vestuário', 'vestuario'
    ]
  ]
];

export function normalizeSector(raw?: string | null): string {
  if (!raw) return 'Holdings & Outros Serviços';
  const clean = String(raw).trim();
  if (!clean || ['nan', 'NaN', 'None', 'N/D', '-', 'null', 'undefined'].includes(clean)) {
    return 'Holdings & Outros Serviços';
  }

  const lower = clean.toLowerCase();

  // Prioridades de desambiguação
  if (lower.includes('farmac') || lower.includes('medic') || lower.includes('hospital')) {
    return 'Saúde & Farmacêutica';
  }

  if (lower.includes('locação') || lower.includes('locacao') || lower.includes('veículo') || lower.includes('veiculo')) {
    return 'Transporte, Logística & Locação';
  }

  for (const [canonical, keywords] of SECTOR_RULES) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        return canonical;
      }
    }
  }

  return 'Holdings & Outros Serviços';
}
