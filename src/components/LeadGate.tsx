import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';

interface LeadGateProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  featureOrigin?: string;
}

export const LeadGate: React.FC<LeadGateProps> = ({
  children,
  title = 'Desbloqueie o Conteúdo Completo',
  subtitle = 'Acesso 100% gratuito e instantâneo com sua conta Google.',
  featureOrigin = 'lead_gate'
}) => {
  const { user, loading, isConfigured, loginWithGoogle } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);

  // Se o Firebase não estiver configurado no ambiente de dev, permite ver sem quebrar
  if (!isConfigured) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
        <Loader2 className="animate-spin mb-3 text-blue-600" size={32} />
        <p className="text-sm font-medium">Verificando acesso...</p>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await loginWithGoogle(featureOrigin);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="relative my-4">
      {/* Conteúdo com efeito teaser/blur por baixo */}
      <div className="relative max-h-[460px] overflow-hidden select-none pointer-events-none filter blur-[4px] opacity-30 transition-all">
        {children}
      </div>

      {/* Card de Conversão / Login flutuante por cima */}
      <div className="absolute inset-0 flex items-center justify-center p-4 bg-gradient-to-t from-slate-50/90 via-slate-50/60 to-transparent">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 sm:p-8 text-center backdrop-blur-md">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-4 border border-blue-100 shadow-xs">
            <Sparkles size={14} className="text-blue-600" />
            <span>Ferramenta Exclusiva FixData</span>
          </div>

          {/* Ícone de Cadeado */}
          <div className="mx-auto w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 mb-4">
            <Lock size={22} />
          </div>

          {/* Título & Subtítulo */}
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2">
            {title}
          </h3>
          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            {subtitle}
          </p>

          {/* Benefícios */}
          <div className="text-left space-y-2.5 mb-6 bg-slate-50/80 rounded-xl p-3.5 border border-slate-100 text-xs sm:text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              <span>Acesso ilimitado ao <strong>Raio-X de Devedores</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              <span>Curvas de juros NTN-B e Spreads em tempo real</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              <span>100% gratuito para investidores e analistas</span>
            </div>
          </div>

          {/* Botão Entrar com Google */}
          <button
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-800 font-bold py-3 px-5 rounded-xl border border-slate-300 shadow-sm hover:shadow transition-all duration-150 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          >
            {isLoggingIn ? (
              <Loader2 className="animate-spin text-blue-600" size={20} />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span className="text-sm sm:text-base">Continuar com o Google</span>
          </button>

          <p className="mt-4 text-[11px] text-slate-400">
            Não enviamos spam. Seus dados cadastrais permanecem seguros.
          </p>
        </div>
      </div>
    </div>
  );
};
