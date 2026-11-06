import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  BookOpen, 
  ShieldCheck, 
  Calculator, 
  LineChart, 
  Database, 
  Scale, 
  CheckCircle2, 
  Building2, 
  Landmark, 
  AlertTriangle,
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function MethodologyPage() {
  useEffect(() => {
    document.title = 'Metodologia e Governança de Dados | FIXDATA';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-8 md:p-12 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
            <ShieldCheck size={14} className="text-blue-400" />
            Governança & Rigor Quantitativo
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Metodologia & Transparência de Dados
          </h1>
          <p className="text-slate-300 text-base md:text-lg leading-relaxed font-normal">
            Conheça as fontes oficiais, os fundamentos matemáticos e as convenções financeiras utilizadas pelo <strong className="text-white font-semibold">FIXDATA</strong> para processar cotações, spreads, duration e solvência de mais de 16.000 títulos de crédito privado brasileiro.
          </p>
        </div>
      </div>

      {/* 1. Fontes de Dados Oficiais */}
      <section className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Database size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Pilar 1</span>
            <h2 className="text-2xl font-black text-slate-900">Fontes Oficiais & Ingestão Automatizada</h2>
          </div>
        </div>

        <p className="text-slate-600 text-sm md:text-base leading-relaxed">
          O FIXDATA não realiza estimativas arbitrárias. Todo o pipeline de dados é alimentado diariamente por esteiras automatizadas que coletam, higienizam e cruzam dados das três instituições regulatórias do mercado de capitais brasileiro:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <Landmark size={18} className="text-blue-600" />
              ANBIMA
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Taxas indicativas de fechamento de Debêntures, CRIs e CRAs, curvas de juros a termo de Títulos Públicos (NTN-B, LTN, LFT) e cadastro de características contratuais de emissão.
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <LineChart size={18} className="text-emerald-600" />
              B3 (Mercado Balcão)
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Boletins diários de negociações no mercado secundário trade-by-trade, volumes financeiros liquidados, Preço Unitário Médio Ponderado (VWAP) e documentos de CRIs/CRAs.
            </p>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 space-y-2.5">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <Building2 size={18} className="text-indigo-600" />
              CVM (Comissão de Valores)
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Demonstrações Financeiras Padronizadas (DFP) e Informações Trimestrais (ITR) de emissores de dívida, informes mensais de securitizadoras e registros da Resolução CVM 160.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Metodologia de Duration e Spreads */}
      <section className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <Calculator size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Pilar 2</span>
            <h2 className="text-2xl font-black text-slate-900">Duration em Dias Úteis (DU/252) & Spreads</h2>
          </div>
        </div>

        <div className="space-y-4 text-slate-600 text-sm md:text-base leading-relaxed">
          <p>
            No mercado brasileiro de renda fixa, o tempo financeiro não é linear. Todas as taxas e fluxos são apurados estritamente sobre a convenção de <strong>Dias Úteis / 252 (`DU/252`)</strong>, expurgando finais de semana e feriados nacionais de acordo com o calendário oficial ANBIMA/B3.
          </p>

          <div className="bg-slate-900 text-slate-100 p-5 rounded-2xl font-mono text-xs md:text-sm space-y-2 overflow-x-auto">
            <div className="text-slate-400 font-sans text-xs uppercase font-bold">// Fórmula da Duration Modificada no Mercado Brasileiro</div>
            <div>{"Duration_Anos = ( \\sum [ (DU_t / 252) * (Fluxo_t / (1 + Taxa)^(DU_t/252)) ] ) / PU_Mercado"}</div>
          </div>

          <h3 className="text-lg font-bold text-slate-900 pt-2">Regra Estrita de Spread na Mesma Partição</h3>
          <p>
            Para títulos indexados à inflação (IPCA+), o FIXDATA adota a regra de <strong>Benchmark Estrito na Mesma Partição</strong>: a taxa da debênture é comparada com a NTN-B soberana de vencimento mais próximo cotada <em>no mesmo dia útil</em>.
          </p>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl text-xs md:text-sm text-blue-900">
            <strong>Spread Over (Prêmio de Risco):</strong> Calculado na fórmula de juros compostos: <br />
            <code className="font-mono bg-blue-100 px-1.5 py-0.5 rounded text-blue-800">Spread = [(1 + Taxa_Ativo) / (1 + Taxa_NTNB_Ref)] - 1</code>
          </div>
        </div>
      </section>

      {/* 3. Modelos de Solvência e Raio-X do Devedor */}
      <section className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Scale size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Pilar 3</span>
            <h2 className="text-2xl font-black text-slate-900">Solvência Contábil & Modelos Estatísticos</h2>
          </div>
        </div>

        <p className="text-slate-600 text-sm md:text-base leading-relaxed">
          O módulo <strong className="text-slate-800">Raio-X do Devedor</strong> aplica métricas contábeis reconhecidas internacionalmente para avaliar o risco de crédito corporativo dos emissores cadastrados na CVM:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 text-sm">Altman Z'' Score (Mercados Emergentes)</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Adaptado pelo Prof. Edward Altman para economias em desenvolvimento e empresas não-financeiras com ou sem capital aberto, combinando capital de giro, lucros acumulados, EBIT e patrimônio líquido sobre passivos totais.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900 text-sm">Índice de Cobertura de Juros (ICR)</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Mede a capacidade operacional da companhia de honrar suas despesas financeiras com base no EBITDA ou EBIT apurado nos últimos 12 meses (LTM).
            </p>
          </div>
        </div>
      </section>

      {/* 4. Isenção Legal & Disclaimer de Investimento */}
      <section className="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-6 md:p-8 space-y-4">
        <div className="flex items-center gap-2 text-amber-800 font-black text-lg">
          <AlertTriangle size={22} className="text-amber-600" />
          Aviso Legal & Isenção de Responsabilidade (Disclaimer CVM)
        </div>
        <p className="text-xs md:text-sm text-amber-900/90 leading-relaxed">
          O <strong>FIXDATA</strong> é uma ferramenta tecnológica independente de agregação, visualização e inteligência de dados públicos de mercado. 
          As informações apresentadas <strong>não constituem recomendação, oferta, assessoria ou consultoria de investimento</strong> de qualquer natureza. 
          Preços unitários (PU) e taxas de mercado refletem negociações passadas e taxas indicativas institucionais divulgadas por terceiros, sujeitas à volatilidade e risco de liquidez.
          Investidores devem realizar sua própria diligência e consultar profissionais certificados (AAI, CNPI, CGA) antes de tomar qualquer decisão alocativa.
        </p>
      </section>

      {/* CTA de Navegação */}
      <div className="text-center pt-4">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition shadow-md"
        >
          Explorar Títulos no FIXDATA <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

