import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  Building2,
  ShieldCheck,
  ShieldAlert,
  Activity,
  Search,
  Filter,
  Info,
  Calendar,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Percent,
  DollarSign,
  AlertTriangle,
  Award,
  BookOpen,
  X,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Scale,
  Clock,
  Briefcase,
  Newspaper,
  Users,
  SlidersHorizontal,
  CheckSquare,
  Square
} from 'lucide-react';

/* ==========================================================================
   TIPAGEM DE DADOS
   ========================================================================== */

interface KpisResumo {
  receita_liquida: number | null;
  ebitda: number | null;
  divida_bruta: number | null;
  divida_liquida: number | null;
  alavancagem_dl_ebitda: number | null;
  cobertura_juros_ebitda: number | null;
  liquidez_corrente: number | null;
  margem_ebitda: number | null;
  roe: number | null;
  altman_z_score: number | null;
  altman_zona: string | null;
  rating_atual?: string | null;
  score_geral?: number;
  classificacao?: string;
  badge_cor?: string;
}

interface NewsItem {
  title: string;
  source: string;
  link: string;
  pubDate: string;
}

interface PeriodoContabil {
  periodo_rotulo: string;
  ano: number;
  trimestre: number;
  tipo_periodo: string;
  origem_dado: string;
  dt_refer: string;
  ativo_total: number | null;
  ativo_circulante: number | null;
  passivo_total: number | null;
  passivo_circulante: number | null;
  patrimonio_liquido: number | null;
  caixa_equivalentes: number | null;
  disponibilidades: number | null;
  divida_cp: number | null;
  divida_lp: number | null;
  divida_bruta: number | null;
  divida_liquida: number | null;
  capital_de_giro: number | null;
  receita_liquida: number | null;
  lucro_bruto: number | null;
  ebit: number | null;
  depreciacao_amortizacao: number | null;
  ebitda: number | null;
  despesas_financeiras: number | null;
  lucro_liquido: number | null;
  margem_bruta: number | null;
  margem_ebitda: number | null;
  margem_ebit: number | null;
  margem_liquida: number | null;
  alavancagem_dl_ebitda: number | null;
  alavancagem_db_ebitda: number | null;
  cobertura_juros_ebitda: number | null;
  liquidez_corrente: number | null;
  liquidez_seca: number | null;
  roe: number | null;
  roa: number | null;
  receita_yoy: number | null;
  ebitda_yoy: number | null;
  lucro_liquido_yoy: number | null;
  altman_z_score: number | null;
  altman_zona: string | null;
}

interface TituloAtivo {
  ticker: string;
  tipo: string;
  devedor: string;
  taxa_emissao?: string;
  dt_vencimento?: string;
  volume?: number;
  status_ativo?: string;
  taxa_indicativa?: string;
  pu?: string;
  duration?: string;
}

interface RatingHistorico {
  ticker: string;
  agencia: string;
  divulgacao: string;
  rating: string;
  periodicidade?: string;
  rating_normalizado?: string;
  rating_score?: number;
}

interface RatingEvolucaoPonto {
  data: string;
  data_formatada: string;
  rating: string;
  score: number;
  agencias: string;
  tickers: string[];
  qtd_emissoes: number;
}

interface MaturityYear {
  ano: number;
  volume: number;
}

interface DevedorItem {
  cnpj: string;
  cnpj_formatado: string;
  razao_social: string;
  nome_fantasia?: string;
  cd_cvm?: string;
  setor: string;
  situacao_cvm?: string;
  site_ri?: string;
  ultimo_periodo: string;
  rating_atual?: string | null;
  rating_score?: number | null;
  rating_agencia?: string | null;
  kpis_resumo: KpisResumo;
  historico_trimestral?: PeriodoContabil[];
  titulos_ativos?: TituloAtivo[];
  total_titulos?: number;
  rating_evolucao?: RatingEvolucaoPonto[];
  ratings_historico?: RatingHistorico[];
  maturity_wall?: MaturityYear[];
}

/* ==========================================================================
   DOCUMENTAÇÃO INSTITUCIONAL & METODOLOGIAS (MODAIS DE AJUDA)
   ========================================================================== */

interface DocInfo {
  titulo: string;
  sigla: string;
  fonte: string;
  formula: string;
  conceito: string;
  interpretacao: string;
  benchmarks: { faixa: string; classificacao: string; cor: string }[];
}

const DOCUMENTACAO_INDICADORES: Record<string, DocInfo> = {
  altman_z: {
    titulo: "Altman Z''-Score para Mercados Emergentes",
    sigla: "Z''-Score",
    fonte: "Demonstrações Financeiras CVM (DFP / ITR - Balanço Patrimonial e DRE)",
    formula: "Z'' = 6,56·X₁ + 3,26·X₂ + 6,72·X₃ + 1,05·X₄",
    conceito:
      "Modelo econométrico discriminante multivariado desenvolvido pelo Prof. Edward Altman (NYU Stern), calibrado especificamente para mercados emergentes e companhias de capital intensivo. O modelo pondera: X₁ = Capital Circulante Líquido / Ativo Total; X₂ = Lucros Retidos / Ativo Total; X₃ = EBIT / Ativo Total; X₄ = Patrimônio Líquido / Passivo Total.",
    interpretacao:
      "Avalia a robustez do balanço patrimonial e a solvência estrutural frente ao risco de estresse financeiro. Valores acima de 2,60 posicionam o emissor na Zona Segura.",
    benchmarks: [
      { faixa: "Z'' > 2,60", classificacao: "Zona Segura (Solvência Robusta / Baixo Risco de Estresse)", cor: "text-emerald-700 bg-emerald-50 border-emerald-200" },
      { faixa: "1,10 ≤ Z'' ≤ 2,60", classificacao: "Zona Cinzenta (Atenção Operacional / Monitoramento)", cor: "text-amber-700 bg-amber-50 border-amber-200" },
      { faixa: "Z'' < 1,10", classificacao: "Zona de Perigo (Estresse Financeiro Severo)", cor: "text-rose-700 bg-rose-50 border-rose-200" }
    ]
  },
  alavancagem: {
    titulo: "Alavancagem Financeira: Dívida Líquida / EBITDA",
    sigla: "DL / EBITDA",
    fonte: "Demonstrações Contábeis CVM (Passivo Circulante + Não Circulante - Disponibilidades / EBITDA 12M)",
    formula: "DL / EBITDA = (Dívida Bruta CP+LP - Caixa e Equivalentes) / EBITDA 12 Meses",
    conceito:
      "Métrica soberana para aferição de covenants financeiros em escrituras de debêntures e empréstimos sindicados. Indica quantos anos de geração operacional de caixa (EBITDA) seriam necessários para quitar o endividamento líquido.",
    interpretacao:
      "Níveis abaixo de 2,5x são considerados conservadores. Índices superiores a 3,5x tipicamente ativam cláusulas de vencimento antecipado ou restrições de distribuição de proventos em escrituras institucionais.",
    benchmarks: [
      { faixa: "DL ≤ 0 ou DL/EBITDA ≤ 2,0x", classificacao: "Alavancagem Baixa / Posição Confortável", cor: "text-emerald-700 bg-emerald-50 border-emerald-200" },
      { faixa: "2,0x < DL/EBITDA ≤ 3,5x", classificacao: "Alavancagem Moderada (Padrão de Mercado)", cor: "text-amber-700 bg-amber-50 border-amber-200" },
      { faixa: "DL/EBITDA > 3,5x", classificacao: "Alavancagem Elevada / Alerta de Covenants", cor: "text-rose-700 bg-rose-50 border-rose-200" }
    ]
  },
  cobertura_juros: {
    titulo: "Índice de Cobertura de Juros (ICR - Interest Coverage Ratio)",
    sigla: "ICR",
    fonte: "DRE CVM (EBITDA Operacional / Despesas Financeiras Brutas)",
    formula: "ICR = EBITDA / |Despesas Financeiras Brutas|",
    conceito:
      "Avalia a capacidade da geração de caixa operacional em suportar o serviço dos juros devidos a debenturistas e instituições financeiras no exercício.",
    interpretacao:
      "ICR inferior a 1,0x sinaliza que a operação não gera recursos suficientes para pagar os juros da dívida sem consumir caixa pré-existente ou contrair novos passivos.",
    benchmarks: [
      { faixa: "ICR ≥ 3,0x", classificacao: "Cobertura Confortável do Serviço da Dívida", cor: "text-emerald-700 bg-emerald-50 border-emerald-200" },
      { faixa: "1,5x ≤ ICR < 3,0x", classificacao: "Cobertura Adequada", cor: "text-blue-700 bg-blue-50 border-blue-200" },
      { faixa: "1,0x ≤ ICR < 1,5x", classificacao: "Margem Estreita / Atenção aos Custos Financeiros", cor: "text-amber-700 bg-amber-50 border-amber-200" },
      { faixa: "ICR < 1,0x", classificacao: "Déficit Operacional frente aos Juros", cor: "text-rose-700 bg-rose-50 border-rose-200" }
    ]
  },
  liquidez_corrente: {
    titulo: "Liquidez Corrente & Autonomia de Caixa de Curto Prazo",
    sigla: "LC & Caixa / Dívida CP",
    fonte: "Balanço Patrimonial CVM (Ativo Circulante vs Passivo Circulante | Caixa vs Empréstimos CP)",
    formula: "LC = Ativo Circulante / Passivo Circulante  |  Autonomia = Disponibilidades / Dívida de Curto Prazo",
    conceito:
      "Mede a solvência para os próximos 12 meses. A razão Caixa / Dívida CP indica a capacidade do emissor de honrar os vencimentos de principal e juros do ano sem depender de novas captações bancárias ou de mercado.",
    interpretacao:
      "Uma cobertura de dívida de curto prazo acima de 1,0x garante autonomia financeira frente a fechamentos transitórios do mercado de capitais.",
    benchmarks: [
      { faixa: "LC ≥ 1,5x e Caixa/Dív CP ≥ 1,0x", classificacao: "Autonomia de Liquidez Confortável", cor: "text-emerald-700 bg-emerald-50 border-emerald-200" },
      { faixa: "1,0x ≤ LC < 1,5x", classificacao: "Liquidez Equilibrada / Rolagem Habitual", cor: "text-amber-700 bg-amber-50 border-amber-200" },
      { faixa: "LC < 1,0x ou Caixa/Dív CP < 0,5x", classificacao: "Dependência de Rolagem de Curto Prazo", cor: "text-rose-700 bg-rose-50 border-rose-200" }
    ]
  },
  rating_devedor: {
    titulo: "Rating Consolidado do Devedor (Abordagem Prudencial)",
    sigla: "RATING DEVEDOR",
    fonte: "Agências Oficiais (Moody's Local, Fitch Ratings, S&P Global, Liberum) via ANBIMA & B3",
    formula: "Min(Rating das Emissões Ativas na Data t)",
    conceito:
      "Em crédito corporativo, emissores frequentemente possuem múltiplas séries com estruturas de garantia e subordinações distintas. Pela regra de conservadorismo prudencial, o rating consolidado adotado é o menor rating vigente entre os papéis ativos na data.",
    interpretacao:
      "Emissões classificadas de AAA a BBB- enquadram-se como Grau de Investimento (Investment Grade). Notas de BB+ a D representam Grau Especulativo (High Yield / Distressed).",
    benchmarks: [
      { faixa: "AAA a AA-", classificacao: "Grau de Investimento Prime / Alto: Risco de crédito mínimo", cor: "text-emerald-700 bg-emerald-50 border-emerald-200" },
      { faixa: "A+ a BBB-", classificacao: "Grau de Investimento Médio: Solvência satisfatória", cor: "text-blue-700 bg-blue-50 border-blue-200" },
      { faixa: "BB+ a B-", classificacao: "Grau Especulativo (High Yield): Risco moderado a elevado", cor: "text-amber-700 bg-amber-50 border-amber-200" },
      { faixa: "CCC a D", classificacao: "Alto Risco / Default: Risco iminente de reestruturação", cor: "text-rose-700 bg-rose-50 border-rose-200" }
    ]
  }
};

/* ==========================================================================
   COMPONENTES AUXILIARES
   ========================================================================== */

const InfoButton: React.FC<{ docKey: string; onOpen: (key: string) => void }> = ({ docKey, onOpen }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onOpen(docKey);
    }}
    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all ml-1.5 focus:outline-none cursor-pointer"
    title="Ver metodologia e fundamentação técnica"
  >
    <Info size={14} />
  </button>
);

/* ==========================================================================
   COMPONENTE PRINCIPAL: RAIO-X DO DEVEDOR
   ========================================================================== */

const DebtorRadar: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingFull, setLoadingFull] = useState<boolean>(false);
  const [devedoresResumo, setDevedoresResumo] = useState<DevedorItem[]>([]);
  const [setores, setSetores] = useState<string[]>([]);
  const [selectedSetor, setSelectedSetor] = useState<string>("TODOS");
  const [searchTerm, setSearchTerm] = useState<string>(searchParams.get("search") || searchParams.get("q") || "");
  
  // Devedor selecionado
  const [selectedCnpj, setSelectedCnpj] = useState<string>(searchParams.get("cnpj") || "");
  const [currentDevedor, setCurrentDevedor] = useState<DevedorItem | null>(null);

  // Pares setoriais selecionados para o benchmark de mercado
  const [selectedPeersCnpjs, setSelectedPeersCnpjs] = useState<string[]>([]);
  const [showPeersModal, setShowPeersModal] = useState<boolean>(false);

  // Medianas históricas setoriais móveis no tempo (para todos os trimestres)
  const [setoresHistoricoMediana, setSetoresHistoricoMediana] = useState<Record<string, Record<string, any>>>({});

  // Notícias Recentes (Google News RSS)
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState<boolean>(false);
  const newsCache = useRef<Record<string, NewsItem[]>>({});

  // Cache em memória para os arquivos individuais de 30KB
  const fullCache = useRef<Record<string, DevedorItem>>({});

  // Abas de gráficos
  const [activeTab, setActiveTab] = useState<"alavancagem" | "rentabilidade" | "cobertura" | "liquidez" | "solvencia">(
    "alavancagem"
  );

  // Modal de documentação
  const [docModalKey, setDocModalKey] = useState<string | null>(null);

  // Função central de seleção de devedor com atualização instantânea (0ms)
  const handleSelectDevedor = (cnpj: string) => {
    const clean = String(cnpj).replace(/\D/g, "");
    setSelectedCnpj(clean);
    try {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set("cnpj", clean);
      window.history.replaceState({}, "", newUrl.toString());
    } catch {}
    const foundResumo = devedoresResumo.find((d) => d.cnpj === clean || d.cnpj === cnpj);
    if (foundResumo) {
      if (fullCache.current[clean]) {
        setCurrentDevedor(fullCache.current[clean]);
      } else {
        // Exibir imediatamente com KPIs e cabeçalhos enquanto o arquivo detalhado baixa
        setCurrentDevedor((prev) => ({
          ...foundResumo,
          historico_trimestral: (prev?.cnpj === clean || prev?.cnpj === cnpj) ? prev.historico_trimestral : undefined,
          titulos_ativos: (prev?.cnpj === clean || prev?.cnpj === cnpj) ? prev.titulos_ativos : undefined,
          rating_evolucao: (prev?.cnpj === clean || prev?.cnpj === cnpj) ? prev.rating_evolucao : undefined,
          ratings_historico: (prev?.cnpj === clean || prev?.cnpj === cnpj) ? prev.ratings_historico : undefined,
          maturity_wall: (prev?.cnpj === clean || prev?.cnpj === cnpj) ? prev.maturity_wall : undefined,
        }));
      }
    }
  };

  // 1. Carregamento inicial do índice de devedores
  useEffect(() => {
    const fetchResumo = async () => {
      setLoading(true);
      try {
        const resp = await fetch("/data/devedores_resumo.json");
        if (resp.ok) {
          const rawText = await resp.text();
          const safeText = rawText.replace(/:\s*NaN\b/g, ": null").replace(/:\s*Infinity\b/g, ": null");
          const data = JSON.parse(safeText);
          const devs: DevedorItem[] = data.devedores || [];
          setDevedoresResumo(devs);
          setSetores(data.setores_disponiveis || []);

          const urlCnpj = searchParams.get("cnpj");
          const urlSearch = searchParams.get("search") || searchParams.get("q");

          let defaultDev: DevedorItem | undefined = undefined;
          if (urlCnpj) {
            const cleanUrl = urlCnpj.replace(/\D/g, "");
            defaultDev = devs.find(
              (d: DevedorItem) => d.cnpj === cleanUrl || d.cnpj === urlCnpj || d.cnpj_formatado === urlCnpj
            );
          } else if (urlSearch) {
            const sLower = urlSearch.toLowerCase();
            defaultDev = devs.find(
              (d: DevedorItem) =>
                d.razao_social.toLowerCase().includes(sLower) ||
                (d.nome_fantasia && d.nome_fantasia.toLowerCase().includes(sLower))
            );
          }

          if (!defaultDev) {
            defaultDev =
              devs.find((d: DevedorItem) => d.razao_social.includes("PETROBRAS")) ||
              devs.find((d: DevedorItem) => d.razao_social.includes("VALE")) ||
              devs[0];
          }

          if (defaultDev) {
            setSelectedCnpj(defaultDev.cnpj);
            setCurrentDevedor(defaultDev);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar resumo de devedores:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchResumo();
  }, [searchParams]);

  // Carregamento das medianas históricas trimestrais por setor
  useEffect(() => {
    const fetchSetoresMedianas = async () => {
      try {
        const resp = await fetch("/data/setores_historico_mediana.json");
        if (resp.ok) {
          const rawText = await resp.text();
          const safeText = rawText.replace(/:\s*NaN\b/g, ": null").replace(/:\s*Infinity\b/g, ": null");
          const data = JSON.parse(safeText);
          setSetoresHistoricoMediana(data || {});
        }
      } catch (err) {
        console.warn("Não foi possível carregar medianas históricas setoriais:", err);
      }
    };
    fetchSetoresMedianas();
  }, []);

  // 2. Carregamento completo sob demanda (série histórica, ratings, títulos)
  useEffect(() => {
    if (!selectedCnpj) return;
    const cleanCnpj = String(selectedCnpj).replace(/\D/g, "");
    if (!cleanCnpj) return;

    if (fullCache.current[cleanCnpj]) {
      setCurrentDevedor(fullCache.current[cleanCnpj]);
      return;
    }

    let isMounted = true;
    const fetchFullData = async () => {
      setLoadingFull(true);
      try {
        const respIndiv = await fetch(`/data/devedores/${cleanCnpj}.json`);
        if (respIndiv.ok) {
          const contentType = respIndiv.headers.get("content-type");
          if (!contentType || !contentType.includes("text/html")) {
            const rawText = await respIndiv.text();
            const safeText = rawText.replace(/:\s*NaN\b/g, ": null").replace(/:\s*Infinity\b/g, ": null");
            const indivData = JSON.parse(safeText);
            if (isMounted && indivData && (indivData.cnpj === cleanCnpj || indivData.cnpj === selectedCnpj)) {
              fullCache.current[cleanCnpj] = indivData;
              setCurrentDevedor(indivData);
              setLoadingFull(false);
              return;
            }
          }
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        try {
          const resp = await fetch("/data/devedores_raiox.json", { signal: controller.signal });
          clearTimeout(timeoutId);
          if (resp.ok) {
            const rawText = await resp.text();
            const safeText = rawText.replace(/:\s*NaN\b/g, ": null").replace(/:\s*Infinity\b/g, ": null");
            const data = JSON.parse(safeText);
            const found = data.devedores?.find(
              (d: DevedorItem) => d.cnpj === cleanCnpj || d.cnpj === selectedCnpj
            );
            if (isMounted && found) {
              fullCache.current[cleanCnpj] = found;
              setCurrentDevedor(found);
            }
          }
        } catch {}
      } catch (err) {
        console.error("Erro ao carregar dados detalhados do devedor:", err);
      } finally {
        if (isMounted) setLoadingFull(false);
      }
    };
    fetchFullData();
    return () => { isMounted = false; };
  }, [selectedCnpj]);

  // Empresas do mesmo setor para benchmark
  const empresasSetor = useMemo(() => {
    if (!currentDevedor?.setor) return [];
    return devedoresResumo.filter((d) => d.setor === currentDevedor.setor);
  }, [devedoresResumo, currentDevedor?.setor]);

  // Sincronizar pares selecionados com todas as empresas do setor ao trocar de devedor/setor
  useEffect(() => {
    if (empresasSetor.length > 0) {
      setSelectedPeersCnpjs(empresasSetor.map((e) => e.cnpj));
    }
  }, [currentDevedor?.setor, empresasSetor.length]);

  // Cálculo da Mediana dos Pares Setoriais Selecionados
  const medianasSetor = useMemo(() => {
    if (empresasSetor.length === 0) return null;
    const peers = empresasSetor.filter((e) => selectedPeersCnpjs.includes(e.cnpj));
    if (peers.length === 0) return null;

    const calcMedian = (values: (number | null | undefined)[]): number | null => {
      const valid = values
        .filter((v): v is number => typeof v === "number" && !isNaN(v) && isFinite(v))
        .sort((a, b) => a - b);
      if (valid.length === 0) return null;
      const mid = Math.floor(valid.length / 2);
      return valid.length % 2 !== 0 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
    };

    return {
      totalPares: peers.length,
      totalSetor: empresasSetor.length,
      alavancagem: calcMedian(peers.map((p) => p.kpis_resumo?.alavancagem_dl_ebitda)),
      margemEbitda: calcMedian(peers.map((p) => p.kpis_resumo?.margem_ebitda)),
      coberturaJuros: calcMedian(peers.map((p) => p.kpis_resumo?.cobertura_juros_ebitda)),
      liquidezCorrente: calcMedian(peers.map((p) => p.kpis_resumo?.liquidez_corrente)),
      altmanZ: calcMedian(peers.map((p) => p.kpis_resumo?.altman_z_score)),
    };
  }, [empresasSetor, selectedPeersCnpjs]);

  // Termo de busca de notícias limpo para a empresa atual
  const companyNewsQuery = useMemo(() => {
    if (!currentDevedor) return "";
    if (currentDevedor.nome_fantasia && currentDevedor.nome_fantasia.trim().length >= 3) {
      return currentDevedor.nome_fantasia.trim();
    }
    let name = currentDevedor.razao_social || "";
    name = name.replace(/\s*-\s*EM RECUPERA[CÇ][AÃ]O JUDICIAL.*/i, "");
    name = name.replace(/\bS\.?A\.?\b/gi, "").replace(/\bLTDA\.?\b/gi, "").trim();
    return name || currentDevedor.razao_social;
  }, [currentDevedor]);

  const googleNewsUrl = useMemo(() => {
    if (!companyNewsQuery) return "https://news.google.com";
    return `https://news.google.com/search?q=${encodeURIComponent(`"${companyNewsQuery}" when:7d`)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  }, [companyNewsQuery]);

  // Carregamento de notícias recentes (Google News RSS)
  useEffect(() => {
    if (!companyNewsQuery) {
      setNewsList([]);
      return;
    }

    const qKey = companyNewsQuery.toLowerCase();
    if (newsCache.current[qKey]) {
      setNewsList(newsCache.current[qKey]);
      return;
    }

    let isMounted = true;
    setNewsLoading(true);

    const fetchNews = async () => {
      try {
        let resp = await fetch(`/.netlify/functions/news?q=${encodeURIComponent(companyNewsQuery)}`);
        if (!resp.ok) {
          resp = await fetch(`/api/news?q=${encodeURIComponent(companyNewsQuery)}`);
        }
        if (resp.ok) {
          const contentType = resp.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await resp.json();
            if (isMounted && data.items) {
              newsCache.current[qKey] = data.items;
              setNewsList(data.items);
              return;
            }
          }
        }
      } catch (err) {
        console.warn("Não foi possível carregar o feed RSS de notícias:", err);
      } finally {
        if (isMounted) setNewsLoading(false);
      }
    };

    fetchNews();
    return () => {
      isMounted = false;
    };
  }, [companyNewsQuery]);

  const formatNewsDate = (dateStr: string): string => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const now = new Date();
      const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
      if (diffHours < 1) return "Há menos de 1h";
      if (diffHours < 24) return `Há ${diffHours}h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return "Ontem";
      if (diffDays < 7) return `Há ${diffDays} dias`;
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    } catch {
      return dateStr;
    }
  };

  // Lista filtrada para busca e seleção
  const filteredDevedores = useMemo(() => {
    return devedoresResumo.filter((d) => {
      const matchSetor = selectedSetor === "TODOS" || d.setor === selectedSetor;
      const term = searchTerm.toLowerCase().trim();
      const matchTerm =
        !term ||
        d.razao_social.toLowerCase().includes(term) ||
        (d.nome_fantasia && d.nome_fantasia.toLowerCase().includes(term)) ||
        d.cnpj.includes(term) ||
        d.cnpj_formatado.includes(term);
      return matchSetor && matchTerm;
    });
  }, [devedoresResumo, selectedSetor, searchTerm]);

  // Formatações auxiliares
  const formatBRL = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return "N/D";
    const absVal = Math.abs(val);
    const sign = val < 0 ? "-" : "";
    if (absVal >= 1e9) return `${sign}R$ ${(absVal / 1e9).toFixed(2)} bi`;
    if (absVal >= 1e6) return `${sign}R$ ${(absVal / 1e6).toFixed(1)} mi`;
    if (absVal >= 1e3) return `${sign}R$ ${(absVal / 1e3).toFixed(0)} mil`;
    return `${sign}R$ ${absVal.toFixed(0)}`;
  };

  const formatPct = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return "N/D";
    return `${val.toFixed(2)}%`;
  };

  const formatMultiplo = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val)) return "N/D";
    return `${val.toFixed(2)}x`;
  };

  // Séries trimestrais ordenadas e enriquecidas com a Mediana Móvel do Setor
  const dadosGraficos = useMemo(() => {
    if (!currentDevedor?.historico_trimestral || currentDevedor.historico_trimestral.length === 0) {
      return [];
    }
    const trimestrais = currentDevedor.historico_trimestral.filter(
      (h) => h.trimestre >= 1 && h.trimestre <= 4
    );
    const series = trimestrais.length > 0 ? trimestrais : currentDevedor.historico_trimestral;
    const sorted = [...series].sort((a, b) => {
      if (a.ano !== b.ano) return a.ano - b.ano;
      return (a.trimestre || 0) - (b.trimestre || 0);
    });

    const setorKey = currentDevedor.setor;
    const historicoSetor = setorKey && setoresHistoricoMediana ? setoresHistoricoMediana[setorKey] : null;

    return sorted.map((p) => {
      const perSetor = historicoSetor ? historicoSetor[p.periodo_rotulo] : null;
      return {
        ...p,
        setor_alavancagem: perSetor?.alavancagem ?? null,
        setor_margem_ebitda: perSetor?.margem_ebitda ?? null,
        setor_cobertura_juros: perSetor?.cobertura_juros ?? null,
        setor_liquidez_corrente: perSetor?.liquidez_corrente ?? null,
        setor_altman_z: perSetor?.altman_z ?? null,
        setor_amostra_pares: perSetor?.amostra_pares ?? null,
      };
    });
  }, [currentDevedor, setoresHistoricoMediana]);

  // Dados do último período divulgado para análise de estrutura de capital
  const ultimoFechamento = useMemo(() => {
    if (dadosGraficos && dadosGraficos.length > 0) {
      return dadosGraficos[dadosGraficos.length - 1];
    }
    return null;
  }, [dadosGraficos]);

  // Estrutura de Dívida e Autonomia de Caixa (Dados Contábeis Objetivos)
  const perfilDividaLiquidez = useMemo(() => {
    const dividaBruta = ultimoFechamento?.divida_bruta ?? currentDevedor?.kpis_resumo?.divida_bruta ?? 0;
    const dividaCp = ultimoFechamento?.divida_cp ?? 0;
    const dividaLp = ultimoFechamento?.divida_lp ?? (dividaBruta > dividaCp ? dividaBruta - dividaCp : 0);
    const caixa =
      ultimoFechamento?.caixa_equivalentes ??
      ultimoFechamento?.disponibilidades ??
      (dividaBruta - (currentDevedor?.kpis_resumo?.divida_liquida ?? 0));

    const totalDivida = dividaCp + dividaLp > 0 ? dividaCp + dividaLp : dividaBruta;
    const pctCp = totalDivida > 0 ? (dividaCp / totalDivida) * 100 : 0;
    const pctLp = totalDivida > 0 ? (dividaLp / totalDivida) * 100 : 100;
    const razaoCaixaCp = dividaCp > 0 && caixa !== null && caixa !== undefined ? caixa / dividaCp : null;

    const dividaLiquida = currentDevedor?.kpis_resumo?.divida_liquida ?? (totalDivida - (caixa || 0));
    const ativoCirc = ultimoFechamento?.ativo_circulante ?? null;
    const passivoCirc = ultimoFechamento?.passivo_circulante ?? null;
    const ccl = ativoCirc !== null && passivoCirc !== null ? ativoCirc - passivoCirc : null;
    const liquidezCorrente = ultimoFechamento?.liquidez_corrente ?? currentDevedor?.kpis_resumo?.liquidez_corrente ?? null;
    const ebitda = ultimoFechamento?.ebitda ?? currentDevedor?.kpis_resumo?.ebitda ?? null;
    const despesasFinanceiras = ultimoFechamento?.despesas_financeiras ?? null;
    const coberturaJuros = ultimoFechamento?.cobertura_juros_ebitda ?? currentDevedor?.kpis_resumo?.cobertura_juros_ebitda ?? null;

    return {
      dividaBruta: totalDivida,
      dividaLiquida,
      dividaCp,
      dividaLp,
      pctCp,
      pctLp,
      caixa,
      razaoCaixaCp,
      ccl,
      liquidezCorrente,
      ebitda,
      despesasFinanceiras,
      coberturaJuros,
    };
  }, [ultimoFechamento, currentDevedor]);

  // Curva de evolução temporal do rating
  const ratingCurveData = useMemo(() => {
    if (currentDevedor?.rating_evolucao && currentDevedor.rating_evolucao.length > 0) {
      if (currentDevedor.rating_evolucao.length === 1) {
        const p = currentDevedor.rating_evolucao[0];
        return [
          { ...p, data_formatada: "Corte Anterior" },
          { ...p, data_formatada: p.data_formatada || "Corte Atual" },
          { ...p, data_formatada: "Vigente (2026)" },
        ];
      }
      return currentDevedor.rating_evolucao;
    }
    if (currentDevedor?.rating_atual) {
      const scoreMap: Record<string, number> = {
        AAA: 20, "AA+": 19, AA: 18, "AA-": 17,
        "A+": 16, A: 15, "A-": 14,
        "BBB+": 13, BBB: 12, "BBB-": 11,
        "BB+": 10, BB: 9, "BB-": 8,
        "B+": 7, B: 6, "B-": 5,
        CCC: 4, CC: 3, C: 2, D: 0
      };
      const cleanR = currentDevedor.rating_atual.replace(/[^A-Za-z+-]/g, "");
      const score = scoreMap[cleanR] || 16;
      return [
        {
          data: "2024-01-01",
          data_formatada: "2024",
          rating: currentDevedor.rating_atual,
          score,
          agencias: "Consolidado Conservador",
          tickers: currentDevedor.titulos_ativos?.map((t) => t.ticker) || [],
          qtd_emissoes: currentDevedor.titulos_ativos?.length || 1,
        },
        {
          data: "2026-06-30",
          data_formatada: "Vigente (2026)",
          rating: currentDevedor.rating_atual,
          score,
          agencias: "Consolidado Conservador",
          tickers: currentDevedor.titulos_ativos?.map((t) => t.ticker) || [],
          qtd_emissoes: currentDevedor.titulos_ativos?.length || 1,
        }
      ];
    }
    return [];
  }, [currentDevedor]);

  // Determinar status do Altman Z''-Score
  const altmanZVal = currentDevedor?.kpis_resumo?.altman_z_score;
  const altmanInfo = useMemo(() => {
    if (altmanZVal === null || altmanZVal === undefined || isNaN(altmanZVal)) {
      return {
        label: "Em Avaliação CVM",
        corTexto: "text-slate-400",
        corBadge: "bg-slate-800 text-slate-300 border-slate-700",
        descricao: "Demonstrações insuficientes para apuração do modelo",
      };
    }
    if (altmanZVal > 2.60) {
      return {
        label: "Zona Segura",
        corTexto: "text-emerald-400",
        corBadge: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
        descricao: "Solvência robusta • Risco de estresse improvável",
      };
    }
    if (altmanZVal >= 1.10) {
      return {
        label: "Zona Cinzenta",
        corTexto: "text-amber-400",
        corBadge: "bg-amber-500/20 text-amber-300 border-amber-400/30",
        descricao: "Alerta moderado • Acompanhamento operacional",
      };
    }
    return {
      label: "Zona de Perigo",
      corTexto: "text-rose-400",
      corBadge: "bg-rose-500/20 text-rose-300 border-rose-400/30",
      descricao: "Estresse financeiro severo • Risco de crédito crítico",
    };
  }, [altmanZVal]);

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 pb-20">
      {/* ─── HERO HEADER INSTITUCIONAL ───────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 text-white pt-10 pb-12 border-b border-slate-800">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <span className="px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={14} className="text-blue-400" />
                  Análise Fundamentalista CVM
                </span>
                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-lg text-xs font-bold tracking-wider">
                  Solvência &amp; Perfil da Dívida
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                Raio-X do Devedor <span className="text-blue-400 font-light">&amp; Risco de Crédito</span>
              </h1>
              <p className="text-slate-300 text-sm max-w-3xl mt-2 leading-relaxed font-normal">
                Diagnóstico de balanço e solvência dos maiores emissores de dívida corporativa do Brasil. Demonstrações
                contábeis padronizadas (DFP e ITR), cronograma de vencimentos, estrutura de liquidez, indicadores de
                covenants e modelo econométrico Altman Z&apos;&apos;-Score para mercados emergentes.
              </p>
            </div>

            {/* Micro métricas */}
            <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 self-start md:self-auto">
              <div className="text-center px-3 border-r border-white/10">
                <div className="text-2xl font-black text-blue-400">{devedoresResumo.length || "800+"}</div>
                <div className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">Devedores CVM</div>
              </div>
              <div className="text-center px-3 border-r border-white/10">
                <div className="text-2xl font-black text-emerald-400">Altman Z&apos;&apos;</div>
                <div className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">Modelo de Solvência</div>
              </div>
              <div className="text-center px-3">
                <div className="text-2xl font-black text-amber-400">100%</div>
                <div className="text-2xs uppercase tracking-wider text-slate-400 font-semibold">Padrão CVM / CPC</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl -mt-6">
        {/* ─── BARRA DE BUSCA CENTRAL & FILTROS ─────────────────────────────────── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 md:p-8 mb-8 space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-1.5">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-2">
              <Search className="text-blue-600" size={24} />
              Buscar Devedor ou Emissor de Crédito
            </h2>
            <p className="text-xs md:text-sm text-slate-500 font-normal">
              Pesquise entre as <strong>{devedoresResumo.length || "800+"} companhias abertas</strong> que divulgam balanços na CVM e emitem Debêntures, CRIs e CRAs.
            </p>
          </div>

          {/* Campo de Busca Grande e Central */}
          <div className="max-w-3xl mx-auto relative">
            <div className="relative flex items-center">
              <Search className="absolute left-4 text-blue-500 pointer-events-none" size={22} />
              <input
                type="text"
                placeholder="Digite o nome da empresa ou CNPJ (ex: Klabin, Petrobras, Vale, 89.637...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-12 py-3.5 sm:py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm sm:text-base font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 transition-all shadow-inner"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-4 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Dropdown de sugestões instantâneas quando há termo digitado */}
            {searchTerm.trim().length > 1 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 max-h-80 overflow-y-auto z-50 divide-y divide-slate-100">
                {filteredDevedores.slice(0, 10).map((d) => (
                  <button
                    key={d.cnpj}
                    type="button"
                    onClick={() => {
                      handleSelectDevedor(d.cnpj);
                      setSearchTerm("");
                    }}
                    className="w-full text-left p-3.5 hover:bg-blue-50/70 transition flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                        <Building2 size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                          {d.razao_social}
                        </div>
                        <div className="text-xs text-slate-400 font-mono">
                          CNPJ: {d.cnpj_formatado} {d.setor ? `• ${d.setor}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {d.kpis_resumo?.classificacao || "CVM"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filtro por Setor Centrado */}
          <div className="space-y-2">
            <div className="text-center text-2xs font-bold text-slate-400 uppercase tracking-wider">
              Filtrar por Setor de Atuação
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto">
              <button
                type="button"
                onClick={() => setSelectedSetor("TODOS")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedSetor === "TODOS"
                    ? "bg-slate-900 text-white shadow-xs scale-105"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Todos ({devedoresResumo.length})
              </button>
              {setores.slice(0, 8).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSetor(s)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    selectedSetor === s
                      ? "bg-blue-600 text-white shadow-xs scale-105"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Devedores em Destaque / Filtrados */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2.5">
              <span className="font-bold text-slate-700">Devedores Disponíveis ({filteredDevedores.length})</span>
              <span className="text-2xs text-slate-400 hidden sm:inline">Clique no emissor para abrir o Raio-X completo</span>
            </div>
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
              {filteredDevedores.slice(0, 36).map((d) => {
                const isSelected = selectedCnpj === d.cnpj;
                return (
                  <button
                    key={d.cnpj}
                    type="button"
                    onClick={() => handleSelectDevedor(d.cnpj)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white shadow-md font-bold ring-2 ring-blue-400/40 scale-105"
                        : "bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/50"
                    }`}
                  >
                    <Building2 size={13} className={isSelected ? "text-white" : "text-blue-500"} />
                    <span className="truncate max-w-[200px]">{d.razao_social}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isSelected ? "bg-blue-700 text-blue-100" : "bg-slate-100 text-slate-600"
                    }`}>
                      {d.kpis_resumo?.classificacao ? d.kpis_resumo.classificacao.split(" ")[0] : "CVM"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── PAINEL PRINCIPAL DO DEVEDOR SELECIONADO ──────────────────────── */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-4 my-8">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div>
              <h3 className="text-base font-bold text-slate-800">Carregando Raio-X dos Devedores...</h3>
              <p className="text-xs text-slate-500 mt-1">Carregando cadastro, balanços CVM e ratings oficiais</p>
            </div>
          </div>
        ) : currentDevedor ? (
          <div className="space-y-8">
            {/* Header da Empresa & Altman Z''-Score */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5 mb-2">
                    <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold tracking-wider uppercase">
                      {currentDevedor.setor}
                    </span>
                    <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-mono font-semibold">
                      CNPJ: {currentDevedor.cnpj_formatado}
                    </span>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold">
                      Último Divulgado: {currentDevedor.ultimo_periodo}
                    </span>
                    {currentDevedor.rating_atual && (
                      <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-black flex items-center gap-1.5 shadow-2xs">
                        <Award size={13} className="text-amber-600" />
                        Rating Oficial: {currentDevedor.rating_atual}
                        {currentDevedor.rating_agencia ? ` (${currentDevedor.rating_agencia.split(',')[0].trim()})` : ''}
                      </span>
                    )}
                    {currentDevedor.site_ri && (
                      <a
                        href={currentDevedor.site_ri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-bold"
                      >
                        Site RI <ExternalLink size={12} />
                      </a>
                    )}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {currentDevedor.razao_social}
                  </h2>
                  {currentDevedor.nome_fantasia && currentDevedor.nome_fantasia !== currentDevedor.razao_social && (
                    <p className="text-sm font-semibold text-slate-500 mt-0.5">
                      Nome Comercial: {currentDevedor.nome_fantasia}
                    </p>
                  )}
                </div>
              </div>

              {/* ─── PAINEL DE ESTRUTURA DE LIQUIDEZ & PERFIL DA DÍVIDA ─────────── */}
              <div className="mt-6 pt-6 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Scale size={15} className="text-blue-600" />
                    Estrutura de Liquidez &amp; Perfil da Dívida ({currentDevedor.ultimo_periodo})
                  </h3>
                  <span className="text-2xs text-slate-400">
                    Demonstrações contábeis padronizadas CVM • Balanço Patrimonial e DRE
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Bloco 1: Perfil de Vencimento da Dívida (CP vs LP) */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                          <Clock size={14} className="text-blue-600" />
                          Perfil de Vencimento
                        </span>
                        <span
                          className="text-slate-400 hover:text-blue-600 cursor-help"
                          title="Segregação contábil da dívida entre Curto Prazo (vencimento em até 360 dias) e Longo Prazo (vencimento após 360 dias) segundo CPC 26 / IFRS."
                        >
                          <Info size={13} />
                        </span>
                      </div>

                      <div className="space-y-1.5 mt-2">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-slate-500 font-medium">Curto Prazo (≤ 12m):</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatBRL(perfilDividaLiquidez.dividaCp)} ({perfilDividaLiquidez.pctCp.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-slate-500 font-medium">Longo Prazo (&gt; 12m):</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatBRL(perfilDividaLiquidez.dividaLp)} ({perfilDividaLiquidez.pctLp.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline text-xs pt-1 border-t border-slate-200/60">
                          <span className="text-slate-500 font-medium">Dívida Bruta Total:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatBRL(perfilDividaLiquidez.dividaBruta)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                      {/* Barra visual bicolor de composição */}
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                        <div
                          className="bg-amber-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, perfilDividaLiquidez.pctCp))}%` }}
                          title={`Curto Prazo: ${perfilDividaLiquidez.pctCp.toFixed(1)}%`}
                        />
                        <div
                          className="bg-blue-600 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, perfilDividaLiquidez.pctLp))}%` }}
                          title={`Longo Prazo: ${perfilDividaLiquidez.pctLp.toFixed(1)}%`}
                        />
                      </div>
                      <div className="flex justify-between text-3xs text-slate-400 mt-1 font-semibold">
                        <span>CP: {perfilDividaLiquidez.pctCp.toFixed(0)}%</span>
                        <span>LP: {perfilDividaLiquidez.pctLp.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: Autonomia de Caixa & Capital de Giro */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                          <TrendingUp size={14} className="text-emerald-600" />
                          Liquidez &amp; Caixa
                        </span>
                        <span
                          className="text-slate-400 hover:text-blue-600 cursor-help"
                          title="Caixa e equivalentes imediatos frente à dívida de curto prazo (cobertura para 12 meses) e Capital Circulante Líquido (CCL = Ativo Circulante - Passivo Circulante)."
                        >
                          <Info size={13} />
                        </span>
                      </div>

                      <div className="space-y-1.5 mt-2">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-slate-500 font-medium">Caixa &amp; Aplicações:</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {formatBRL(perfilDividaLiquidez.caixa)}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-slate-500 font-medium">Caixa / Dívida CP:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {perfilDividaLiquidez.razaoCaixaCp !== null
                              ? `${perfilDividaLiquidez.razaoCaixaCp.toFixed(2)}x`
                              : "N/D"}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline text-xs pt-1 border-t border-slate-200/60">
                          <span className="text-slate-500 font-medium">Cap. Circulante Líquido:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {perfilDividaLiquidez.ccl !== null ? formatBRL(perfilDividaLiquidez.ccl) : "N/D"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Liquidez Corrente:</span>
                      <span className="font-mono font-bold text-blue-700">
                        {perfilDividaLiquidez.liquidezCorrente !== null ? `${perfilDividaLiquidez.liquidezCorrente.toFixed(2)}x` : "N/D"}
                      </span>
                    </div>
                  </div>

                  {/* Bloco 3: Alavancagem & Serviço da Dívida */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                          <DollarSign size={14} className="text-blue-600" />
                          Geração &amp; Alavancagem
                        </span>
                        <span
                          className="text-slate-400 hover:text-blue-600 cursor-help"
                          title="Dívida líquida consolidada, geração de caixa operacional acumulada (EBITDA LTM) e despesas financeiras anuais do serviço da dívida."
                        >
                          <Info size={13} />
                        </span>
                      </div>

                      <div className="space-y-1.5 mt-2">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-slate-500 font-medium">Dívida Líquida:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatBRL(perfilDividaLiquidez.dividaLiquida)}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-slate-500 font-medium">EBITDA (LTM):</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatBRL(perfilDividaLiquidez.ebitda)}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline text-xs pt-1 border-t border-slate-200/60">
                          <span className="text-slate-500 font-medium">Despesas Financeiras:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {perfilDividaLiquidez.despesasFinanceiras !== null ? formatBRL(perfilDividaLiquidez.despesasFinanceiras) : "N/D"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">DL / EBITDA:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatMultiplo(currentDevedor.kpis_resumo?.alavancagem_dl_ebitda)}
                      </span>
                    </div>
                  </div>

                  {/* Bloco 4: Benchmarking Setorial */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                          <Users size={14} className="text-indigo-600" />
                          Mediana do Setor
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowPeersModal(true)}
                          className="text-2xs font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                        >
                          {medianasSetor?.totalPares || 0} Pares
                        </button>
                      </div>

                      <div className="space-y-1.5 mt-2">
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-slate-500 font-medium">Alavancagem Empresa:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {formatMultiplo(currentDevedor.kpis_resumo?.alavancagem_dl_ebitda)}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline text-xs">
                          <span className="text-slate-500 font-medium">Mediana do Setor:</span>
                          <span className="font-mono font-bold text-indigo-700">
                            {medianasSetor?.alavancagem !== null && medianasSetor?.alavancagem !== undefined
                              ? `${medianasSetor.alavancagem.toFixed(2)}x`
                              : "N/D"}
                          </span>
                        </div>
                        <div className="flex justify-between items-baseline text-xs pt-1 border-t border-slate-200/60">
                          <span className="text-slate-500 font-medium">Diferencial vs Mediana:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {currentDevedor.kpis_resumo?.alavancagem_dl_ebitda !== null &&
                            currentDevedor.kpis_resumo?.alavancagem_dl_ebitda !== undefined &&
                            medianasSetor?.alavancagem !== null &&
                            medianasSetor?.alavancagem !== undefined
                              ? `${(currentDevedor.kpis_resumo.alavancagem_dl_ebitda - medianasSetor.alavancagem) > 0 ? '+' : ''}${(currentDevedor.kpis_resumo.alavancagem_dl_ebitda - medianasSetor.alavancagem).toFixed(2)}x`
                              : "N/D"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Setor de Atuação:</span>
                      <span className="font-mono text-xs font-semibold text-slate-700 truncate max-w-[130px]" title={currentDevedor.setor}>
                        {currentDevedor.setor}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── GRADE DE KPIS EXECUTIVOS ──────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {/* Receita Líquida */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-2xs uppercase tracking-wider font-bold text-slate-400 mb-1">Receita Líquida</div>
                <div className="text-lg font-black text-slate-900">
                  {formatBRL(currentDevedor.kpis_resumo?.receita_liquida)}
                </div>
                <div className="text-2xs text-slate-500 font-semibold mt-1">Período {currentDevedor.ultimo_periodo}</div>
              </div>

              {/* EBITDA */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-2xs uppercase tracking-wider font-bold text-slate-400 mb-1">EBITDA &amp; Margem</div>
                <div className="text-lg font-black text-slate-900">{formatBRL(currentDevedor.kpis_resumo?.ebitda)}</div>
                <div className="text-2xs text-emerald-700 font-bold mt-1">
                  Margem: {formatPct(currentDevedor.kpis_resumo?.margem_ebitda)}
                </div>
              </div>

              {/* Dívida Líquida */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-2xs uppercase tracking-wider font-bold text-slate-400 mb-1 flex items-center justify-between">
                  <span>Dívida Líquida</span>
                </div>
                <div className="text-lg font-black text-slate-900">
                  {formatBRL(currentDevedor.kpis_resumo?.divida_liquida)}
                </div>
                <div className="text-2xs text-slate-500 font-semibold mt-1">
                  Bruta: {formatBRL(currentDevedor.kpis_resumo?.divida_bruta)}
                </div>
              </div>

              {/* DL / EBITDA */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-2xs uppercase tracking-wider font-bold text-slate-400 mb-1 flex items-center justify-between">
                  <span>DL / EBITDA</span>
                  <InfoButton docKey="alavancagem" onOpen={setDocModalKey} />
                </div>
                <div className="text-lg font-black text-slate-900 font-mono">
                  {formatMultiplo(currentDevedor.kpis_resumo?.alavancagem_dl_ebitda)}
                </div>
                <div className="text-2xs font-bold text-blue-700 mt-1">Alavancagem Anualizada</div>
              </div>

              {/* Cobertura de Juros (ICR) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-2xs uppercase tracking-wider font-bold text-slate-400 mb-1 flex items-center justify-between">
                  <span>Cobertura (ICR)</span>
                  <InfoButton docKey="cobertura_juros" onOpen={setDocModalKey} />
                </div>
                <div className="text-lg font-black text-slate-900 font-mono">
                  {formatMultiplo(currentDevedor.kpis_resumo?.cobertura_juros_ebitda)}
                </div>
                <div className="text-2xs text-slate-500 font-semibold mt-1">EBITDA / Desp. Fin.</div>
              </div>

              {/* Altman Z''-Score */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                <div className="text-2xs uppercase tracking-wider font-bold text-slate-400 mb-1 flex items-center justify-between">
                  <span>Altman Z&apos;&apos;-Score</span>
                  <InfoButton docKey="altman_z" onOpen={setDocModalKey} />
                </div>
                <div className="text-lg font-black text-slate-900 font-mono">
                  {currentDevedor.kpis_resumo?.altman_z_score?.toFixed(2) || "N/D"}
                </div>
                <div className={`text-2xs font-bold mt-1 ${altmanInfo.corTexto.replace('text-', 'text-slate-800 ')}`}>
                  {currentDevedor.kpis_resumo?.altman_zona?.split("(")[0] || altmanInfo.label}
                </div>
              </div>
            </div>

            {/* ─── ABAS DE SÉRIES HISTÓRICAS E BENCHMARK SETORIAL ───────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">Evolução Histórica &amp; Séries Temporais</h3>
                    {medianasSetor && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-3xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <Users size={11} className="text-amber-600" />
                        Linha Tracejada: Mediana Setorial ({medianasSetor.totalPares} pares)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Acompanhamento trimestral com fechamentos reais CVM (1T, 2T, 3T, 4T e 12M Fechado)
                  </p>
                </div>

                {/* Controles: Seletor de Pares & Abas */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPeersModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer shrink-0"
                    title="Ajustar quais companhias compõem a mediana setorial nos gráficos"
                  >
                    <SlidersHorizontal size={13} className="text-blue-600" />
                    <span>Pares do Setor ({medianasSetor?.totalPares || 0}/{medianasSetor?.totalSetor || 0})</span>
                  </button>

                  {/* Seletor de Abas */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
                    <button
                      type="button"
                      onClick={() => setActiveTab("alavancagem")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        activeTab === "alavancagem" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Alavancagem &amp; Dívida
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("rentabilidade")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        activeTab === "rentabilidade" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Receita &amp; EBITDA
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("cobertura")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        activeTab === "cobertura" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Cobertura (ICR)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("liquidez")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        activeTab === "liquidez" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Liquidez &amp; Caixa
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("solvencia")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                        activeTab === "solvencia"
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-blue-700 bg-blue-50/50 hover:bg-blue-50"
                      }`}
                    >
                      Solvência (Altman Z&apos;&apos;)
                    </button>
                  </div>
                </div>
              </div>

              {/* Área do Gráfico */}
              <div className="p-6">
                {loadingFull ? (
                  <div className="h-80 flex flex-col items-center justify-center gap-3 bg-slate-50/70 rounded-2xl border-2 border-dashed border-blue-200">
                    <div className="w-9 h-9 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-slate-600">
                      Carregando séries históricas e demonstrações CVM de {currentDevedor?.razao_social}...
                    </span>
                  </div>
                ) : dadosGraficos && dadosGraficos.length > 0 ? (
                  <div className="w-full" style={{ width: "100%", height: 340, minHeight: 340 }}>
                    <ResponsiveContainer width="100%" height={340}>
                      {activeTab === "alavancagem" ? (
                        <LineChart data={dadosGraficos}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="periodo_rotulo" tick={{ fontSize: 12, fill: "#64748b" }} />
                          <YAxis yAxisId="left" tickFormatter={(v) => formatBRL(v)} tick={{ fontSize: 11, fill: "#64748b" }} />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tickFormatter={(v) => (typeof v === "number" && !isNaN(v) ? `${v.toFixed(1)}x` : "")}
                            tick={{ fontSize: 12, fill: "#3b82f6" }}
                          />
                          <Tooltip
                            formatter={(val: any, name: any) => {
                              const num = typeof val === "number" && !isNaN(val) ? val : null;
                              if (name === "Alavancagem (DL/EBITDA)" || name === "Mediana Setor Móvel (DL/EBITDA)") {
                                return [num !== null ? `${num.toFixed(2)}x` : "N/D", name];
                              }
                              return [num !== null ? formatBRL(num) : "N/D", name];
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="divida_bruta"
                            name="Dívida Bruta"
                            stroke="#64748b"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                          <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="divida_liquida"
                            name="Dívida Líquida"
                            stroke="#0f172a"
                            strokeWidth={2.5}
                            dot={{ r: 4 }}
                            connectNulls
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="alavancagem_dl_ebitda"
                            name="Alavancagem (DL/EBITDA)"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            dot={{ r: 4 }}
                            connectNulls
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="setor_alavancagem"
                            name="Mediana Setor Móvel (DL/EBITDA)"
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                          <ReferenceLine yAxisId="right" y={3.5} stroke="#ef4444" strokeDasharray="3 3" label="Covenant 3.5x" />
                        </LineChart>
                      ) : activeTab === "rentabilidade" ? (
                        <BarChart data={dadosGraficos}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="periodo_rotulo" tick={{ fontSize: 12, fill: "#64748b" }} />
                          <YAxis yAxisId="left" tickFormatter={(v) => formatBRL(v)} tick={{ fontSize: 11, fill: "#64748b" }} />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tickFormatter={(v) => (typeof v === "number" && !isNaN(v) ? `${v.toFixed(0)}%` : "")}
                            tick={{ fontSize: 12, fill: "#10b981" }}
                          />
                          <Tooltip
                            formatter={(val: any, name: any) => {
                              const num = typeof val === "number" && !isNaN(val) ? val : null;
                              if (name === "Margem EBITDA (%)" || name === "Mediana Setor Móvel (Margem %)") {
                                return [num !== null ? `${num.toFixed(1)}%` : "N/D", name];
                              }
                              return [num !== null ? formatBRL(num) : "N/D", name];
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                          <Bar yAxisId="left" dataKey="receita_liquida" name="Receita Líquida" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                          <Bar yAxisId="left" dataKey="ebitda" name="EBITDA" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="margem_ebitda"
                            name="Margem EBITDA (%)"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ r: 4 }}
                            connectNulls
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="setor_margem_ebitda"
                            name="Mediana Setor Móvel (Margem %)"
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        </BarChart>
                      ) : activeTab === "cobertura" ? (
                        <AreaChart data={dadosGraficos}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="periodo_rotulo" tick={{ fontSize: 12, fill: "#64748b" }} />
                          <YAxis
                            tickFormatter={(v) => (typeof v === "number" && !isNaN(v) ? `${v.toFixed(1)}x` : "")}
                            tick={{ fontSize: 11, fill: "#64748b" }}
                          />
                          <Tooltip
                            formatter={(val: any, name: any) => {
                              const num = typeof val === "number" && !isNaN(val) ? val : null;
                              return [num !== null ? `${num.toFixed(2)}x` : "N/D", name];
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                          <Area
                            type="monotone"
                            dataKey="cobertura_juros_ebitda"
                            name="Cobertura de Juros (ICR)"
                            stroke="#6366f1"
                            fill="#e0e7ff"
                            strokeWidth={2.5}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="setor_cobertura_juros"
                            name="Mediana Setor Móvel (ICR)"
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                          <ReferenceLine y={1.0} stroke="#ef4444" strokeDasharray="3 3" label="Risco ICR 1.0x" />
                          <ReferenceLine y={3.0} stroke="#10b981" strokeDasharray="3 3" label="Confortável 3.0x" />
                        </AreaChart>
                      ) : activeTab === "liquidez" ? (
                        <LineChart data={dadosGraficos}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="periodo_rotulo" tick={{ fontSize: 12, fill: "#64748b" }} />
                          <YAxis yAxisId="left" tickFormatter={(v) => formatBRL(v)} tick={{ fontSize: 11, fill: "#64748b" }} />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tickFormatter={(v) => (typeof v === "number" && !isNaN(v) ? `${v.toFixed(1)}x` : "")}
                            tick={{ fontSize: 11, fill: "#10b981" }}
                          />
                          <Tooltip
                            formatter={(val: any, name: any) => {
                              const num = typeof val === "number" && !isNaN(val) ? val : null;
                              if (name === "Liquidez Corrente" || name === "Mediana Setor Móvel (LC)") {
                                return [num !== null ? `${num.toFixed(2)}x` : "N/D", name];
                              }
                              return [num !== null ? formatBRL(num) : "N/D", name];
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                          <Line yAxisId="left" type="monotone" dataKey="caixa_equivalentes" name="Caixa &amp; Aplicações" stroke="#059669" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                          <Line yAxisId="left" type="monotone" dataKey="divida_cp" name="Dívida Curto Prazo (CP)" stroke="#f43f5e" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                          <Line yAxisId="right" type="monotone" dataKey="liquidez_corrente" name="Liquidez Corrente" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="setor_liquidez_corrente"
                            name="Mediana Setor Móvel (LC)"
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        </LineChart>
                      ) : (
                        /* Aba: SOLVÊNCIA EXCLUSIVA (ALTMAN Z''-SCORE) */
                        <LineChart data={dadosGraficos}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="periodo_rotulo" tick={{ fontSize: 12, fill: "#64748b" }} />
                          <YAxis
                            tickFormatter={(v) => (typeof v === "number" && !isNaN(v) ? v.toFixed(1) : "")}
                            tick={{ fontSize: 11, fill: "#64748b" }}
                          />
                          <Tooltip
                            formatter={(val: any, name: any) => {
                              const num = typeof val === "number" && !isNaN(val) ? val : null;
                              if (num === null) return ["N/D", name];
                              return [num.toFixed(2), name];
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                          <Line
                            type="monotone"
                            dataKey="altman_z_score"
                            name="Altman Z''-Score (Mercados Emergentes)"
                            stroke="#10b981"
                            strokeWidth={3}
                            dot={{ r: 4 }}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="setor_altman_z"
                            name="Mediana Setorial Z'' (Móvel)"
                            stroke="#f59e0b"
                            strokeDasharray="4 4"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                          <ReferenceLine y={2.6} stroke="#10b981" strokeDasharray="3 3" label="Zona Segura (Z'' ≥ 2,60)" />
                          <ReferenceLine y={1.1} stroke="#ef4444" strokeDasharray="3 3" label="Zona de Perigo (Z'' < 1,10)" />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400">
                    Nenhum histórico trimestral disponível para este devedor.
                  </div>
                )}
              </div>
            </div>

            {/* ─── HISTÓRICO DE RATINGS & MIGRAÇÕES NO TEMPO ─── */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Award size={18} className="text-amber-500" />
                      Rating Oficial de Crédito &amp; Trajetória no Tempo
                    </h3>
                    <InfoButton docKey="rating_devedor" onOpen={setDocModalKey} />
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Metodologia prudencial: aproximação pelo <strong>pior rating entre as emissões ativas</strong> a cada data de corte/divulgação
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  {currentDevedor.rating_atual && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="text-2xs uppercase tracking-wider font-bold text-amber-700">Rating Vigente:</span>
                      <span className="text-sm font-black text-amber-900 px-2 py-0.5 bg-amber-200/70 rounded-md font-mono">
                        {currentDevedor.rating_atual}
                      </span>
                    </div>
                  )}
                  {ratingCurveData.length > 0 && (
                    <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
                      {ratingCurveData.length} Pontos de Trajetória
                    </span>
                  )}
                </div>
              </div>

              {/* GRÁFICO DE EVOLUÇÃO TEMPORAL DO RATING */}
              {loadingFull ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="w-7 h-7 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-semibold text-slate-500">Carregando histórico de ratings...</span>
                </div>
              ) : ratingCurveData && ratingCurveData.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-bold flex items-center gap-1.5">
                      <TrendingUp size={14} className="text-blue-600" />
                      Curva de Rating do Devedor no Tempo (Consolidado Conservador)
                    </span>
                    <span className="text-2xs text-slate-400">
                      Grau de Investimento acima do patamar 11 (BBB-) • Fonte: Moody&apos;s, Fitch, S&amp;P, Liberum
                    </span>
                  </div>

                  <div className="w-full bg-slate-50/50 p-4 rounded-xl border border-slate-100" style={{ width: "100%", height: 280, minHeight: 280 }}>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={ratingCurveData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="data_formatada"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                        />
                        <YAxis
                          domain={[6, 20]}
                          ticks={[8, 11, 14, 16, 18, 20]}
                          tickFormatter={(v) => {
                            const map: Record<number, string> = {
                              20: "AAA",
                              18: "AA",
                              16: "A+",
                              14: "A-",
                              11: "BBB-",
                              8: "BB-",
                            };
                            return map[v] || `${v}`;
                          }}
                          tick={{ fontSize: 11, fill: "#64748b" }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const p = payload[0].payload as RatingEvolucaoPonto;
                              return (
                                <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-slate-700">
                                  <div className="font-bold text-slate-300">Data: {p.data_formatada}</div>
                                  <div className="text-amber-400 font-black text-sm flex items-center gap-1.5">
                                    <Award size={14} />
                                    Pior Rating: {p.rating}
                                  </div>
                                  <div className="text-slate-300 text-2xs">
                                    Agências: <span className="text-white font-semibold">{p.agencias}</span>
                                  </div>
                                  {p.tickers && p.tickers.length > 0 && (
                                    <div className="text-slate-300 text-2xs">
                                      Emissões Consideradas: <span className="font-mono text-blue-300">{p.tickers?.join(", ")}</span> ({p.qtd_emissoes} papéis)
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <ReferenceLine
                          y={11}
                          stroke="#10b981"
                          strokeDasharray="3 3"
                          label={{ value: "Grau de Investimento (BBB-)", position: "insideBottomRight", fill: "#10b981", fontSize: 10 }}
                        />
                        <Line
                          type="stepAfter"
                          dataKey="score"
                          name="Rating do Devedor"
                          stroke="#f59e0b"
                          strokeWidth={3}
                          dot={{ r: 5, fill: "#f59e0b", strokeWidth: 2, stroke: "#fff" }}
                          activeDot={{ r: 7 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs italic">
                  Companhia sem emissões com rating formal indexado por agências (S&amp;P, Moody&apos;s, Fitch ou Liberum) na base ANBIMA / B3.
                </div>
              )}
            </div>

            {/* ─── PAPÉIS EMITIDOS & CRONOGRAMA DE VENCIMENTOS (MATURITY WALL) ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Maturity Wall / Cronograma de Amortizações */}
              <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-1">
                    <Calendar size={18} className="text-blue-600" />
                    Cronograma de Vencimentos da Dívida
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Concentração de amortizações de principal por ano (Maturity Wall)
                  </p>

                  {loadingFull ? (
                    <div className="h-60 flex flex-col items-center justify-center gap-2">
                      <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-400">Calculando cronograma de vencimentos...</span>
                    </div>
                  ) : currentDevedor.maturity_wall && currentDevedor.maturity_wall.length > 0 ? (
                    <div className="w-full mt-2" style={{ width: "100%", height: 240, minHeight: 240 }}>
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={currentDevedor.maturity_wall}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="ano" tick={{ fontSize: 12, fill: "#64748b" }} />
                          <YAxis tickFormatter={(v) => formatBRL(v)} tick={{ fontSize: 11, fill: "#64748b" }} />
                          <Tooltip formatter={(val: any) => [formatBRL(val), "Volume a Vencer"]} />
                          <Bar dataKey="volume" fill="#2563eb" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400 text-xs italic">
                      Sem cronograma de vencimentos disponível.
                    </div>
                  )}
                </div>
                <div className="text-2xs text-slate-400 mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span>Fonte: B3 &amp; ANBIMA Contratos</span>
                  <span className="font-semibold text-slate-700">Volume Total em Papéis Ativos</span>
                </div>
              </div>

              {/* Tabela de Títulos Vigentes deste Devedor */}
              <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Briefcase size={18} className="text-blue-600" />
                      Títulos Emitidos no Mercado (Debêntures, CRIs, CRAs)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Relação de emissões vinculadas a este devedor com taxas indicativas ANBIMA
                    </p>
                  </div>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                    {currentDevedor.total_titulos || currentDevedor.titulos_ativos?.length || 0} Ativos
                  </span>
                </div>

                {loadingFull ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-2">
                    <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-400">Carregando carteira de títulos e taxas...</span>
                  </div>
                ) : currentDevedor.titulos_ativos && currentDevedor.titulos_ativos.length > 0 ? (
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 bg-white">
                        <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="py-2 px-2.5">Código / Ticker</th>
                          <th className="py-2 px-2.5">Tipo</th>
                          <th className="py-2 px-2.5">Taxa Emissão</th>
                          <th className="py-2 px-2.5">Taxa Indicativa</th>
                          <th className="py-2 px-2.5">Vencimento</th>
                          <th className="py-2 px-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentDevedor.titulos_ativos.map((t, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2 px-2.5 font-bold font-mono text-blue-600">
                              <Link to={`/asset/${t.ticker}`} className="hover:underline flex items-center gap-1">
                                {t.ticker}
                                <ArrowUpRight size={12} />
                              </Link>
                            </td>
                            <td className="py-2 px-2.5 font-semibold text-slate-700">{t.tipo}</td>
                            <td className="py-2 px-2.5 text-slate-600 font-medium">{t.taxa_emissao || "—"}</td>
                            <td className="py-2 px-2.5 text-slate-900 font-bold font-mono">
                              {t.taxa_indicativa ? `${t.taxa_indicativa}%` : "—"}
                            </td>
                            <td className="py-2 px-2.5 text-slate-500 font-mono">{t.dt_vencimento || "—"}</td>
                            <td className="py-2 px-2.5">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                t.status_ativo === "Ativo"
                                   ? "bg-emerald-100 text-emerald-800"
                                   : t.status_ativo === "Resgatado"
                                   ? "bg-purple-100 text-purple-800"
                                   : "bg-slate-100 text-slate-600"
                              }`}>
                                {t.status_ativo || "Ativo"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs italic">
                    Nenhum título de dívida pública encontrado associado a este devedor no momento.
                  </div>
                )}
              </div>
            </div>

            {/* ─── BOX DE NOTÍCIAS RECENTES (GOOGLE NEWS RSS) ───────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0">
                    <Newspaper className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-slate-900">
                        Notícias &amp; Fatos Recentes (Últimos 7 dias)
                      </h3>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-3xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/50">
                        Google News RSS
                      </span>
                    </div>
                    <p className="text-2xs text-slate-500">
                      Monitoramento de matérias sobre <span className="font-semibold text-slate-700">{companyNewsQuery}</span> para acompanhamento contínuo de eventos corporativos
                    </p>
                  </div>
                </div>

                <a
                  href={googleNewsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 rounded-lg transition-colors border border-blue-200/80 shadow-2xs self-start sm:self-auto shrink-0"
                  title="Abrir pesquisa de 7 dias diretamente no Google News"
                >
                  <span>Abrir no Google News</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Lista com Altura Fixa e Scroll Vertical */}
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {newsLoading ? (
                  <div className="p-5 space-y-3.5 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex flex-col gap-1.5">
                        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        <div className="flex gap-2">
                          <div className="h-3 bg-slate-100 rounded w-20"></div>
                          <div className="h-3 bg-slate-100 rounded w-16"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : newsList.length > 0 ? (
                  newsList.map((item, idx) => (
                    <a
                      key={idx}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 sm:px-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group block"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-2">
                          {item.title}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-3xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200/60 shrink-0">
                          {item.source}
                        </span>
                        {item.pubDate && (
                          <span className="text-3xs font-medium text-slate-400 whitespace-nowrap shrink-0">
                            {formatNewsDate(item.pubDate)}
                          </span>
                        )}
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400 opacity-40 group-hover:opacity-100 group-hover:text-blue-600 transition-all shrink-0 ml-1" />
                      </div>
                    </a>
                  ))
                ) : (
                  <div className="p-8 text-center">
                    <p className="text-xs text-slate-500 mb-2">
                      Nenhuma matéria indexada nos últimos 7 dias especificamente para &ldquo;{companyNewsQuery}&rdquo;.
                    </p>
                    <a
                      href={googleNewsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 underline"
                    >
                      Pesquisar menções e histórico no Google News
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* ─── MODAL SELETOR DE PARES SETORIAIS (BENCHMARK) ───────────────────── */}
      {showPeersModal && currentDevedor && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setShowPeersModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Composição dos Pares Setoriais
                </h3>
                <span className="text-xs font-semibold text-blue-600">
                  Setor: {currentDevedor.setor} ({selectedPeersCnpjs.length} de {empresasSetor.length} ativos)
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
              Marque ou desmarque os emissores do setor para recalcular instantaneamente a linha de <strong>Mediana Setorial</strong> exibida nos gráficos históricos.
            </p>

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPeersCnpjs(empresasSetor.map((e) => e.cnpj))}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold transition cursor-pointer"
                >
                  Selecionar Todos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeersCnpjs([])}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold transition cursor-pointer"
                >
                  Limpar Seleção
                </button>
              </div>
              <span className="text-2xs text-slate-400 font-mono">
                {selectedPeersCnpjs.length} selecionados
              </span>
            </div>

            {/* Lista com checkboxes */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 my-2 pr-1">
              {empresasSetor.map((peer) => {
                const isSelected = selectedPeersCnpjs.includes(peer.cnpj);
                const isCurrent = peer.cnpj === currentDevedor.cnpj;
                return (
                  <button
                    key={peer.cnpj}
                    type="button"
                    onClick={() => {
                      setSelectedPeersCnpjs((prev) =>
                        isSelected ? prev.filter((c) => c !== peer.cnpj) : [...prev, peer.cnpj]
                      );
                    }}
                    className={`w-full text-left p-3 rounded-xl flex items-center justify-between transition cursor-pointer ${
                      isSelected ? "bg-blue-50/50 hover:bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="text-blue-600 shrink-0">
                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} className="text-slate-300" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                          <span>{peer.razao_social}</span>
                          {isCurrent && (
                            <span className="text-3xs font-black bg-blue-600 text-white px-1.5 py-0.2 rounded uppercase">
                              Atual
                            </span>
                          )}
                        </div>
                        <div className="text-2xs text-slate-400 font-mono">
                          CNPJ: {peer.cnpj_formatado}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div>
                        <div className="text-2xs text-slate-400 font-semibold">DL/EBITDA</div>
                        <div className="text-xs font-bold font-mono text-slate-800">
                          {formatMultiplo(peer.kpis_resumo?.alavancagem_dl_ebitda)}
                        </div>
                      </div>
                      <div>
                        <div className="text-2xs text-slate-400 font-semibold">Altman Z&apos;&apos;</div>
                        <div className="text-xs font-bold font-mono text-emerald-700">
                          {peer.kpis_resumo?.altman_z_score?.toFixed(2) || "—"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-2xs text-slate-400">
                A mediana recalcula automaticamente em tempo real.
              </span>
              <button
                type="button"
                onClick={() => setShowPeersModal(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DE DOCUMENTAÇÃO METODOLÓGICA ─────────────────────────────── */}
      {docModalKey && DOCUMENTACAO_INDICADORES[docModalKey] && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full p-6 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              type="button"
              onClick={() => setDocModalKey(null)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">{DOCUMENTACAO_INDICADORES[docModalKey].titulo}</h3>
                <span className="text-xs font-semibold text-blue-600">{DOCUMENTACAO_INDICADORES[docModalKey].sigla}</span>
              </div>
            </div>

            <div className="space-y-4 mt-4 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs text-slate-900">
                <span className="text-slate-400 select-none">Fórmula: </span>
                <span className="font-bold text-blue-900">{DOCUMENTACAO_INDICADORES[docModalKey].formula}</span>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-2xs mb-1">Fonte dos Dados Primários:</h4>
                <p className="text-slate-600 leading-relaxed">{DOCUMENTACAO_INDICADORES[docModalKey].fonte}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-2xs mb-1">Fundamentação Teórica:</h4>
                <p className="text-slate-600 leading-relaxed">{DOCUMENTACAO_INDICADORES[docModalKey].conceito}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-2xs mb-1">Interpretação no Mercado de Crédito:</h4>
                <p className="text-slate-600 leading-relaxed">{DOCUMENTACAO_INDICADORES[docModalKey].interpretacao}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-2xs mb-2">Faixas de Corte &amp; Benchmarks Institucionais:</h4>
                <div className="space-y-1.5">
                  {DOCUMENTACAO_INDICADORES[docModalKey].benchmarks.map((b, idx) => (
                    <div key={idx} className={`p-2 rounded-lg border text-xs flex justify-between items-center ${b.cor}`}>
                      <span className="font-mono font-bold">{b.faixa}</span>
                      <span className="font-semibold">{b.classificacao}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setDocModalKey(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebtorRadar;
