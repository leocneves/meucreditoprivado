import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Lock, Database, UserCheck, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function PrivacyPage() {
  useEffect(() => {
    document.title = 'Política de Privacidade e Proteção de Dados (LGPD) | FIXDATA';
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-8 md:p-10 text-white shadow-xl border border-slate-800">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider">
            <Lock size={14} className="text-blue-400" />
            LGPD — Lei Federal nº 13.709/2018
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
            Política de Privacidade
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Saiba como o <strong className="text-white">FIXDATA</strong> coleta, trata e protege suas informações pessoais com transparência e segurança de dados.
          </p>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-10 shadow-sm space-y-8 text-slate-700 text-sm md:text-base leading-relaxed">
        {/* 1. Compromisso */}
        <section className="space-y-3">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="text-blue-600 font-mono">1.</span> Nosso Compromisso com a Privacidade
          </h2>
          <p>
            O <strong>FIXDATA</strong> (<a href="https://fixdatabrasil.com.br" className="text-blue-600 hover:underline">fixdatabrasil.com.br</a>) está comprometido com a salvaguarda da privacidade e a proteção de dados pessoais de seus usuários e visitantes, em estrita conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018)</strong> e o <strong>Marco Civil da Internet (Lei nº 12.965/2014)</strong>.
          </p>
        </section>

        {/* 2. Coleta de Dados */}
        <section className="space-y-3">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="text-blue-600 font-mono">2.</span> Quais Dados Coletamos
          </h2>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
              <h3 className="font-bold text-slate-900 text-sm md:text-base">A. Navegação Pública (Sem Login)</h3>
              <p className="text-xs md:text-sm text-slate-600">
                Coletamos dados anônimos de telemetria técnica essenciais para o funcionamento do portal (endereço IP anonimizado, páginas visitadas, tempo de permanência, tipo de dispositivo e navegador) por meio de ferramentas analíticas como Netlify Edge e PostHog, sem identificar o titular.
              </p>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
              <h3 className="font-bold text-slate-900 text-sm md:text-base">B. Autenticação Voluntária (Google Sign-In)</h3>
              <p className="text-xs md:text-sm text-slate-600">
                Quando o usuário opta por fazer login para desbloquear ferramentas analíticas avançadas (como Raio-X do Devedor e painéis comparativos), recebemos via Google OAuth 2.0 unicamente:
              </p>
              <ul className="list-disc pl-5 text-xs md:text-sm text-slate-600 space-y-0.5">
                <li>Nome completo de exibição;</li>
                <li>Endereço de e-mail;</li>
                <li>Foto pública do perfil Google (URL da imagem).</li>
              </ul>
              <p className="text-xs text-blue-600 font-semibold mt-1">
                ⚠️ O FIXDATA nunca tem acesso nem armazena a sua senha do Google.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Finalidade */}
        <section className="space-y-3">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="text-blue-600 font-mono">3.</span> Finalidade do Tratamento de Dados
          </h2>
          <p>
            Os dados coletados são utilizados estritamente para:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600 text-xs md:text-sm">
            <li>Autenticar o acesso a funcionalidades restritas ou ferramentas especializadas;</li>
            <li>Garantir a integridade, segurança cibernética e prevenção a abusos contra a infraestrutura;</li>
            <li>Monitorar a estabilidade e performance das rotinas de carregamento de dados;</li>
            <li>Comunicar avisos técnicos importantes ou novidades da plataforma, mediante consentimento.</li>
          </ul>
          <p className="font-semibold text-slate-900 text-xs md:text-sm">
            Nós NUNCA vendemos, comercializamos, alugamos ou compartilhamos dados cadastrais de usuários com corretoras, financeiras ou terceiros para fins de marketing.
          </p>
        </section>

        {/* 4. Cookies e Armazenamento */}
        <section className="space-y-3">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="text-blue-600 font-mono">4.</span> Cookies e LocalStorage
          </h2>
          <p>
            Utilizamos armazenamento local (LocalStorage) e cookies técnicos estritamente necessários para manter o estado da sua sessão autenticada e suas preferências de navegação ativas no navegador. O usuário pode desativar os cookies nas configurações de seu navegador, ciente de que certas funcionalidades podem ficar indisponíveis.
          </p>
        </section>

        {/* 5. Direitos do Titular */}
        <section className="space-y-3 p-5 bg-blue-50/60 rounded-2xl border border-blue-200">
          <div className="flex items-center gap-2 text-blue-900 font-bold">
            <UserCheck size={18} className="text-blue-600 shrink-0" />
            <h2 className="text-lg font-black text-slate-900">5. Seus Direitos sob a LGPD (Artigo 18)</h2>
          </div>
          <p className="text-slate-800 text-xs md:text-sm leading-relaxed">
            Você possui pleno direito de, a qualquer momento e mediante requisição simples:
          </p>
          <ul className="list-disc pl-5 text-xs md:text-sm text-slate-700 space-y-1">
            <li>Confirmar a existência de tratamento de seus dados;</li>
            <li>Acessar seus dados pessoais tratados pelo FIXDATA;</li>
            <li>Solicitar a correção de dados incompletos ou inexatos;</li>
            <li>Revogar o consentimento e exigir a exclusão imediata e definitiva de sua conta e dados associados.</li>
          </ul>
        </section>

        {/* 6. Encarregado */}
        <section className="space-y-3">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <span className="text-blue-600 font-mono">6.</span> Encarregado pelo Tratamento de Dados (DPO)
          </h2>
          <p>
            Para exercer seus direitos de privacidade, tirar dúvidas ou solicitar a exclusão de sua conta, entre em contato diretamente com o responsável técnico e encarregado da plataforma:
          </p>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs md:text-sm space-y-1">
            <p><strong>Responsável:</strong> Leonardo Contador Neves</p>
            <p><strong>Plataforma:</strong> FIXDATA (fixdatabrasil.com.br)</p>
            <p><strong>Canal de Atendimento:</strong> <Link to="/contact" className="text-blue-600 hover:underline">Página de Contato & Apoio</Link></p>
          </div>
        </section>

        {/* Links de navegação */}
        <div className="pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <Link to="/termos" className="text-blue-600 font-bold hover:underline flex items-center gap-1.5 text-xs md:text-sm">
            <span>Consulte nossos Termos de Serviço</span>
            <ArrowRight size={14} />
          </Link>
          <Link to="/contact" className="text-slate-500 hover:text-slate-700 text-xs md:text-sm">
            Fale com o suporte
          </Link>
        </div>
      </div>
    </div>
  );
}
