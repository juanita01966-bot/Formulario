import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Briefcase,
  Calendar,
  Check,
  Download,
  Lock,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  PhoneCall,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import type { GiftItem, Lead, LeadCategory } from '../../types/app';
import { GiftIllustration } from '../gifts/GiftIllustration';
import type { KpiFilterKey } from './KpiGrid';

interface ProspectsManagerProps {
  leads: Lead[];
  gifts: GiftItem[];
  defaultTicketAmount: number;
  activeFilter: KpiFilterKey;
  onFilterChange: (filter: KpiFilterKey) => void;
  onUpdateLead: (
    id: string,
    updates: {
      called?: boolean;
      category?: LeadCategory;
      orderAmount?: number | null;
      notes?: string;
    }
  ) => Promise<void>;
  onCreateManualLead: (payload: {
    name: string;
    phone: string;
    address: string;
    giftId: string;
  }) => Promise<void>;
  onDeleteLead: (id: string) => Promise<void>;
}

const FILTER_PILLS: Array<{ key: KpiFilterKey; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'vip', label: '🔥 Buen Crédito (VIP)' },
  { key: 'pending', label: 'Por llamar' },
  { key: 'called', label: 'Ya llamados' },
  { key: 'cita', label: 'Citas' },
  { key: 'demo', label: 'Demos' },
  { key: 'orden', label: 'Órdenes' },
];

const CATEGORIES: Array<{
  id: Exclude<LeadCategory, 'none'>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
}> = [
  {
    id: 'cita',
    label: 'Cita',
    icon: Calendar,
    activeClass: 'bg-rose-600 text-white shadow-sm',
  },
  {
    id: 'demo',
    label: 'Demo',
    icon: Briefcase,
    activeClass: 'bg-sky-600 text-white shadow-sm',
  },
  {
    id: 'orden',
    label: 'Orden',
    icon: Package,
    activeClass: 'bg-emerald-600 text-white shadow-sm',
  },
];

function formatRelativeOrDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export const ProspectsManager: React.FC<ProspectsManagerProps> = ({
  leads,
  gifts,
  defaultTicketAmount,
  activeFilter,
  onFilterChange,
  onUpdateLead,
  onCreateManualLead,
  onDeleteLead,
}) => {
  const [search, setSearch] = useState('');
  const [lockedHintId, setLockedHintId] = useState<string | null>(null);
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  const [manualGiftId, setManualGiftId] = useState(gifts[0]?.id || '');

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (activeFilter === 'vip' && lead.qualification?.tier !== 'alto') return false;
      if (activeFilter === 'pending' && lead.called) return false;
      if (activeFilter === 'called' && !lead.called) return false;
      if (activeFilter === 'cita' && lead.category !== 'cita') return false;
      if (activeFilter === 'demo' && lead.category !== 'demo') return false;
      if (activeFilter === 'orden' && lead.category !== 'orden') return false;

      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q) ||
        (lead.address || '').toLowerCase().includes(q) ||
        lead.claimCode.toLowerCase().includes(q) ||
        (lead.giftName || '').toLowerCase().includes(q)
      );
    });
  }, [leads, activeFilter, search]);

  const handleToggleCalled = async (lead: Lead) => {
    await onUpdateLead(lead.id, { called: !lead.called });
    setLockedHintId(null);
  };

  const handleCategoryClick = async (lead: Lead, cat: Exclude<LeadCategory, 'none'>) => {
    if (!lead.called) {
      setLockedHintId(lead.id);
      window.setTimeout(() => setLockedHintId((cur) => (cur === lead.id ? null : cur)), 2200);
      return;
    }

    const nextCategory: LeadCategory = lead.category === cat ? 'none' : cat;
    await onUpdateLead(lead.id, {
      category: nextCategory,
      orderAmount: nextCategory === 'orden' ? lead.orderAmount ?? defaultTicketAmount : null,
    });
  };

  const handleSaveOrderAmount = async (lead: Lead) => {
    const raw = amountDraft[lead.id];
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    await onUpdateLead(lead.id, { orderAmount: parsed });
  };

  const handleSaveNotes = async (lead: Lead) => {
    const nextNotes = notesDraft[lead.id] ?? lead.notes;
    await onUpdateLead(lead.id, { notes: nextNotes });
    setExpandedNotesId(null);
  };

  const handleExportCsv = () => {
    const headers = [
      'Nombre',
      'Telefono',
      'Direccion',
      'Regalo',
      'Codigo',
      'Calificacion',
      'Puntaje',
      'EstadoMarca',
      'ValoracionSalud',
      'ProductoInteres',
      'Llamado',
      'Categoria',
      'MontoOrden',
      'Fecha',
      'Notas',
    ];
    const rows = filteredLeads.map((l) => [
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.phone}"`,
      `"${(l.address || '').replace(/"/g, '""')}"`,
      `"${(l.giftName || '').replace(/"/g, '""')}"`,
      `"${l.claimCode}"`,
      `"${l.qualification?.tier || ''}"`,
      l.qualification?.score ?? '',
      `"${(l.qualification?.creditProfile || '').replace(/"/g, '""')}"`,
      `"${(l.qualification?.housingStatus || '').replace(/"/g, '""')}"`,
      `"${(l.qualification?.investmentPriority || '').replace(/"/g, '""')}"`,
      l.called ? 'Si' : 'No',
      l.category,
      l.orderAmount ?? '',
      l.createdAt,
      `"${(l.notes || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `metricas-ciprian-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualName.trim().length < 2 || manualPhone.replace(/\D/g, '').length < 7) return;
    await onCreateManualLead({
      name: manualName.trim(),
      phone: manualPhone.trim(),
      address: manualAddress.trim(),
      giftId: manualGiftId || gifts[0]?.id || '',
    });
    setManualName('');
    setManualPhone('');
    setManualAddress('');
    setManualOpen(false);
  };

  return (
    <section className="rounded-[26px] bg-[#FFFDF9] border border-[#E6D5BF]/90 p-4 sm:p-6 shadow-[0_14px_34px_-16px_rgba(34,21,14,0.12)]">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#EFE3D2]">
        <div>
          <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#22150E]">
            Prospectos del Show de Cocina
          </h2>
          <p className="text-xs sm:text-sm text-[#7B5D4A]">
            Marca el check de llamada realizada para desbloquear la clasificación en Cita, Demo u Orden.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#22150E] px-4 py-2 text-xs font-semibold text-[#FAF3E8] hover:bg-[#3A2418] transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Agregar prospecto
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#DFCBB3] bg-[#FAF3E8] px-3.5 py-2 text-xs font-semibold text-[#594133] hover:bg-[#F3E4CE] transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* Search & Filter Chips */}
      <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9B816E]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, regalo o código..."
            className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] py-2.5 pl-10 pr-4 text-sm text-[#22150E] placeholder:text-[#9D8370] focus:border-[#B84A27] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_PILLS.map((pill) => {
            const active = activeFilter === pill.key;
            return (
              <button
                key={pill.key}
                type="button"
                onClick={() => onFilterChange(pill.key)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-[#B84A27] text-white shadow-sm'
                    : 'bg-[#FAF3E8] text-[#6E5341] hover:bg-[#F0E1CC]'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Leads List */}
      <div className="mt-5 space-y-3">
        <AnimatePresence mode="popLayout">
          {filteredLeads.length === 0 ? (
            <motion.div
              key="empty-leads"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-dashed border-[#DFCBB3] bg-[#FAF3E8]/40 py-12 text-center"
            >
              <p className="font-serif text-lg font-semibold text-[#594133]">Sin prospectos en esta vista</p>
              <p className="mt-1 text-xs text-[#8B6F5B]">
                Cuando alguien complete el formulario público aparecerá automáticamente aquí.
              </p>
            </motion.div>
          ) : (
            filteredLeads.map((lead) => {
              const matchedGift = gifts.find((g) => g.id === lead.giftId);
              const showLockHint = lockedHintId === lead.id;
              const notesOpen = expandedNotesId === lead.id;
              const cleanTel = lead.phone.replace(/[^\d+]/g, '');
              const whatsappUrl = `https://wa.me/${cleanTel.replace(/^\+/, '')}?text=${encodeURIComponent(
                `Hola ${lead.name}, te saludo de Royal Prestige / Show de Cocina respecto a tu obsequio "${lead.giftName || 'regalo de otoño'}" (${lead.claimCode}).`
              )}`;

              return (
                <motion.div
                  layout
                  key={lead.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25 }}
                  className={`rounded-2xl border p-4 transition-colors ${
                    lead.called
                      ? 'border-[#DFCBB3] bg-white'
                      : 'border-amber-300/90 bg-gradient-to-r from-[#FFFDF7] to-[#FEF7E8]'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Person & Revealed Gift */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FAF3E8] border border-[#E6D5BF]">
                        <GiftIllustration
                          visualKey={matchedGift?.visualKey || lead.giftVisualKey || 'cutlery'}
                          customImageUrl={matchedGift?.customImageUrl}
                          accentColor={matchedGift?.accentColor || '#C88A2B'}
                          size={34}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[15px] font-bold text-[#22150E] truncate">{lead.name}</h3>
                          <span className="rounded-md bg-[#FAF0E0] border border-[#E6C99E] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#8C4A19] tabular-nums">
                            {lead.claimCode}
                          </span>
                          {!lead.called && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                              Nuevo
                            </span>
                          )}
                          {lead.qualification && (
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide border ${
                                lead.qualification.tier === 'alto'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : lead.qualification.tier === 'medio'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-stone-100 text-stone-700 border-stone-200'
                              }`}
                            >
                              {lead.qualification.tier === 'alto'
                                ? `🔥 Buen Crédito · Alto Potencial (${lead.qualification.score} pts)`
                                : lead.qualification.tier === 'medio'
                                  ? `⭐ Crédito Calificable (${lead.qualification.score} pts)`
                                  : `🌱 Potencial Básico (${lead.qualification.score} pts)`}
                            </span>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#6E5341]">
                          <span className="font-mono tabular-nums font-medium text-[#22150E]">{lead.phone}</span>
                          <span>·</span>
                          <span className="font-semibold text-[#8C3318]">
                            Regalo: {lead.giftName || 'Pendiente por destapar'}
                          </span>
                          <span>·</span>
                          <span>{formatRelativeOrDate(lead.createdAt)}</span>
                        </div>

                        {lead.address && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-[#5C4332]">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#9E4725]" />
                            <span className="truncate">{lead.address}</span>
                          </div>
                        )}

                        {lead.qualification && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="rounded-lg bg-[#FAF3E8] border border-[#EAD9C2] px-2 py-0.5 text-[#4E382B] font-medium">
                              {lead.qualification.creditProfile}
                            </span>
                            <span className="rounded-lg bg-[#FAF3E8] border border-[#EAD9C2] px-2 py-0.5 text-[#4E382B] font-medium">
                              {lead.qualification.housingStatus}
                            </span>
                            <span className="rounded-lg bg-[#FAF3E8] border border-[#EAD9C2] px-2 py-0.5 text-[#4E382B] font-medium">
                              {lead.qualification.investmentPriority}
                            </span>
                          </div>
                        )}

                        {/* Quick contact & notes bar */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <a
                            href={`tel:${cleanTel}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E6D5BF] bg-[#FAF3E8]/70 px-2.5 py-1 text-[11px] font-semibold text-[#4E382B] hover:bg-[#F3E4CE] transition-colors"
                          >
                            <Phone className="h-3 w-3 text-[#B84A27]" />
                            Llamar
                          </a>
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                          >
                            <MessageCircle className="h-3 w-3" />
                            WhatsApp
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedNotesId(notesOpen ? null : lead.id);
                              setNotesDraft((prev) => ({ ...prev, [lead.id]: lead.notes }));
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E6D5BF] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#6E5341] hover:bg-[#FAF3E8] transition-colors cursor-pointer"
                          >
                            <StickyNote className="h-3 w-3" />
                            {lead.notes ? 'Ver nota' : 'Nota'}
                          </button>

                          {confirmDeleteId === lead.id ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-2 py-0.5 text-[11px]">
                              <button
                                type="button"
                                onClick={() => onDeleteLead(lead.id)}
                                className="font-bold text-red-700 hover:underline cursor-pointer"
                              >
                                Confirmar eliminar
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-[#6E5341] hover:text-[#22150E] cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(lead.id)}
                              className="inline-flex items-center rounded-lg p-1 text-[#A48A77] hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                              title="Eliminar prospecto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Called Check + 3 Categories Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
                      {/* Check "Ya se llamó" */}
                      <motion.button
                        type="button"
                        onClick={() => handleToggleCalled(lead)}
                        animate={showLockHint ? { scale: [1, 1.07, 1], boxShadow: '0 0 0 4px rgba(184,74,39,0.28)' } : {}}
                        transition={{ duration: 0.45 }}
                        className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold border transition-all cursor-pointer ${
                          lead.called
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            : 'bg-[#FAF3E8] border-[#D8B994] text-[#594133] hover:bg-amber-100/70'
                        }`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border ${
                            lead.called
                              ? 'border-white bg-white/20 text-white'
                              : 'border-[#B89D86] bg-white'
                          }`}
                        >
                          {lead.called && <Check className="h-3 w-3 stroke-[3]" />}
                        </span>
                        <PhoneCall className="h-3.5 w-3.5" />
                        <span>{lead.called ? 'Ya se llamó' : 'Marcar llamado'}</span>
                      </motion.button>

                      {/* 3 Categories Segmented Control */}
                      <div className="relative">
                        <div
                          className={`inline-flex items-center rounded-xl p-1 border transition-opacity ${
                            lead.called
                              ? 'bg-[#FAF3E8] border-[#E3D0B8]'
                              : 'bg-stone-100 border-stone-200 opacity-60'
                          }`}
                        >
                          {CATEGORIES.map((cat) => {
                            const Icon = cat.icon;
                            const isSelected = lead.category === cat.id;
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleCategoryClick(lead, cat.id)}
                                title={
                                  lead.called
                                    ? `Asignar a ${cat.label}`
                                    : 'Marca primero el check de llamada para clasificar'
                                }
                                className={`relative inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                                  isSelected
                                    ? cat.activeClass
                                    : 'text-[#594133] hover:bg-white/70'
                                }`}
                              >
                                {!lead.called ? (
                                  <Lock className="h-3 w-3 opacity-70" />
                                ) : (
                                  <Icon className="h-3.5 w-3.5" />
                                )}
                                <span>{cat.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        <AnimatePresence>
                          {showLockHint && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              className="absolute right-0 -bottom-7 z-20 whitespace-nowrap rounded-lg bg-[#22150E] px-2.5 py-1 text-[10px] font-semibold text-amber-200 shadow-lg"
                            >
                              Primero marca el check “Ya se llamó”
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Order amount editor when category === 'orden' */}
                  {lead.category === 'orden' && (
                    <div className="mt-3 pt-3 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-3 bg-emerald-50/50 rounded-xl px-3 py-2">
                      <span className="text-xs font-semibold text-emerald-900">
                        Monto de la orden (actualiza Ticket Promedio):
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-800">$</span>
                        <input
                          type="number"
                          min={0}
                          value={amountDraft[lead.id] ?? String(lead.orderAmount ?? defaultTicketAmount)}
                          onChange={(e) =>
                            setAmountDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))
                          }
                          className="w-28 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-mono font-bold text-[#22150E] tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveOrderAmount(lead)}
                          className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expandable Notes */}
                  <AnimatePresence>
                    {notesOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 pt-3 border-t border-[#EFE3D2] flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            value={notesDraft[lead.id] ?? ''}
                            onChange={(e) =>
                              setNotesDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))
                            }
                            placeholder="Escribe notas de la llamada, dirección o fecha de cita..."
                            className="flex-1 rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-xs text-[#22150E] focus:bg-white focus:border-[#B84A27] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveNotes(lead)}
                            className="rounded-xl bg-[#22150E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3A2418] cursor-pointer"
                          >
                            Guardar nota
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Modal: Manual Lead Registration */}
      <AnimatePresence>
        {manualOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#1c1009]/55 backdrop-blur-sm p-4"
            onClick={() => setManualOpen(false)}
          >
            <motion.form
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              onSubmit={handleManualSubmit}
              className="w-full max-w-md rounded-3xl bg-[#FFFDF9] border border-[#E6D5BF] p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl font-bold text-[#22150E]">Nuevo prospecto manual</h3>
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  className="rounded-full p-1 text-[#7B5D4A] hover:bg-[#FAF3E8]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1">Nombre completo</label>
                <input
                  type="text"
                  required
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Ej. Laura Gómez"
                  className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1">Teléfono</label>
                <input
                  type="tel"
                  required
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="Ej. +52 55 1234 5678"
                  className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1">Dirección</label>
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="Ej. Av. Reforma 120, Col. Centro"
                  className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#594133] mb-1">Regalo asignado</label>
                <select
                  value={manualGiftId}
                  onChange={(e) => setManualGiftId(e.target.value)}
                  className="w-full rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-sm focus:bg-white focus:border-[#B84A27] focus:outline-none"
                >
                  {gifts.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setManualOpen(false)}
                  className="rounded-full px-4 py-2 text-xs font-semibold text-[#6E5341] hover:bg-[#FAF3E8] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-full bg-[#22150E] px-5 py-2 text-xs font-semibold text-[#FAF3E8] hover:bg-[#3A2418] cursor-pointer"
                >
                  Guardar prospecto
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};
