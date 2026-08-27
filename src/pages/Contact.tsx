import React, { useState } from 'react';
import { Linkedin, Coffee, Copy, Check, ExternalLink, Sparkles, QrCode, MessageSquare } from 'lucide-react';

const Contact: React.FC = () => {
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedBtc, setCopiedBtc] = useState(false);

  const LINKEDIN_URL = "https://www.linkedin.com/in/leonardo-contador-neves-096312119/";
  const PIX_PAYLOAD = "00020126580014BR.GOV.BCB.PIX0136b62cc5bb-c11a-4eed-800e-72e277ecdec35204000053039865802BR5923LEONARDO CONTADOR NEVES6009SAO PAULO62250521qgQ08GdXFaSJRfmffnINv6304A2B2";
  const PIX_KEY = "b62cc5bb-c11a-4eed-800e-72e277ecdec3";
  const BTC_ADDRESS = "bc1q4awhpm9aw49zsmp848sa45lq5x897jdg8szeat";

  const handleCopyPix = () => {
    navigator.clipboard.writeText(PIX_PAYLOAD);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 3000);
  };

  const handleCopyBtc = () => {
    navigator.clipboard.writeText(BTC_ADDRESS);
    setCopiedBtc(true);
    setTimeout(() => setCopiedBtc(false), 3000);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-8 md:p-12 text-white shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider backdrop-blur-md">
            <Sparkles size={14} className="text-blue-400" />
            Contato & Apoio ao Projeto
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
            Gostou do <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">FIXDATA</span>? <br />
            Pague um café ao desenvolvedor! ☕
          </h1>
          <p className="text-slate-300 text-base md:text-lg leading-relaxed font-normal">
            O FIXDATA é uma plataforma independente criada para oferecer dados, analytics e pré-renderização de ativos do Mercado Secundário e Crédito Privado no Brasil. Se essas ferramentas facilitam suas análises e rotina diária, considere apoiar a continuidade e evolução do projeto!
          </p>
        </div>
      </div>

      {/* LinkedIn Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-md border-2 border-white ring-4 ring-blue-50">
              LN
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl md:text-2xl font-black text-slate-800">
                  Leonardo Contador Neves
                </h2>
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  Autor / Dev
                </span>
              </div>
              <p className="text-slate-600 font-medium text-sm md:text-base">
                Idealizador e Desenvolvedor do FIXDATA
              </p>
              <p className="text-slate-400 text-xs sm:text-sm">
                Especialista em inteligência de dados de renda fixa, mercado secundário e soluções automatizadas.
              </p>
            </div>
          </div>

          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0077b5] hover:bg-[#006097] text-white font-bold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg transform active:scale-95 text-sm shrink-0"
          >
            <Linkedin size={20} />
            <span>Perfil no LinkedIn</span>
            <ExternalLink size={16} className="opacity-80" />
          </a>
        </div>
      </div>

      {/* Buy Me a Coffee / Donation Section */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
            <Coffee size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Buy Me a Coffee / Formas de Apoio
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              Escolha a forma que preferir para realizar uma contribuição direta.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* PIX Donation Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <QrCode size={22} />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-lg">Doação via PIX</h3>
                    <p className="text-xs text-slate-400 font-medium">Transferência instantânea via QR Code ou Copia e Cola</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">
                  Itaú
                </span>
              </div>

              {/* PIX QR Image */}
              <div className="flex justify-center my-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <img
                  src="/pix.jpeg"
                  alt="QR Code PIX doação Itaú - Leonardo Contador Neves"
                  className="w-48 h-48 object-contain rounded-xl shadow-sm border border-white"
                />
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-2 border border-slate-100 text-xs">
                <div className="flex justify-between items-center text-slate-500 font-semibold">
                  <span>Beneficiário:</span>
                  <span className="text-slate-900 font-bold">Leonardo Contador Neves</span>
                </div>
                <div className="flex justify-between items-center text-slate-500 font-semibold">
                  <span>Chave PIX (Aleatória):</span>
                  <span className="text-slate-800 font-mono font-medium truncate max-w-[200px]" title={PIX_KEY}>
                    {PIX_KEY}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCopyPix}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-sm ${
                copiedPix
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-md'
              }`}
            >
              {copiedPix ? (
                <>
                  <Check size={18} />
                  <span>PIX Copia e Cola Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={18} />
                  <span>Copiar PIX (Copia e Cola)</span>
                </>
              )}
            </button>
          </div>

          {/* Bitcoin Donation Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:border-amber-200 hover:shadow-md transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <span className="font-extrabold text-xl">₿</span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-lg">Doação via Bitcoin</h3>
                    <p className="text-xs text-slate-400 font-medium">Carteira BTC On-Chain (Native SegWit / Bech32)</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-md">
                  BTC Network
                </span>
              </div>

              {/* Bitcoin QR Image */}
              <div className="flex justify-center my-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <img
                  src="/bitcoin.jpeg"
                  alt="QR Code Bitcoin carteira doação - Leonardo Contador Neves"
                  className="w-48 h-48 object-contain rounded-xl shadow-sm border border-white"
                />
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 border border-slate-100 text-xs">
                <span className="text-slate-400 font-semibold block">Endereço da Carteira Bitcoin:</span>
                <p className="text-slate-900 font-mono font-bold break-all select-all text-center sm:text-left bg-white p-2 rounded border border-slate-200">
                  {BTC_ADDRESS}
                </p>
              </div>
            </div>

            <button
              onClick={handleCopyBtc}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-sm ${
                copiedBtc
                  ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                  : 'bg-amber-500 hover:bg-amber-600 text-white hover:shadow-md'
              }`}
            >
              {copiedBtc ? (
                <>
                  <Check size={18} />
                  <span>Endereço BTC Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={18} />
                  <span>Copiar Endereço Bitcoin</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Message & Feedback Section */}
      <div className="bg-slate-900 rounded-2xl p-6 md:p-8 text-white flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl hidden sm:flex shrink-0">
            <MessageSquare size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-xl text-white">Tem dúvidas, sugestões de novos ativos ou parcerias?</h3>
            <p className="text-slate-400 text-sm">
              Envie uma mensagem direta no LinkedIn ou conecte-se para trocar ideias sobre o mercado de renda fixa.
            </p>
          </div>
        </div>
        <a
          href={LINKEDIN_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-md shrink-0 whitespace-nowrap"
        >
          Enviar Mensagem
        </a>
      </div>
    </div>
  );
};

export default Contact;
