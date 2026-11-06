import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Linkedin, 
  ShieldCheck, 
  Code2, 
  Database, 
  ExternalLink, 
  Mail, 
  Sparkles, 
  ArrowRight,
  Heart,
  CheckCircle2
} from 'lucide-react';

export default function AboutPage() {
  useEffect(() => {
    document.title = 'Sobre o FIXDATA | Quem Somos & Governança';
    window.scrollTo(0, 0);
  }, []);

  const LINKEDIN_URL = "https://www.linkedin.com/in/leonardo-contador-neves-096312119/";

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-8 md:p-12 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
            <Sparkles size={14} className="text-blue-400" />
            Transparência Institucional
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Sobre o <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">FIXDATA</span>
          </h1>
          <p className="text-slate-300 text-base md:text-lg leading-relaxed font-normal">
            A infraestrutura analítica independente que traz transparência, rigor matemático e dados abertos para o mercado de Crédito Privado e Renda Fixa no Brasil.
          </p>
        </div>
      </div>

      {/* Nossa Missão */}
      <section className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
        <h2 className="text-2xl font-black text-slate-900">Nossa Missão & Propósito</h2>
        <p className="text-slate-600 text-sm md:text-base leading-relaxed">
          O mercado de títulos de crédito privado brasileiro (Debêntures, CRIs e CRAs) ultrapassou a marca de <strong>R$ 3,6 trilhões em estoque</strong>, tornando-se uma das principais fontes de financiamento da infraestrutura nacional e da carteira de investidores institucionais e pessoas físicas.
        </p>
        <p className="text-slate-600 text-sm md:text-base leading-relaxed">
          No entanto, o acesso a dados consolidados de negociações na B3, spreads indicativos ANBIMA contra a NTN-B e cronogramas de amortizações historicamente permaneceu disperso em terminais pagos inacessíveis para a maioria do público.
        </p>
        <div className="bg-blue-50 border border-blue-100 p-5 rounded-2xl text-blue-950 font-medium text-sm leading-relaxed">
          💡 <strong>O compromisso do FIXDATA:</strong> Fornecer uma plataforma aberta, 100% gratuita, sem paywalls e alimentada por esteiras diárias de engenharia de dados que higienizam dados públicos de CVM, ANBIMA e B3 com total transparência algorítmica.
        </div>
      </section>

      {/* Autor & Liderança Técnica */}
      <section className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <Code2 size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Liderança Técnica</span>
            <h2 className="text-2xl font-black text-slate-900">Autor & Idealizador do Projeto</h2>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-3xl shadow-md shrink-0">
            LN
          </div>
          <div className="space-y-3 text-center md:text-left">
            <div>
              <h3 className="text-xl font-black text-slate-900">Leonardo Contador Neves</h3>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mt-0.5">Engenharia de Dados & Modelagem Financeira</p>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Desenvolvedor e entusiasta do mercado de capitais brasileiro, responsável pela arquitetura de dados, modelagem das curvas de juros e pipelines de inteligência do FIXDATA.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
              <a 
                href={LINKEDIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
              >
                <Linkedin size={16} /> Conectar no LinkedIn <ExternalLink size={14} />
              </a>
              <Link 
                to="/contact"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold rounded-xl transition"
              >
                <Mail size={16} /> Contato & Apoio
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Princípios de Governança */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl w-fit">
            <ShieldCheck size={20} />
          </div>
          <h3 className="text-base font-bold text-slate-900">Dados Auditáveis</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Todas as métricas (PUs, taxas e P&L) indicam explicitamente sua fonte primária (ANBIMA, B3 ou Escritura pública CVM).
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl w-fit">
            <Database size={20} />
          </div>
          <h3 className="text-base font-bold text-slate-900">Atualização Diária</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Esteiras automáticas processam os fechamentos do mercado secundário todas as noites úteis a partir das 20:30 BRT.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl w-fit">
            <Heart size={20} />
          </div>
          <h3 className="text-base font-bold text-slate-900">Acesso 100% Livre</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Sem cadastro compulsório, sem limites artificiais de consulta e sem comercialização de dados de usuários.
          </p>
        </div>
      </section>
    </div>
  );
}

