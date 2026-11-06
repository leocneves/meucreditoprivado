import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Scale, FileText, AlertTriangle, ArrowRight, Building2 } from 'lucide-react';

export default function TermsPage() {
  useEffect(() => {
    document.title = 'Termos de Serviço e Uso da Plataforma | FIXDATA';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-8 md:p-10 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider">
            <Scale size={14} className="text-blue-400" />
            Marco Jurídico e Condições de Uso
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Termos de Serviço & Uso
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Última atualização: Novembro de 2026. Por favor, leia atentamente as condições de acesso e utilização da plataforma <strong className="text-white">FIXDATA</strong>.
          </p>
        </div>
      </div>

      {/* Conteúdo dos Termos */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-10 shadow-sm space-y-8 text-slate-700 text-sm md:text-base leading-relaxed">
        {/* 1. Objeto */}
        <section className="space-y-3">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="text-blue-600 font-mono">1.</span> Objeto e Natureza da Plataforma
          </h2>
          <p>
            O <strong>FIXDATA</strong> (<a href="https://fixdatabrasil.com.br" className="text-blue-600 hover:underline">fixdatabrasil.com.br</a>) é uma plataforma analítica independente de inteligência e consolidação de dados públicos sobre o mercado de capitais e títulos de crédito privado brasileiro (Debêntures, CRIs e CRAs).
          </p>
          <p>
            A finalidade precípua do FIXDATA é democratizar o acesso a informações financeiras quantitativas, cálculos de spreads e demonstrativos corporativos para pesquisadores, investidores, estudantes e o público em geral.
          </p>
        </section>

        {/* 2. Disclaimer */}
        <section className="space-y-3 p-5 bg-amber-50/60 rounded-2xl border border-amber-200">
          <div className="flex items-center gap-2 text-amber-800 font-bold">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <h2 className="text-lg font-black text-slate-900">2. Isenção de Responsabilidade (Disclaimer de Investimento)</h2>
          </div>
          <p className="text-slate-800 text-xs md:text-sm leading-relaxed">
            <strong>O FIXDATA NÃO É UMA INSTITUIÇÃO FINANCEIRA, CORRETORA DE VALORES, DISTRIBUIDORA, CASA DE ANÁLISE DE VALORES MOBILIÁRIOS OU CONSULTORIA DE INVESTIMENTOS</strong>, não estando enquadrado nos termos da Resolução CVM nº 20/2021 ou correlatas.
          </p>
          <p className="text-slate-800 text-xs md:text-sm leading-relaxed">
            Nenhum dado, tela, gráfico, indicador, cálculo de equivalência ou síntese automatizada constitui recomendação, conselho ou oferta de compra, venda ou manutenção de qualquer título mobiliário. Todas as decisões de alocação de capital e gestão de risco são de exclusiva responsabilidade do usuário. Recomendamos a consulta a profissionais certificados habilitados pela CVM/ANBIMA antes de tomar decisões financeiras.
          </p>
        </section>

        {/* 3. Fontes de Dados */}
        <section className="space-y-3">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="text-blue-600 font-mono">3.</span> Origem dos Dados e Atualizações
          </h2>
          <p>
            As cotações, preços unitários (PU), taxas indicativas, cronogramas de amortização e demonstrativos contábeis são obtidos a partir de dados abertos divulgados por entidades reguladoras e autorreguladoras oficiais:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs md:text-sm">
            <li><strong>ANBIMA:</strong> Preços e taxas indicativas do mercado secundário;</li>
            <li><strong>B3 (Brasil, Bolsa, Balcão):</strong> Negócios secundários, boletins de negociação e volumes diários;</li>
            <li><strong>CVM (Comissão de Valores Mobiliários):</strong> Registros de ofertas CVM 160/400/476 e demonstrativos DFP/ITR;</li>
            <li><strong>Tesouro Nacional / Banco Central do Brasil:</strong> Curva soberana de juros reais e inflação (NTN-B).</li>
          </ul>
          <p className="text-xs text-slate-500">
            Apesar de empregarmos rotinas matemáticas de validação de integridade, o FIXDATA não se responsabiliza por eventuais incorreções, omissões ou atrasos nas bases fornecidas pelos órgãos primários emissores.
          </p>
        </section>

        {/* 4. Propriedade Intelectual */}
        <section className="space-y-3">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="text-blue-600 font-mono">4.</span> Propriedade Intelectual & Uso Aceitável
          </h2>
          <p>
            O código-fonte, a arquitetura visual, os modelos de indexação e os textos explicativos são de titularidade do mantenedor do FIXDATA, <strong>Leonardo Contador Neves</strong>.
          </p>
          <p>
            É estritamente vedada a prática de web scraping predatório, ataques de negação de serviço (DoS) ou qualquer conduta automatizada que degrade a estabilidade dos servidores ou a experiência dos demais usuários.
          </p>
        </section>

        {/* 5. Autenticação e Contas */}
        <section className="space-y-3">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="text-blue-600 font-mono">5.</span> Autenticação de Usuários
          </h2>
          <p>
            Determinadas ferramentas avançadas podem solicitar autenticação via conta Google (OAuth 2.0). O usuário concorda em manter suas credenciais em segurança e utilizar o serviço de boa-fé. O acesso pode ser suspenso caso seja constatada violação destes termos.
          </p>
        </section>

        {/* 6. Foro e Legislação */}
        <section className="space-y-3">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="text-blue-600 font-mono">6.</span> Legislação Aplicável e Foro
          </h2>
          <p>
            Estes Termos são regidos e interpretados em conformidade com as leis da República Federativa do Brasil, em especial a Lei Geral de Proteção de Dados (Lei nº 13.709/2018) e o Marco Civil da Internet (Lei nº 12.965/2014). Fica eleito o Foro da Comarca de São Paulo/SP para dirimir eventuais litígios.
          </p>
        </section>

        {/* Links de navegação */}
        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <Link to="/privacidade" className="text-blue-600 font-bold hover:underline flex items-center gap-1.5 text-xs md:text-sm">
            <span>Conheça nossa Política de Privacidade</span>
            <ArrowRight size={14} />
          </Link>
          <Link to="/contact" className="text-slate-500 hover:text-slate-700 text-xs md:text-sm">
            Dúvidas ou sugestões? Fale conosco
          </Link>
        </div>
      </div>
    </div>
  );
}
