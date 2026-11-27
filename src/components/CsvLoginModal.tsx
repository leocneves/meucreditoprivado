import React, { useEffect, useState } from 'react';
import { Lock, CheckCircle2, X, Download, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { captureEvent } from '../utils/posthog';

interface CsvLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessDownload: () => void;
  featureOrigin: string;
  title?: string;
  subtitle?: string;
}

/**
 * Contextual modal prompting free Google authentication right before exporting CSV files.
 * Triggers the queued CSV download immediately after sign-in completes.
 */
export const CsvLoginModal: React.FC<CsvLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccessDownload,
  featureOrigin,
  title = 'Exportação Gratuita em .CSV',
  subtitle = 'Entre com sua conta Google em 1 clique para iniciar o download automaticamente.'
}) => {
  const { loginWithGoogle } = useAuth();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    captureEvent('lead_gate_viewed', {
      feature: featureOrigin,
      title,
      gate_type: 'csv_modal'
    });

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && !isLoggingIn) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, featureOrigin, title, isLoggingIn, onClose]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    captureEvent('lead_gate_login_clicked', {
      feature: featureOrigin,
      title,
      gate_type: 'csv_modal'
    });
    try {
      const loggedUser = await loginWithGoogle(featureOrigin);
      if (loggedUser) {
        onClose();
        onSuccessDownload();
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={() => {
        if (!isLoggingIn) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-login-modal-title"
    >
      <div
        className="relative max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={isLoggingIn}
          aria-label="Fechar janela de login"
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer disabled:opacity-40"
        >
          <X size={18} />
        </button>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-extrabold mb-4 border border-emerald-200 shadow-xs">
          <CheckCircle2 size={14} className="text-emerald-600" />
          <span>100% GRATUITO • DOWNLOAD AUTOMÁTICO</span>
        </div>

        <div className="mx-auto w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20 mb-3">
          <Download size={22} />
        </div>

        <h3 id="csv-login-modal-title" className="text-xl font-black text-slate-900 tracking-tight mb-2">
          {title}
        </h3>
        <p className="text-sm text-slate-600 mb-4 leading-relaxed">
          {subtitle}
        </p>

        <div className="text-left space-y-2 mb-6 bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-blue-600 shrink-0" />
            <span>Download imediato em <strong>.CSV</strong> compatível com Excel e Python</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-blue-600 shrink-0" />
            <span>Libera também <strong>Raio-X do Devedor</strong>, <strong>Dashboard</strong> e <strong>Curva NTN-B</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-emerald-600 shrink-0" />
            <span>Zero assinaturas ou cobranças — acesso livre com Google</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoggingIn}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-sm font-bold shadow-md transition cursor-pointer"
        >
          {isLoggingIn ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Conectando...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continuar com o Google</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
