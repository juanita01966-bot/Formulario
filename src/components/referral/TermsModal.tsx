import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ShieldCheck, X } from 'lucide-react';

interface TermsModalProps {
  open: boolean;
  onClose: () => void;
  hostTitle: string;
}

export const TermsModal: React.FC<TermsModalProps> = ({ open, onClose, hostTitle }) => {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex min-h-[100dvh] items-center justify-center p-3 sm:p-4 bg-[#1c1009]/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-lg max-h-[86dvh] overflow-hidden rounded-[24px] sm:rounded-3xl bg-[#FFFDF9] border border-[#E6D5BF] shadow-2xl flex flex-col"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4 border-b border-[#EFE3D2] bg-[#FAF3E8]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[#B84A27]">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-serif text-base sm:text-lg font-semibold text-[#22150E] truncate">
                    Términos y Condiciones
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#7B5D4A] truncate">Activa tu Experiencia · Edición Otoño</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#7B5D4A] hover:bg-amber-100/70 hover:text-[#22150E] transition-colors cursor-pointer"
                aria-label="Cerrar términos y condiciones"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5 space-y-3.5 text-[13.5px] sm:text-sm leading-relaxed text-[#4E382B]">
              <p>
                <strong className="text-[#22150E]">1. Organizador de la experiencia:</strong> La presente dinámica
                promocional es coordinada por el distribuidor autorizado independiente{' '}
                <strong className="text-[#22150E]">{hostTitle}</strong>, en colaboración con la experiencia culinaria de
                productos <strong className="text-[#22150E]">Royal Prestige</strong> (Hy Cite Enterprises, LLC) gestionada
                mediante Métricas Ciprian.
              </p>
              <p>
                <strong className="text-[#22150E]">2. Naturaleza del obsequio:</strong> No constituye un sorteo ni juego
                de azar. Los obsequios de cocina disponibles son pre-asignados según inventario activo del programa y se
                revelan mediante las tarjetas interactivas de otoño al completar el registro.
              </p>
              <p>
                <strong className="text-[#22150E]">3. Requisitos de elegibilidad:</strong> Participación exclusiva para
                personas mayores de 18 años residentes dentro del área de cobertura. Se otorga un (1) obsequio por
                hogar, participante y número telefónico válido, sin costo ni obligación de compra.
              </p>
              <p>
                <strong className="text-[#22150E]">4. Condición de entrega:</strong> Para validar el código de reclamo y
                recibir físicamente el obsequio de cocina revelado, es requisito recibir la demostración culinaria
                presencial (“Show de Cocina”) coordinada previamente con el asesor autorizado vía llamada telefónica,
                SMS o WhatsApp.
              </p>
              <p>
                <strong className="text-[#22150E]">5. Protección de datos:</strong> Al marcar la casilla de autorización,
                consientes el uso de tu nombre y teléfono exclusivamente para validar tu participación, confirmar tu
                obsequio y agendar la entrega presencial de la experiencia.
              </p>
            </div>

            <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-t border-[#EFE3D2] bg-[#FAF3E8]/70 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#22150E] text-[#FAF3E8] text-sm font-semibold hover:bg-[#3A2418] transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
