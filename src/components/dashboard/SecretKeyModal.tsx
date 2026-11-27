import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Eye, EyeOff, KeyRound, ShieldAlert, X } from 'lucide-react';
import { DsbAuthError } from '../../services/storeClient';

interface SecretKeyModalProps {
  open: boolean;
  title: string;
  badgeLabel?: string;
  description?: string;
  confirmLabel?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  emptyErrorMessage?: string;
  closeOnNonAuthError?: boolean;
  onNonAuthError?: (error: Error) => void;
  onClose: () => void;
  onAuthorize: (masterPassword: string) => Promise<void>;
}

export const SecretKeyModal: React.FC<SecretKeyModalProps> = ({
  open,
  title,
  badgeLabel = 'Autorización de Administrador',
  description,
  confirmLabel = 'Autorizar y guardar',
  inputLabel = 'Tu contraseña de Administrador',
  inputPlaceholder = 'Ingresa tu contraseña de acceso',
  emptyErrorMessage = 'Ingresa tu contraseña de Administrador.',
  closeOnNonAuthError = false,
  onNonAuthError,
  onClose,
  onAuthorize,
}) => {
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const backdropMouseDownRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setMasterPassword('');
      setShowPassword(false);
      setError(null);
      setSubmitting(false);
      backdropMouseDownRef.current = false;
    }
  }, [open]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    backdropMouseDownRef.current = e.target === e.currentTarget;
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const startedOnBackdrop = backdropMouseDownRef.current;
    backdropMouseDownRef.current = false;
    if (!startedOnBackdrop || e.target !== e.currentTarget || submitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!masterPassword) {
      setError(emptyErrorMessage);
      return;
    }

    setSubmitting(true);
    try {
      await onAuthorize(masterPassword);
      setMasterPassword('');
      setError(null);
      onClose();
    } catch (err) {
      if (err instanceof DsbAuthError) {
        setError(err.message);
      } else if (closeOnNonAuthError || onNonAuthError) {
        const normalizedErr =
          err instanceof Error ? err : new Error('No se pudo completar la operación.');
        setMasterPassword('');
        setError(null);
        onNonAuthError?.(normalizedErr);
        onClose();
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Contraseña de Administrador incorrecta o error de autorización.'
        );
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
          aria-labelledby="secret-key-modal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#120804]/78 px-3 sm:px-4 py-3 sm:py-6 backdrop-blur-sm overflow-y-auto"
          onMouseDown={handleBackdropMouseDown}
          onClick={handleBackdropClick}
        >
          <motion.form
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            noValidate
            autoComplete="off"
            className="relative w-full max-w-[440px] max-h-[90dvh] overflow-y-auto rounded-[22px] sm:rounded-[28px] border border-[#C88A2B]/55 bg-gradient-to-b from-[#23140D] via-[#1A0E08] to-[#120804] p-4 sm:p-6 text-[#FFFDF9] shadow-[0_32px_80px_-14px_rgba(0,0,0,0.85)] space-y-4"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#8C3318] via-[#F4CA73] to-[#C88A2B]" />

            <div className="flex items-start justify-between gap-2.5 sm:gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-[#F4CA73]/40 bg-[#F4CA73]/15 text-[#F4CA73]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#F4CA73] block">
                    {badgeLabel}
                  </span>
                  <h3 id="secret-key-modal-title" className="font-serif text-base sm:text-xl font-bold text-white leading-snug break-words">
                    {title}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handleClose}
                aria-label="Cerrar autorización"
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#C8B29A] hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {description && (
              <p className="text-xs leading-relaxed text-[#E3CEB6] break-words">{description}</p>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="secret-key-modal-input"
                className="flex items-center gap-1.5 text-xs font-bold text-[#F4CA73]"
              >
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                {inputLabel}
              </label>
              <div className="relative">
                <input
                  id="secret-key-modal-input"
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  disabled={submitting}
                  value={masterPassword}
                  onChange={(e) => {
                    setMasterPassword(e.target.value);
                    setError(null);
                  }}
                  placeholder={inputPlaceholder}
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
                disabled={submitting}
                onClick={handleClose}
                className="min-h-[44px] w-full sm:w-auto rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-[#EAD5BC] hover:bg-white/10 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                data-preserve-surface="true"
                className="inline-flex min-h-[44px] w-full sm:w-auto items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] px-5 py-2 text-xs font-bold text-[#1A0E08] shadow-lg hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
              >
                <KeyRound className="h-3.5 w-3.5" />
                {submitting ? 'Verificando...' : confirmLabel}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
