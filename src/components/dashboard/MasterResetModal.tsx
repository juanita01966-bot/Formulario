import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Eye, EyeOff, RotateCcw, ShieldAlert, Trash2, X } from 'lucide-react';
import { DsbAuthError } from '../../services/storeClient';

interface MasterResetModalProps {
  open: boolean;
  onClose: () => void;
  onConfirmReset: (masterPassword: string, resetCatalogAndSettings: boolean) => Promise<void>;
}

export const MasterResetModal: React.FC<MasterResetModalProps> = ({
  open,
  onClose,
  onConfirmReset,
}) => {
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetCatalogAndSettings, setResetCatalogAndSettings] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMasterPassword('');
      setShowPassword(false);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const handleClose = () => {
    if (submitting) return;
    setMasterPassword('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!masterPassword) {
      setError('Ingresa tu contraseña de Administrador para confirmar el reinicio.');
      return;
    }

    setSubmitting(true);
    try {
      await onConfirmReset(masterPassword, resetCatalogAndSettings);
      setMasterPassword('');
      setError(null);
      onClose();
    } catch (err) {
      if (err instanceof DsbAuthError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'No se pudo autorizar el reinicio.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="master-reset-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#120804]/78 px-3 sm:px-4 py-3 sm:py-6 backdrop-blur-sm sm:backdrop-blur-md overflow-y-auto"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[460px] max-h-[90dvh] overflow-y-auto rounded-[22px] sm:rounded-[28px] border border-[#C88A2B]/50 bg-gradient-to-b from-[#23140D] via-[#1A0E08] to-[#120804] p-4 sm:p-6 text-[#FFFDF9] shadow-[0_32px_80px_-14px_rgba(0,0,0,0.85)]"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8C3318] via-[#F4CA73] to-[#C88A2B]" />

            <div className="flex items-start justify-between gap-2.5 sm:gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-rose-400/35 bg-rose-500/15 text-rose-300">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] sm:tracking-[0.16em] text-[#F4CA73] block">
                    Autorización de Administrador
                  </span>
                  <h2 id="master-reset-title" className="font-serif text-base sm:text-xl font-bold text-white leading-snug break-words">
                    Reiniciar Métricas y Todo desde 0
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                aria-label="Cerrar modal"
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl p-1.5 text-[#C8B29A] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-[#E3CEB6]">
              Esta acción pondrá en <strong className="text-white">0</strong> todas las métricas del panel
              (prospectos/leads, llamadas, citas, demos, órdenes, ingresos e historial de códigos QR).
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4" autoComplete="off">
              <label className="flex min-h-[44px] items-start gap-2.5 rounded-2xl border border-[#F4CA73]/25 bg-white/[0.04] p-3 text-xs text-[#F3E2CE] cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetCatalogAndSettings}
                  onChange={(e) => setResetCatalogAndSettings(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#C88A2B] accent-[#D4942A]"
                />
                <span>
                  Restaurar también los 9 regalos oficiales Royal Prestige, orden aleatorio y
                  configuración predeterminada.
                </span>
              </label>

              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-bold text-[#F4CA73]">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Tu contraseña de Administrador
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoFocus
                    disabled={submitting}
                    value={masterPassword}
                    onChange={(e) => {
                      setMasterPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="Ingresa tu contraseña de acceso"
                    className="w-full min-h-[44px] rounded-xl border border-[#F4CA73]/40 bg-[#110804] pl-3.5 pr-12 py-2.5 text-base sm:text-sm text-white placeholder:text-white/35 focus:border-[#F4CA73] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-white/55 hover:text-[#F4CA73] cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-400/40 bg-rose-950/65 px-3.5 py-2.5 text-xs font-semibold text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="min-h-[44px] w-full sm:w-auto rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-[#EAD5BC] hover:bg-white/10 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#B84A27] via-[#D97706] to-[#B84A27] px-5 py-2 text-xs font-bold text-white shadow-lg hover:brightness-110 transition-all cursor-pointer disabled:opacity-60"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {submitting ? 'Reiniciando a 0...' : 'Autorizar y Reiniciar a 0'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
