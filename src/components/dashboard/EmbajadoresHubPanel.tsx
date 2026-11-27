import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit3,
  Eye,
  KeyRound,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Plus,
  QrCode,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { create as createQrMatrix, type QRCode as QrCodeMatrix } from 'qrcode';
import type {
  AppState,
  Lead,
  QrCodeRecord,
  QrDotShape,
  QrStyleId,
  ReferralPartner,
  ReferralVisitEvent,
  UserAccount,
} from '../../types/app';
import {
  createEmbajadorRemote,
  deleteEmbajadorRemote,
  updateEmbajadorRemote,
} from '../../services/storeClient';
import {
  buildReferralUrl,
  buildWhatsAppShareUrl,
  downloadReferralQrPng,
  LOGO_PUBLIC_PATH,
  normalizeReferralCodeInput,
  REFERRAL_QR_THEMES,
  sanitizeReferralCodeDraft,
  suggestReferralCodeFromName,
} from './referralQrExport';
import { AmbassadorAvatar } from '../shared/AmbassadorAvatar';
import { AvatarPickerField } from './AvatarPickerField';
import { validateAvatarUrlInput } from '../../utils/avatarImageUtils';
import { getRoleTheme } from './roleTheme';
import type { DashboardSurfaceTheme } from './surfaceTheme';

export interface EmbajadoresHubPanelProps {
  mode: 'vendedor' | 'admin';
  currentUser?: {
    userId?: string;
    displayName?: string;
    username?: string;
    tag?: string;
  } | null;
  referrers: ReferralPartner[];
  accounts?: UserAccount[];
  leads: Lead[];
  qrHistory?: QrCodeRecord[];
  visitLog?: ReferralVisitEvent[];
  defaultOriginUrl: string;
  surfaceTheme?: DashboardSurfaceTheme;
  onStateUpdated: (state: AppState) => void;
}

type IdentityTab = 'emoji' | 'image';
type SortMetric = 'prospects' | 'ordenes' | 'demos' | 'citas' | 'visits';

interface EmbajadorStylePreset {
  id: QrStyleId;
  name: string;
  foregroundColor: string;
  backgroundColor: string;
  dotShape: QrDotShape;
  ringColor: string;
}

const QR_STYLE_PRESETS: EmbajadorStylePreset[] = [
  {
    id: 'classic-gold',
    name: 'Dorado Ciprian',
    foregroundColor: '#22150E',
    backgroundColor: '#FFF9ED',
    dotShape: 'rounded',
    ringColor: '#C88A2B',
  },
  {
    id: 'obsidian-dots',
    name: 'Obsidiana & Oro',
    foregroundColor: '#F4CA73',
    backgroundColor: '#16100C',
    dotShape: 'dots',
    ringColor: '#C88A2B',
  },
  {
    id: 'ivory-rounded',
    name: 'Marfil Minimal',
    foregroundColor: '#1E1B18',
    backgroundColor: '#FFFFFF',
    dotShape: 'rounded',
    ringColor: '#A2683A',
  },
  {
    id: 'emerald-heritage',
    name: 'Esmeralda Royal',
    foregroundColor: '#234734',
    backgroundColor: '#FAFDF9',
    dotShape: 'square',
    ringColor: '#3D6B52',
  },
  {
    id: 'ruby-atelier',
    name: 'Borgoña Otoño',
    foregroundColor: '#7E2B14',
    backgroundColor: '#FFF9F5',
    dotShape: 'dots',
    ringColor: '#B84A27',
  },
];

const CURATED_EMOJIS: string[] = [
  '🌟',
  '👑',
  '💎',
  '🔥',
  '🏆',
  '🎯',
  '💐',
  '✨',
  '🦁',
  '🦅',
  '🌹',
  '⚡',
  '🎖️',
  '🚀',
  '💫',
  '🌿',
  '🏅',
  '🤝',
  '☀️',
  '🦋',
  '🎉',
  '💼',
  '❤️',
  '🫶',
];

const SORT_OPTIONS: Array<{ id: SortMetric; label: string; unit: string }> = [
  { id: 'prospects', label: 'Prospectos', unit: 'prospectos' },
  { id: 'ordenes', label: 'Órdenes', unit: 'órdenes' },
  { id: 'demos', label: 'Demos', unit: 'demos' },
  { id: 'citas', label: 'Citas', unit: 'citas' },
  { id: 'visits', label: 'Visitas QR', unit: 'visitas' },
];

const QR_QUIET_MARGIN = 3;

function isInFinderPattern(row: number, col: number, size: number): boolean {
  return (
    (row < 7 && col < 7) ||
    (row < 7 && col >= size - 7) ||
    (row >= size - 7 && col < 7)
  );
}

function isInCenterSafeZone(row: number, col: number, size: number): boolean {
  const center = size / 2;
  const clearRadius = size * 0.132 + 0.55;
  return Math.hypot(col + 0.5 - center, row + 0.5 - center) < clearRadius;
}

function roundedSquarePath(x: number, y: number, w: number, r: number): string {
  const s = Number(w.toFixed(3));
  const cr = Number(Math.min(r, w / 2).toFixed(3));
  const x0 = Number(x.toFixed(3));
  const y0 = Number(y.toFixed(3));
  const x1 = Number((x + s).toFixed(3));
  const y1 = Number((y + s).toFixed(3));
  return (
    `M${(x0 + cr).toFixed(3)},${y0}` +
    `H${(x1 - cr).toFixed(3)}` +
    `A${cr},${cr} 0 0 1 ${x1},${(y0 + cr).toFixed(3)}` +
    `V${(y1 - cr).toFixed(3)}` +
    `A${cr},${cr} 0 0 1 ${(x1 - cr).toFixed(3)},${y1}` +
    `H${(x0 + cr).toFixed(3)}` +
    `A${cr},${cr} 0 0 1 ${x0},${(y1 - cr).toFixed(3)}` +
    `V${(y0 + cr).toFixed(3)}` +
    `A${cr},${cr} 0 0 1 ${(x0 + cr).toFixed(3)},${y0}Z`
  );
}

function buildModulesPath(matrix: QrCodeMatrix, dotShape: QrDotShape): string {
  const size = matrix.modules.size;
  const chunks: string[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!matrix.modules.get(row, col)) continue;
      if (isInFinderPattern(row, col, size)) continue;
      if (isInCenterSafeZone(row, col, size)) continue;
      const x = QR_QUIET_MARGIN + col;
      const y = QR_QUIET_MARGIN + row;
      if (dotShape === 'square') {
        chunks.push(`M${x},${y}h1.015v1.015h-1.015Z`);
      } else if (dotShape === 'rounded') {
        chunks.push(roundedSquarePath(x + 0.06, y + 0.06, 0.88, 0.25));
      } else {
        const cy = (y + 0.5).toFixed(3);
        const r = 0.42;
        chunks.push(
          `M${(x + 0.5 - r).toFixed(3)},${cy}a${r},${r} 0 1 0 ${(r * 2).toFixed(3)},0a${r},${r} 0 1 0 ${(-r * 2).toFixed(3)},0`
        );
      }
    }
  }
  return chunks.join('');
}

const LiveEmbajadorQrSvg: React.FC<{
  targetUrl: string;
  styleId: QrStyleId;
  className?: string;
}> = ({ targetUrl, styleId, className = 'w-full h-full' }) => {
  const rawUid = useId();
  const uid = rawUid.replace(/:/g, '');
  const preset =
    QR_STYLE_PRESETS.find((p) => p.id === styleId) || QR_STYLE_PRESETS[0];

  const computed = useMemo(() => {
    const safeText = targetUrl.trim() || 'https://thecipriancompany.com';
    try {
      const matrix = createQrMatrix(safeText, { errorCorrectionLevel: 'H' });
      const size = matrix.modules.size;
      const totalUnits = size + QR_QUIET_MARGIN * 2;
      const modulesPath = buildModulesPath(matrix, preset.dotShape);
      return { size, totalUnits, modulesPath };
    } catch {
      return null;
    }
  }, [targetUrl, preset.dotShape]);

  if (!computed) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-[#DFCBB3] p-4 text-center text-xs text-[#7B5D4A]">
        QR pendiente
      </div>
    );
  }

  const { size, totalUnits, modulesPath } = computed;
  const center = QR_QUIET_MARGIN + size / 2;
  const medallionRadius = size * 0.118;
  const imgRadius = medallionRadius * 0.87;
  const eyeOuterRx =
    preset.dotShape === 'square'
      ? 0.2
      : preset.dotShape === 'rounded'
      ? 1.65
      : 2.1;

  const finderOrigins: Array<[number, number]> = [
    [QR_QUIET_MARGIN, QR_QUIET_MARGIN],
    [QR_QUIET_MARGIN + size - 7, QR_QUIET_MARGIN],
    [QR_QUIET_MARGIN, QR_QUIET_MARGIN + size - 7],
  ];

  return (
    <svg
      viewBox={`0 0 ${totalUnits} ${totalUnits}`}
      className={className}
      role="img"
      aria-label={`Código QR de embajador para ${targetUrl}`}
    >
      <defs>
        <clipPath id={`emb-qr-clip-${uid}`}>
          <circle cx={center} cy={center} r={imgRadius} />
        </clipPath>
        <linearGradient
          id={`emb-qr-ring-${uid}`}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor={preset.ringColor} />
          <stop offset="100%" stopColor="#8B550E" />
        </linearGradient>
      </defs>

      <rect
        x={0}
        y={0}
        width={totalUnits}
        height={totalUnits}
        fill={preset.backgroundColor}
      />
      <path d={modulesPath} fill={preset.foregroundColor} />

      {finderOrigins.map(([fx, fy], idx) => (
        <g key={idx}>
          <rect
            x={fx + 0.5}
            y={fy + 0.5}
            width={6}
            height={6}
            rx={eyeOuterRx}
            fill="none"
            stroke={preset.foregroundColor}
            strokeWidth={1}
          />
          {preset.dotShape === 'dots' ? (
            <circle
              cx={fx + 3.5}
              cy={fy + 3.5}
              r={1.5}
              fill={preset.foregroundColor}
            />
          ) : (
            <rect
              x={fx + 2}
              y={fy + 2}
              width={3}
              height={3}
              rx={preset.dotShape === 'rounded' ? 0.85 : 0.12}
              fill={preset.foregroundColor}
            />
          )}
        </g>
      ))}

      <g>
        <circle
          cx={center}
          cy={center}
          r={medallionRadius + 0.55}
          fill={preset.backgroundColor}
        />
        <circle
          cx={center}
          cy={center}
          r={medallionRadius}
          fill={preset.backgroundColor}
          stroke={`url(#emb-qr-ring-${uid})`}
          strokeWidth={Math.max(0.32, size * 0.013)}
        />
        <image
          href={LOGO_PUBLIC_PATH}
          x={center - imgRadius}
          y={center - imgRadius}
          width={imgRadius * 2}
          height={imgRadius * 2}
          clipPath={`url(#emb-qr-clip-${uid})`}
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    </svg>
  );
};

interface RankedEmbajadorRow {
  partner: ReferralPartner;
  rank: number;
  prospectsCount: number;
  citasCount: number;
  demosCount: number;
  ordenesCount: number;
  visitsCount: number;
}

function getMetricValue(row: RankedEmbajadorRow, metric: SortMetric): number {
  switch (metric) {
    case 'ordenes':
      return row.ordenesCount;
    case 'demos':
      return row.demosCount;
    case 'citas':
      return row.citasCount;
    case 'visits':
      return row.visitsCount;
    case 'prospects':
    default:
      return row.prospectsCount;
  }
}

function getPodiumBadgeClasses(rank: number): {
  className: string;
  preserveSurface: boolean;
} {
  if (rank === 1) {
    return {
      className:
        'bg-gradient-to-br from-[#FDE68A] via-[#C88A2B] to-[#8B550E] text-[#1A0E08] border border-[#FDE68A]/70 shadow-sm',
      preserveSurface: true,
    };
  }
  if (rank === 2) {
    return {
      className:
        'bg-gradient-to-br from-[#F1F5F9] via-[#CBD5E1] to-[#64748B] text-[#0F172A] border border-white/70 shadow-sm',
      preserveSurface: true,
    };
  }
  if (rank === 3) {
    return {
      className:
        'bg-gradient-to-br from-[#F0C49A] via-[#B87333] to-[#6B3A14] text-[#FFFDF9] border border-[#F0C49A]/50 shadow-sm',
      preserveSurface: true,
    };
  }
  return {
    className:
      'dsb-glass-subtle text-[#594133] border border-[#DFCBB3]',
    preserveSurface: false,
  };
}

export const EmbajadoresHubPanel: React.FC<EmbajadoresHubPanelProps> = ({
  mode,
  currentUser,
  referrers,
  accounts = [],
  leads,
  visitLog = [],
  defaultOriginUrl,
  onStateUpdated,
}) => {
  const roleTheme = getRoleTheme(mode);
  const leftColumnRef = useRef<HTMLDivElement | null>(null);
  const qrPreviewRef = useRef<HTMLDivElement | null>(null);

  const embajadores = useMemo(
    () => referrers.filter((r) => r.partnerType === 'embajador'),
    [referrers]
  );

  const activeVendedores = useMemo(
    () => accounts.filter((a) => a.role === 'vendedor' && a.active),
    [accounts]
  );

  const existingCodesSet = useMemo(
    () =>
      new Set(
        referrers
          .map((r) => normalizeReferralCodeInput(r.code))
          .filter(Boolean)
      ),
    [referrers]
  );

  // Left-column Creator / Editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [identityTab, setIdentityTab] = useState<IdentityTab>('emoji');
  const [formEmoji, setFormEmoji] = useState<string>('🌟');
  const [formAvatarUrl, setFormAvatarUrl] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [formQrStyleId, setFormQrStyleId] = useState<QrStyleId>('classic-gold');
  const [formOwnerVendedorId, setFormOwnerVendedorId] = useState<string>('');
  const [formPhone, setFormPhone] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formBanner, setFormBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Live QR Preview selected partner
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(
    () => embajadores[0]?.id ?? null
  );
  const [previewStyleOverride, setPreviewStyleOverride] =
    useState<QrStyleId | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Right-column filters & actions
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortMetric>('prospects');
  const [vendedorFilter, setVendedorFilter] = useState<string>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingTargetId, setDeletingTargetId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [listBanner, setListBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Keep selectedPreviewId synced when list updates
  useEffect(() => {
    if (selectedPreviewId && embajadores.some((e) => e.id === selectedPreviewId)) {
      return;
    }
    setSelectedPreviewId(embajadores[0]?.id ?? null);
    setPreviewStyleOverride(null);
  }, [embajadores, selectedPreviewId]);

  const editingPartner = useMemo(
    () => (editingId ? embajadores.find((e) => e.id === editingId) || null : null),
    [embajadores, editingId]
  );

  // Auto-suggest code slug while creating unless user manually edited it
  const autoSuggestedCode = useMemo(() => {
    if (!formName.trim()) return '';
    return suggestReferralCodeFromName(formName, existingCodesSet);
  }, [formName, existingCodesSet]);

  const effectiveDraftCode = useMemo(() => {
    const manual = normalizeReferralCodeInput(formCode);
    if (manual) return manual;
    if (editingPartner) return editingPartner.code;
    return autoSuggestedCode || 'EMBAJADOR';
  }, [formCode, editingPartner, autoSuggestedCode]);

  const resetToCreateMode = () => {
    setEditingId(null);
    setFormName('');
    setIdentityTab('emoji');
    setFormEmoji('🌟');
    setFormAvatarUrl('');
    setFormCode('');
    setCodeManuallyEdited(false);
    setFormQrStyleId('classic-gold');
    setFormOwnerVendedorId('');
    setFormPhone('');
    setFormNotes('');
    setShowOptionalDetails(false);
    setFormBanner(null);
  };

  const startEditingPartner = (partner: ReferralPartner) => {
    setEditingId(partner.id);
    setFormName(partner.name);
    const hasAvatar = Boolean(partner.avatarUrl && partner.avatarUrl.trim());
    setIdentityTab(hasAvatar ? 'image' : 'emoji');
    setFormAvatarUrl(partner.avatarUrl || '');
    setFormEmoji(partner.emoji || (hasAvatar ? '' : '🌟'));
    setFormCode(partner.code);
    setCodeManuallyEdited(true);
    setFormQrStyleId(partner.qrStyleId || 'classic-gold');
    setFormOwnerVendedorId(partner.ownerVendedorAccountId || '');
    setFormPhone(partner.phone || '');
    setFormNotes(partner.notes || '');
    setShowOptionalDetails(Boolean(partner.phone || partner.notes));
    setFormBanner(null);
    setSelectedPreviewId(partner.id);
    setPreviewStyleOverride(partner.qrStyleId || 'classic-gold');
    leftColumnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectForPreview = (partner: ReferralPartner) => {
    setSelectedPreviewId(partner.id);
    setPreviewStyleOverride(partner.qrStyleId || 'classic-gold');
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      qrPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormBanner(null);

    const trimmedName = formName.trim();
    if (trimmedName.length < 2) {
      setFormBanner({
        type: 'error',
        text: 'Escribe el nombre del Embajador (mínimo 2 caracteres).',
      });
      return;
    }

    let finalAvatarUrl: string | null = null;
    let finalEmoji: string | null = null;

    if (identityTab === 'image') {
      const check = validateAvatarUrlInput(formAvatarUrl);
      if (!check.ok) {
        setFormBanner({
          type: 'error',
          text: check.error || 'La imagen seleccionada no es válida.',
        });
        return;
      }
      finalAvatarUrl = check.value;
      // Preserve emoji fallback only if no photo was provided
      finalEmoji = finalAvatarUrl ? null : formEmoji.trim() || null;
    } else {
      finalAvatarUrl = null;
      finalEmoji = formEmoji.trim() || null;
    }

    const normalizedCode = normalizeReferralCodeInput(
      codeManuallyEdited ? formCode : formCode || autoSuggestedCode
    );
    const activePreset =
      QR_STYLE_PRESETS.find((p) => p.id === formQrStyleId) ||
      QR_STYLE_PRESETS[0];

    setSubmitting(true);
    try {
      if (editingId) {
        const res = await updateEmbajadorRemote(editingId, {
          name: trimmedName,
          emoji: finalEmoji,
          avatarUrl: finalAvatarUrl,
          ...(normalizedCode ? { code: normalizedCode } : {}),
          qrStyleId: formQrStyleId,
          phone: formPhone.trim(),
          notes: formNotes.trim(),
          ...(mode === 'admin'
            ? { ownerVendedorAccountId: formOwnerVendedorId || null }
            : {}),
        });
        onStateUpdated(res.state);
        setSelectedPreviewId(res.referrer.id);
        setPreviewStyleOverride(res.referrer.qrStyleId || formQrStyleId);
        setFormBanner({
          type: 'success',
          text: `Embajador "${res.referrer.name}" actualizado (?ref=${res.referrer.code}).`,
        });
      } else {
        const codeForUrl = normalizedCode || autoSuggestedCode || 'EMBAJADOR';
        const res = await createEmbajadorRemote({
          name: trimmedName,
          emoji: finalEmoji,
          avatarUrl: finalAvatarUrl,
          ...(normalizedCode ? { code: normalizedCode } : {}),
          qrStyleId: formQrStyleId,
          phone: formPhone.trim() || undefined,
          notes: formNotes.trim() || undefined,
          ...(mode === 'admin'
            ? { ownerVendedorAccountId: formOwnerVendedorId || null }
            : {}),
          createQr: true,
          targetUrl: buildReferralUrl(defaultOriginUrl, codeForUrl),
          dotShape: activePreset.dotShape,
          foregroundColor: activePreset.foregroundColor,
          backgroundColor: activePreset.backgroundColor,
          includeLogo: true,
          frameText: `Invitación de ${trimmedName}`.slice(0, 54),
        });
        onStateUpdated(res.state);
        setSelectedPreviewId(res.referrer.id);
        setPreviewStyleOverride(res.referrer.qrStyleId || formQrStyleId);
        resetToCreateMode();
        setFormBanner({
          type: 'success',
          text: `Embajador "${res.referrer.name}" creado y QR listo (?ref=${res.referrer.code}).`,
        });
      }
    } catch (err) {
      setFormBanner({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudo guardar el Embajador.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Compute live metrics for every embajador
  const allRankedRows = useMemo<RankedEmbajadorRow[]>(() => {
    const base = embajadores.map((partner) => {
      const codeNorm = normalizeReferralCodeInput(partner.code);
      const matchedLeads = leads.filter(
        (lead) =>
          lead.referrerId === partner.id ||
          (Boolean(codeNorm) &&
            normalizeReferralCodeInput(lead.referralCode || '') === codeNorm)
      );
      const visitsFromLog = visitLog.filter(
        (v) =>
          v.referrerId === partner.id ||
          (Boolean(codeNorm) &&
            normalizeReferralCodeInput(v.referralCode) === codeNorm)
      ).length;

      return {
        partner,
        rank: 0,
        prospectsCount: matchedLeads.length,
        citasCount: matchedLeads.filter((l) => l.category === 'cita').length,
        demosCount: matchedLeads.filter((l) => l.category === 'demo').length,
        ordenesCount: matchedLeads.filter((l) => l.category === 'orden').length,
        visitsCount: Math.max(partner.visitsCount || 0, visitsFromLog),
      };
    });

    base.sort((a, b) => {
      const diffPrimary = getMetricValue(b, sortBy) - getMetricValue(a, sortBy);
      if (diffPrimary !== 0) return diffPrimary;
      if (b.ordenesCount !== a.ordenesCount) {
        return b.ordenesCount - a.ordenesCount;
      }
      if (b.visitsCount !== a.visitsCount) {
        return b.visitsCount - a.visitsCount;
      }
      return a.partner.name.localeCompare(b.partner.name, 'es');
    });

    return base.map((row, idx) => ({ ...row, rank: idx + 1 }));
  }, [embajadores, leads, visitLog, sortBy]);

  // Distinct vendedores for Admin filter dropdown
  const vendedorFilterOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const acc of accounts) {
      if (acc.role === 'vendedor') {
        map.set(acc.id, {
          id: acc.id,
          label: `${acc.displayName} (${acc.tag})`,
        });
      }
    }
    for (const emb of embajadores) {
      if (emb.ownerVendedorAccountId && !map.has(emb.ownerVendedorAccountId)) {
        map.set(emb.ownerVendedorAccountId, {
          id: emb.ownerVendedorAccountId,
          label:
            emb.ownerVendedorName ||
            emb.ownerVendedorTag ||
            emb.ownerVendedorAccountId,
        });
      }
    }
    return Array.from(map.values());
  }, [accounts, embajadores]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allRankedRows.filter((row) => {
      if (mode === 'admin' && vendedorFilter !== 'all') {
        if (vendedorFilter === '__direct__') {
          if (row.partner.ownerVendedorAccountId) return false;
        } else if (row.partner.ownerVendedorAccountId !== vendedorFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        row.partner.name.toLowerCase().includes(q) ||
        row.partner.code.toLowerCase().includes(q) ||
        (row.partner.ownerVendedorName || '').toLowerCase().includes(q) ||
        (row.partner.ownerVendedorTag || '').toLowerCase().includes(q)
      );
    });
  }, [allRankedRows, searchQuery, mode, vendedorFilter]);

  const summaryStats = useMemo(() => {
    let activeCount = 0;
    let totalVisits = 0;
    let totalProspects = 0;
    let totalOrdenes = 0;
    let totalDemos = 0;
    for (const row of filteredRows) {
      if (row.partner.active) activeCount += 1;
      totalVisits += row.visitsCount;
      totalProspects += row.prospectsCount;
      totalOrdenes += row.ordenesCount;
      totalDemos += row.demosCount;
    }
    return {
      activeCount,
      totalCount: filteredRows.length,
      totalVisits,
      totalProspects,
      totalOrdenes,
      totalDemos,
    };
  }, [filteredRows]);

  const topMetric = useMemo(() => {
    if (filteredRows.length === 0) return 1;
    return Math.max(
      1,
      ...filteredRows.map((row) => getMetricValue(row, sortBy))
    );
  }, [filteredRows, sortBy]);

  // Active preview subject: selected embajador OR live draft when none selected
  const selectedPreviewPartner = useMemo(
    () =>
      selectedPreviewId
        ? embajadores.find((e) => e.id === selectedPreviewId) || null
        : null,
    [embajadores, selectedPreviewId]
  );

  const previewSubject = useMemo(() => {
    if (selectedPreviewPartner && !editingId) {
      return {
        id: selectedPreviewPartner.id,
        name: selectedPreviewPartner.name,
        code: selectedPreviewPartner.code,
        avatarUrl: selectedPreviewPartner.avatarUrl ?? null,
        emoji: selectedPreviewPartner.emoji ?? null,
        phone: selectedPreviewPartner.phone,
        styleId:
          previewStyleOverride ||
          selectedPreviewPartner.qrStyleId ||
          'classic-gold',
        ownerLabel:
          selectedPreviewPartner.ownerVendedorName ||
          (selectedPreviewPartner.ownerVendedorTag
            ? `Tag ${selectedPreviewPartner.ownerVendedorTag}`
            : mode === 'vendedor'
            ? currentUser?.displayName || 'Tu equipo'
            : 'Ciprian Directo'),
        isDraft: false,
      };
    }

    const ownerAccount =
      mode === 'admin'
        ? accounts.find((a) => a.id === formOwnerVendedorId)
        : null;

    return {
      id: editingPartner?.id || 'draft',
      name: formName.trim() || editingPartner?.name || 'Nuevo Embajador',
      code: effectiveDraftCode,
      avatarUrl: identityTab === 'image' ? formAvatarUrl || null : null,
      emoji: identityTab === 'emoji' ? formEmoji.trim() || null : null,
      phone: formPhone.trim() || undefined,
      styleId: formQrStyleId,
      ownerLabel:
        mode === 'admin'
          ? ownerAccount?.displayName || 'Ciprian Directo'
          : currentUser?.displayName || 'Tu equipo',
      isDraft: !editingPartner,
    };
  }, [
    selectedPreviewPartner,
    editingId,
    previewStyleOverride,
    mode,
    currentUser,
    accounts,
    formOwnerVendedorId,
    editingPartner,
    formName,
    effectiveDraftCode,
    identityTab,
    formAvatarUrl,
    formEmoji,
    formPhone,
    formQrStyleId,
  ]);

  const previewReferralUrl = useMemo(
    () => buildReferralUrl(defaultOriginUrl, previewSubject.code),
    [defaultOriginUrl, previewSubject.code]
  );

  const previewThemeMeta =
    REFERRAL_QR_THEMES[previewSubject.styleId] ||
    REFERRAL_QR_THEMES['classic-gold'];

  const handleCopyLink = async (code: string, key: string) => {
    const url = buildReferralUrl(defaultOriginUrl, code);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(key);
      window.setTimeout(
        () => setCopiedId((cur) => (cur === key ? null : cur)),
        2000
      );
    } catch {
      // Ignore clipboard permission errors
    }
  };

  const handleDownloadPartnerQr = async (subject: {
    id: string;
    name: string;
    code: string;
    avatarUrl?: string | null;
    emoji?: string | null;
    styleId?: QrStyleId;
  }) => {
    setDownloadingId(subject.id);
    try {
      await downloadReferralQrPng({
        partnerName: subject.name,
        code: subject.code,
        referralUrl: buildReferralUrl(defaultOriginUrl, subject.code),
        avatarUrl: subject.avatarUrl ?? null,
        emoji: subject.emoji ?? null,
        styleId: subject.styleId || 'classic-gold',
      });
    } catch (err) {
      setListBanner({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudo exportar la tarjeta QR HD.',
      });
    } finally {
      setDownloadingId((cur) => (cur === subject.id ? null : cur));
    }
  };

  const handleToggleActive = async (partner: ReferralPartner) => {
    setTogglingId(partner.id);
    setListBanner(null);
    try {
      const res = await updateEmbajadorRemote(partner.id, {
        active: !partner.active,
      });
      onStateUpdated(res.state);
      setListBanner({
        type: 'success',
        text: res.referrer.active
          ? `"${res.referrer.name}" reactivado.`
          : `"${res.referrer.name}" pausado temporalmente.`,
      });
    } catch (err) {
      setListBanner({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'No se pudo cambiar el estado del Embajador.',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async (partner: ReferralPartner) => {
    if (!deletePassword.trim()) {
      setDeleteError('Ingresa tu contraseña de Administrador.');
      return;
    }
    setDeletingBusy(true);
    setDeleteError(null);
    try {
      const res = await deleteEmbajadorRemote(partner.id, deletePassword);
      onStateUpdated(res.state);
      if (editingId === partner.id) {
        resetToCreateMode();
      }
      setDeletingTargetId(null);
      setDeletePassword('');
      setListBanner({
        type: 'success',
        text: `Embajador "${partner.name}" eliminado permanentemente.`,
      });
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : 'Contraseña incorrecta o error al eliminar.'
      );
    } finally {
      setDeletingBusy(false);
    }
  };

  const activeSortMeta =
    SORT_OPTIONS.find((s) => s.id === sortBy) || SORT_OPTIONS[0];

  const ownerInactiveForEdit = useMemo(() => {
    if (!formOwnerVendedorId) return null;
    const isActive = activeVendedores.some((v) => v.id === formOwnerVendedorId);
    if (isActive) return null;
    const acc = accounts.find((a) => a.id === formOwnerVendedorId);
    if (acc) return { id: acc.id, label: `${acc.displayName} (inactivo)` };
    if (editingPartner?.ownerVendedorAccountId === formOwnerVendedorId) {
      return {
        id: formOwnerVendedorId,
        label: editingPartner.ownerVendedorName || formOwnerVendedorId,
      };
    }
    return null;
  }, [formOwnerVendedorId, activeVendedores, accounts, editingPartner]);

  return (
    <div className="space-y-4 sm:space-y-5 min-w-0">
      {/* 2-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* LEFT COLUMN (lg:col-span-5): Creador y Estudio QR de Embajadores */}
        <div ref={leftColumnRef} className="lg:col-span-5 space-y-4 min-w-0">
          <section className="relative overflow-hidden dsb-glass rounded-[24px] p-4 sm:p-5 space-y-4">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-1"
              style={{ background: roleTheme.headerStrip }}
            />

            {/* Header & Mode Switch */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  data-preserve-surface="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#FDE68A] shadow-sm border border-white/20"
                  style={{ background: roleTheme.heroGradient }}
                >
                  {editingPartner ? (
                    <Edit3 className="h-4.5 w-4.5" />
                  ) : (
                    <Sparkles className="h-4.5 w-4.5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#7B5D4A]">
                    {editingPartner
                      ? 'Modo Edición'
                      : 'Creador & Estudio QR'}
                  </p>
                  <h3 className="font-serif text-base sm:text-lg font-bold text-[#22150E] truncate">
                    {editingPartner
                      ? `Editando a ${editingPartner.name}`
                      : 'Nuevo Embajador'}
                  </h3>
                </div>
              </div>

              {editingPartner && (
                <button
                  type="button"
                  onClick={resetToCreateMode}
                  className="inline-flex min-h-[38px] items-center gap-1 rounded-full border border-[#DFCBB3] bg-white/80 hover:bg-white px-3 py-1 text-xs font-bold text-[#594133] transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Nombre del Embajador */}
              <div>
                <label
                  htmlFor="embajador-name-input"
                  className="block text-xs font-semibold text-[#594133] mb-1.5"
                >
                  Nombre del Embajador *
                </label>
                <input
                  id="embajador-name-input"
                  type="text"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    setFormBanner(null);
                  }}
                  maxLength={80}
                  placeholder="Ej. María González · Anfitriona VIP"
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 text-base sm:text-sm text-[#22150E] placeholder:text-[#A8917D] focus:bg-white focus:border-[#C88A2B] focus:outline-none transition-colors"
                />
              </div>

              {/* Identidad Visual (Emoji o Imagen) */}
              <div className="dsb-glass-subtle rounded-2xl p-3 sm:p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AmbassadorAvatar
                      name={formName || 'Embajador'}
                      avatarUrl={
                        identityTab === 'image' ? formAvatarUrl || null : null
                      }
                      emoji={
                        identityTab === 'emoji'
                          ? formEmoji.trim() || null
                          : null
                      }
                      size="md"
                      ring="gold"
                    />
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-[#22150E]">
                        Identidad visual
                      </span>
                      <span className="block text-[10.5px] text-[#7B5D4A]">
                        Elige un emoji o sube una foto
                      </span>
                    </div>
                  </div>

                  {/* 2-Tab Pill Toggle */}
                  <div className="inline-flex rounded-full border border-[#DFCBB3] bg-white/75 p-0.5">
                    <button
                      type="button"
                      onClick={() => setIdentityTab('emoji')}
                      data-preserve-surface={
                        identityTab === 'emoji' ? 'true' : undefined
                      }
                      style={
                        identityTab === 'emoji'
                          ? { background: roleTheme.heroGradient }
                          : undefined
                      }
                      className={`min-h-[34px] rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                        identityTab === 'emoji'
                          ? 'text-white shadow-xs'
                          : 'text-[#594133] hover:text-[#22150E]'
                      }`}
                    >
                      Emoji
                    </button>
                    <button
                      type="button"
                      onClick={() => setIdentityTab('image')}
                      data-preserve-surface={
                        identityTab === 'image' ? 'true' : undefined
                      }
                      style={
                        identityTab === 'image'
                          ? { background: roleTheme.heroGradient }
                          : undefined
                      }
                      className={`min-h-[34px] rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                        identityTab === 'image'
                          ? 'text-white shadow-xs'
                          : 'text-[#594133] hover:text-[#22150E]'
                      }`}
                    >
                      Imagen
                    </button>
                  </div>
                </div>

                {identityTab === 'emoji' ? (
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
                      {CURATED_EMOJIS.map((em) => {
                        const isSelected = formEmoji === em;
                        return (
                          <button
                            key={em}
                            type="button"
                            onClick={() => setFormEmoji(em)}
                            aria-label={`Seleccionar emoji ${em}`}
                            aria-pressed={isSelected}
                            className={`flex min-h-[40px] items-center justify-center rounded-xl border text-lg transition-all cursor-pointer ${
                              isSelected
                                ? 'border-[#C88A2B] bg-amber-100/90 ring-2 ring-[#C88A2B]/35 scale-105 shadow-xs'
                                : 'border-[#E6D5BF] bg-white/75 hover:bg-white hover:border-[#C88A2B]/60'
                            }`}
                          >
                            {em}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={formEmoji}
                        onChange={(e) => setFormEmoji(e.target.value.slice(0, 8))}
                        maxLength={8}
                        placeholder="O escribe tu emoji personalizado"
                        aria-label="Emoji personalizado"
                        className="flex-1 min-w-0 min-h-[42px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-2 text-base sm:text-sm text-[#22150E] placeholder:text-[#A8917D] focus:border-[#C88A2B] focus:outline-none"
                      />
                      {formEmoji && (
                        <button
                          type="button"
                          onClick={() => setFormEmoji('')}
                          className="min-h-[42px] shrink-0 rounded-xl border border-[#DFCBB3] bg-white/80 hover:bg-rose-50 px-3 text-xs font-semibold text-[#594133] hover:text-rose-700 transition-colors cursor-pointer"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <AvatarPickerField
                    name={formName || 'Embajador'}
                    value={formAvatarUrl}
                    onChange={setFormAvatarUrl}
                    disabled={submitting}
                    label="Foto de perfil del Embajador (opcional)"
                  />
                )}
              </div>

              {/* Código QR */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                  <label
                    htmlFor="embajador-code-input"
                    className="text-xs font-semibold text-[#594133]"
                  >
                    Código QR (opcional)
                  </label>
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10.5px] font-bold text-emerald-800">
                    ?ref={effectiveDraftCode}
                  </span>
                </div>
                <input
                  id="embajador-code-input"
                  type="text"
                  value={formCode}
                  onChange={(e) => {
                    const cleaned = sanitizeReferralCodeDraft(e.target.value);
                    setFormCode(cleaned);
                    setCodeManuallyEdited(Boolean(cleaned));
                  }}
                  maxLength={32}
                  placeholder={
                    autoSuggestedCode
                      ? `Auto: ${autoSuggestedCode}`
                      : 'Ej. MARIA-VIP (auto si vacío)'
                  }
                  className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3.5 py-2.5 font-mono text-base sm:text-sm uppercase text-[#22150E] placeholder:text-[#A8917D] focus:bg-white focus:border-[#C88A2B] focus:outline-none transition-colors"
                />
              </div>

              {/* Estilo de QR (5 Luxury Presets) */}
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-[#594133]">
                  Estilo de QR
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {QR_STYLE_PRESETS.map((preset) => {
                    const selected = formQrStyleId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setFormQrStyleId(preset.id);
                          setPreviewStyleOverride(preset.id);
                        }}
                        className={`flex min-h-[44px] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all cursor-pointer min-w-0 ${
                          selected
                            ? 'border-[#C88A2B] bg-white ring-2 ring-[#C88A2B]/30 shadow-xs'
                            : 'border-[#E6D5BF] bg-white/65 hover:bg-white'
                        }`}
                      >
                        <span
                          data-preserve-surface="true"
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border"
                          style={{
                            backgroundColor: preset.backgroundColor,
                            borderColor: preset.ringColor,
                          }}
                        >
                          <span
                            className={`h-2.5 w-2.5 ${
                              preset.dotShape === 'dots'
                                ? 'rounded-full'
                                : 'rounded-[3px]'
                            }`}
                            style={{ backgroundColor: preset.foregroundColor }}
                          />
                        </span>
                        <span className="truncate text-[11px] font-bold text-[#22150E] flex-1">
                          {preset.name}
                        </span>
                        {selected && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-[#C88A2B]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Admin-only: Vendedor asignado */}
              {mode === 'admin' && (
                <div>
                  <label
                    htmlFor="embajador-owner-vendedor"
                    className="block text-xs font-semibold text-[#594133] mb-1.5"
                  >
                    Vendedor asignado
                  </label>
                  <select
                    id="embajador-owner-vendedor"
                    value={formOwnerVendedorId}
                    onChange={(e) => setFormOwnerVendedorId(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-2 text-base sm:text-sm font-semibold text-[#22150E] focus:border-[#C88A2B] focus:outline-none"
                  >
                    <option value="">Ciprian Directo (sin vendedor)</option>
                    {ownerInactiveForEdit && (
                      <option value={ownerInactiveForEdit.id}>
                        {ownerInactiveForEdit.label}
                      </option>
                    )}
                    {activeVendedores.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.displayName} (@{v.username}) · {v.tag}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Optional Phone & Notes Collapsible */}
              <div className="border-t border-[#EFE3D2] pt-2">
                <button
                  type="button"
                  onClick={() => setShowOptionalDetails((prev) => !prev)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 text-xs font-semibold text-[#7B5D4A] hover:text-[#22150E] cursor-pointer"
                >
                  {showOptionalDetails ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  Teléfono WhatsApp y notas (opcional)
                </button>

                <AnimatePresence initial={false}>
                  {showOptionalDetails && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5">
                        <div>
                          <label
                            htmlFor="embajador-phone-input"
                            className="block text-[11px] font-semibold text-[#594133] mb-1"
                          >
                            Teléfono (para WhatsApp)
                          </label>
                          <input
                            id="embajador-phone-input"
                            type="tel"
                            value={formPhone}
                            onChange={(e) => setFormPhone(e.target.value)}
                            maxLength={40}
                            placeholder="+1 555 123 4567"
                            className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-base sm:text-sm text-[#22150E] placeholder:text-[#A8917D] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="embajador-notes-input"
                            className="block text-[11px] font-semibold text-[#594133] mb-1"
                          >
                            Notas internas
                          </label>
                          <input
                            id="embajador-notes-input"
                            type="text"
                            value={formNotes}
                            onChange={(e) => setFormNotes(e.target.value)}
                            maxLength={240}
                            placeholder="Ej. Amiga de cocina, evento sábado"
                            className="w-full min-h-[44px] rounded-xl border border-[#DFCBB3] bg-[#FCF8F2] px-3 py-2 text-base sm:text-sm text-[#22150E] placeholder:text-[#A8917D] focus:bg-white focus:border-[#C88A2B] focus:outline-none"
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Form Feedback Banner */}
              <AnimatePresence>
                {formBanner && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={`flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                      formBanner.type === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-rose-200 bg-rose-50 text-rose-900'
                    }`}
                  >
                    {formBanner.type === 'success' ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    )}
                    <span className="min-w-0 break-words">
                      {formBanner.text}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={submitting || formName.trim().length < 2}
                data-preserve-surface="true"
                style={{ background: roleTheme.heroGradient }}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-xs sm:text-sm font-bold text-[#FFFDF9] border border-[#E2C275]/40 shadow-md hover:brightness-110 active:scale-[0.985] transition-all cursor-pointer disabled:opacity-50"
              >
                <QrCode className="h-4 w-4 text-[#F4CA73]" />
                {submitting
                  ? editingPartner
                    ? 'Guardando cambios...'
                    : 'Creando Embajador...'
                  : editingPartner
                  ? 'Guardar cambios del Embajador'
                  : 'Crear Embajador y generar QR'}
              </button>
            </form>
          </section>

          {/* Live QR Card Preview */}
          <section
            ref={qrPreviewRef}
            data-preserve-surface="true"
            className="relative overflow-hidden rounded-[24px] border border-[#C88A2B]/35 bg-gradient-to-b from-[#24150D] via-[#1B100A] to-[#120A06] p-4 sm:p-5 text-[#FFFDF9] shadow-[0_22px_50px_-18px_rgba(0,0,0,0.55)] space-y-4"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(244,202,115,0.16),_transparent_62%)]" />

            <div className="relative flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <AmbassadorAvatar
                  name={previewSubject.name}
                  avatarUrl={previewSubject.avatarUrl}
                  emoji={previewSubject.emoji}
                  size="md"
                  ring="gold"
                />
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#E5AE4E]">
                    {previewSubject.isDraft
                      ? 'Vista Previa · Borrador'
                      : 'Tarjeta QR Activa'}
                  </span>
                  <h4 className="font-serif text-base font-bold text-white truncate">
                    {previewSubject.name}
                  </h4>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="rounded-full bg-white/10 border border-[#F4CA73]/30 px-2 py-0.5 font-mono text-[10px] font-bold text-[#F4CA73]">
                      {previewSubject.code}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#E8D5BE] truncate max-w-[160px]">
                      <UserCheck className="h-2.5 w-2.5 text-[#F4CA73] shrink-0" />
                      <span className="truncate">
                        {previewSubject.ownerLabel}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Physical QR Card */}
            <div className="relative mx-auto max-w-[232px] sm:max-w-[260px]">
              <div
                className="relative overflow-hidden rounded-[20px] p-3.5 shadow-[0_20px_42px_-12px_rgba(0,0,0,0.75)] transition-colors duration-200"
                style={{
                  backgroundColor: previewThemeMeta.cardBg,
                  border: `1.5px solid ${
                    previewThemeMeta.dark
                      ? 'rgba(244, 202, 115, 0.48)'
                      : 'rgba(200, 138, 43, 0.36)'
                  }`,
                }}
              >
                <div className="aspect-square w-full overflow-hidden rounded-xl">
                  <LiveEmbajadorQrSvg
                    targetUrl={previewReferralUrl}
                    styleId={previewSubject.styleId}
                  />
                </div>
                <div className="mt-2.5 pt-2 border-t border-[#C88A2B]/30 text-center">
                  <p
                    className="font-serif text-xs font-bold truncate"
                    style={{ color: previewThemeMeta.fg }}
                  >
                    {previewSubject.name}
                  </p>
                  <p
                    className="font-mono text-[10px] font-bold tracking-wide mt-0.5"
                    style={{ color: previewThemeMeta.accent }}
                  >
                    CÓDIGO: {previewSubject.code}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Style Dots for Preview */}
            <div className="relative flex flex-wrap items-center justify-center gap-1.5">
              {QR_STYLE_PRESETS.map((preset) => {
                const active = previewSubject.styleId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setPreviewStyleOverride(preset.id);
                      if (editingId || previewSubject.isDraft) {
                        setFormQrStyleId(preset.id);
                      }
                    }}
                    className={`min-h-[30px] rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-all cursor-pointer ${
                      active
                        ? 'border-[#F4CA73] bg-[#F4CA73]/20 text-[#F4CA73]'
                        : 'border-white/15 bg-white/5 text-[#E8D5BE] hover:bg-white/10'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>

            {/* Action Buttons: Descargar QR HD, Copiar enlace, WhatsApp */}
            <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                disabled={downloadingId === previewSubject.id}
                onClick={() => handleDownloadPartnerQr(previewSubject)}
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#C88A2B] via-[#F4CA73] to-[#C88A2B] px-3 py-2 text-xs font-bold text-[#1A0E08] shadow-sm hover:brightness-105 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                {downloadingId === previewSubject.id
                  ? 'Exportando...'
                  : 'Descargar QR HD'}
              </button>

              <button
                type="button"
                onClick={() =>
                  handleCopyLink(previewSubject.code, `preview-${previewSubject.id}`)
                }
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 px-3 py-2 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                {copiedId === `preview-${previewSubject.id}` ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300 shrink-0" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-[#F4CA73] shrink-0" />
                    Copiar enlace
                  </>
                )}
              </button>

              <a
                href={buildWhatsAppShareUrl(
                  {
                    name: previewSubject.name,
                    code: previewSubject.code,
                    phone: previewSubject.phone,
                  },
                  previewReferralUrl
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-600/85 hover:bg-emerald-500 px-3 py-2 text-xs font-bold text-white transition-colors"
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                WhatsApp
              </a>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (lg:col-span-7): Métricas y Ranking de Embajadores */}
        <div className="lg:col-span-7 space-y-4 min-w-0">
          {/* Compact 3-Card Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="dsb-glass rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 min-w-0">
              <div
                data-dsb-icon-tile="amber"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100/85 border border-amber-200 text-amber-800"
              >
                <Users className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#7B5D4A] truncate">
                  Embajadores activos
                </p>
                <p className="font-serif text-xl sm:text-2xl font-bold text-[#22150E] tabular-nums leading-tight">
                  {summaryStats.activeCount}
                  <span className="text-xs font-sans font-semibold text-[#7B5D4A] ml-1">
                    / {summaryStats.totalCount}
                  </span>
                </p>
              </div>
            </div>

            <div className="dsb-glass rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 min-w-0">
              <div
                data-dsb-icon-tile="sky"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 border border-sky-200 text-sky-800"
              >
                <Eye className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#7B5D4A] truncate">
                  Visitas QR
                </p>
                <p className="font-serif text-xl sm:text-2xl font-bold text-[#22150E] tabular-nums leading-tight">
                  {summaryStats.totalVisits}
                </p>
              </div>
            </div>

            <div className="dsb-glass rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 min-w-0">
              <div
                data-dsb-icon-tile="emerald"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-800"
              >
                <TrendingUp className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#7B5D4A] truncate">
                  Prospectos generados
                </p>
                <p className="font-serif text-xl sm:text-2xl font-bold text-[#22150E] tabular-nums leading-tight">
                  {summaryStats.totalProspects}
                  {(summaryStats.totalOrdenes > 0 ||
                    summaryStats.totalDemos > 0) && (
                    <span className="block sm:inline sm:ml-1.5 text-[10.5px] font-sans font-semibold text-emerald-700">
                      {summaryStats.totalOrdenes} órd · {summaryStats.totalDemos}{' '}
                      dem
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Filter & Ranking Panel */}
          <section className="dsb-glass rounded-[24px] p-4 sm:p-5 space-y-4 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Award
                  className="h-5 w-5 shrink-0"
                  style={{ color: roleTheme.accentMetallic }}
                />
                <div className="min-w-0">
                  <h3 className="font-serif text-base sm:text-lg font-bold text-[#22150E] truncate">
                    Métricas y Ranking de Embajadores
                  </h3>
                  <p className="text-[11px] text-[#7B5D4A]">
                    Ordenado por{' '}
                    <strong className="text-[#594133]">
                      {activeSortMeta.label}
                    </strong>{' '}
                    · Embajadores sin acceso al dashboard
                  </p>
                </div>
              </div>
              <span className="dsb-glass-subtle rounded-full px-3 py-1 text-xs font-bold text-[#594133] tabular-nums">
                {filteredRows.length}{' '}
                {filteredRows.length === 1 ? 'embajador' : 'embajadores'}
              </span>
            </div>

            {/* Filter Bar */}
            <div className="dsb-glass-subtle rounded-2xl p-2.5 sm:p-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              <div
                className={`relative ${
                  mode === 'admin' ? 'sm:col-span-5' : 'sm:col-span-7'
                }`}
              >
                <Search className="h-4 w-4 text-[#8A6D5B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar nombre o código..."
                  aria-label="Buscar embajador por nombre o código"
                  className="w-full min-h-[42px] rounded-xl border border-[#DFCBB3] bg-white pl-9 pr-8 py-2 text-base sm:text-sm text-[#22150E] placeholder:text-[#A8917D] focus:border-[#C88A2B] focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Limpiar búsqueda"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#7B5D4A] hover:text-[#22150E] cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div
                className={
                  mode === 'admin' ? 'sm:col-span-3' : 'sm:col-span-5'
                }
              >
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortMetric)}
                  aria-label="Ordenar ranking por métrica"
                  className="w-full min-h-[42px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-2 text-base sm:text-sm font-semibold text-[#22150E] focus:border-[#C88A2B] focus:outline-none"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      Ordenar: {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {mode === 'admin' && (
                <div className="sm:col-span-4">
                  <select
                    value={vendedorFilter}
                    onChange={(e) => setVendedorFilter(e.target.value)}
                    aria-label="Filtrar por vendedor"
                    className="w-full min-h-[42px] rounded-xl border border-[#DFCBB3] bg-white px-3 py-2 text-base sm:text-sm font-semibold text-[#22150E] focus:border-[#C88A2B] focus:outline-none"
                  >
                    <option value="all">Todos los vendedores</option>
                    <option value="__direct__">Ciprian Directo</option>
                    {vendedorFilterOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* List Action Feedback Banner */}
            <AnimatePresence>
              {listBanner && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                    listBanner.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900'
                  }`}
                >
                  <span className="min-w-0 break-words">{listBanner.text}</span>
                  <button
                    type="button"
                    onClick={() => setListBanner(null)}
                    className="shrink-0 p-1 opacity-70 hover:opacity-100 cursor-pointer"
                    aria-label="Cerrar aviso"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty State or Ranked Rows */}
            {embajadores.length === 0 ? (
              <div className="dsb-glass-subtle rounded-2xl border-dashed border-[#DFCBB3] px-5 py-10 text-center space-y-2.5">
                <div
                  data-dsb-icon-tile="amber"
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100/85 border border-amber-200 text-amber-800"
                >
                  <Sparkles className="h-6 w-6" />
                </div>
                <h4 className="font-serif text-base sm:text-lg font-bold text-[#22150E]">
                  Aún no hay Embajadores creados
                </h4>
                <p className="text-xs sm:text-sm text-[#7B5D4A] max-w-md mx-auto">
                  Crea tu primer Embajador en el estudio de la izquierda con un
                  emoji o foto y genera su tarjeta QR personalizada al instante.
                </p>
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="dsb-glass-subtle rounded-2xl border-dashed border-[#DFCBB3] px-5 py-8 text-center space-y-2.5">
                <p className="font-serif text-base font-bold text-[#22150E]">
                  No se encontraron Embajadores con ese filtro
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setVendedorFilter('all');
                  }}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#DFCBB3] bg-white px-4 py-1.5 text-xs font-bold text-[#594133] hover:text-[#22150E] cursor-pointer"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {filteredRows.map((row) => {
                    const r = row.partner;
                    const podium = getPodiumBadgeClasses(row.rank);
                    const metricVal = getMetricValue(row, sortBy);
                    const barPct =
                      metricVal > 0
                        ? Math.max(6, Math.round((metricVal / topMetric) * 100))
                        : 6;
                    const isSelectedPreview = selectedPreviewId === r.id;
                    const isEditingThis = editingId === r.id;
                    const isDeletingThis = deletingTargetId === r.id;
                    const isToggling = togglingId === r.id;
                    const isDownloading = downloadingId === r.id;

                    return (
                      <motion.article
                        key={r.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        data-dsb-card={r.active ? 'default' : 'locked'}
                        className={`dsb-glass-subtle rounded-2xl p-3.5 sm:p-4 space-y-3 transition-all ${
                          isSelectedPreview
                            ? 'ring-2 ring-[#C88A2B]/55 border-[#C88A2B]/60'
                            : 'hover:border-[#C88A2B]/40'
                        } ${!r.active ? 'opacity-80' : ''}`}
                      >
                        {/* Top Row: Rank + Avatar + Name + Code + Prominent Metric */}
                        <div className="flex items-start justify-between gap-3 min-w-0">
                          <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                            <span
                              data-preserve-surface={
                                podium.preserveSurface ? 'true' : undefined
                              }
                              className={`inline-flex h-7 min-w-[30px] px-1.5 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-extrabold tabular-nums mt-1 ${podium.className}`}
                            >
                              #{row.rank}
                            </span>

                            <AmbassadorAvatar
                              name={r.name}
                              avatarUrl={r.avatarUrl ?? null}
                              emoji={r.emoji ?? null}
                              size="md"
                              ring={row.rank === 1 ? 'gold' : 'subtle'}
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h4 className="font-serif text-sm sm:text-base font-bold text-[#22150E] truncate max-w-full">
                                  {r.name}
                                </h4>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                                    r.active
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                      : 'border-amber-200 bg-amber-50 text-amber-800'
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      r.active
                                        ? 'bg-emerald-500'
                                        : 'bg-amber-500'
                                    }`}
                                  />
                                  {r.active ? 'Activo' : 'Pausado'}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center rounded-md border border-[#E5C17B] bg-[#FFF4DC] px-2 py-0.5 font-mono text-[10.5px] font-bold text-[#8A5610]">
                                  {r.code}
                                </span>

                                {mode === 'admin' && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-[#DFCBB3] bg-white/75 px-2 py-0.5 text-[10.5px] font-semibold text-[#594133]">
                                    <UserCheck className="h-3 w-3 text-[#C88A2B] shrink-0" />
                                    <span className="truncate max-w-[150px]">
                                      {r.ownerVendedorName ||
                                        r.ownerVendedorTag ||
                                        'Ciprian Directo'}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Prominent Prospectos / Metric Counter */}
                          <div className="text-right shrink-0">
                            <p className="font-serif text-xl sm:text-2xl font-bold text-[#22150E] tabular-nums leading-none">
                              {sortBy === 'prospects'
                                ? row.prospectsCount
                                : metricVal}
                            </p>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7B5D4A] mt-0.5">
                              {activeSortMeta.unit}
                            </p>
                            {sortBy !== 'prospects' && (
                              <p className="text-[10px] font-semibold text-[#594133] tabular-nums">
                                {row.prospectsCount} prosp.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Animated Horizontal Ranking Progress Bar */}
                        <div className="space-y-1.5">
                          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#EFE3D2]">
                            <motion.div
                              initial={{ width: '6%' }}
                              animate={{ width: `${barPct}%` }}
                              transition={{
                                duration: 0.45,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              data-preserve-surface="true"
                              className="h-full rounded-full"
                              style={{ background: roleTheme.progressGradient }}
                            />
                          </div>

                          {/* Compact Metric Chips */}
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tabular-nums">
                            <span className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 text-sky-800">
                              Visitas: <strong>{row.visitsCount}</strong>
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-0.5 text-rose-800">
                              Citas: <strong>{row.citasCount}</strong>
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
                              Demos: <strong>{row.demosCount}</strong>
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-emerald-800">
                              Órdenes: <strong>{row.ordenesCount}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="pt-2 border-t border-[#EFE3D2] flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSelectForPreview(r)}
                            className={`min-h-[40px] sm:min-h-[34px] inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs sm:text-[11px] font-bold transition-colors cursor-pointer ${
                              isSelectedPreview
                                ? 'border-[#C88A2B] bg-amber-100/85 text-amber-900'
                                : 'border-[#DFCBB3] bg-white hover:bg-[#FAF3E8] text-[#22150E]'
                            }`}
                          >
                            <QrCode className="h-3.5 w-3.5 text-[#C88A2B] shrink-0" />
                            Ver QR
                          </button>

                          <button
                            type="button"
                            disabled={isDownloading}
                            onClick={() =>
                              handleDownloadPartnerQr({
                                id: r.id,
                                name: r.name,
                                code: r.code,
                                avatarUrl: r.avatarUrl,
                                emoji: r.emoji,
                                styleId: r.qrStyleId || 'classic-gold',
                              })
                            }
                            className="min-h-[40px] sm:min-h-[34px] inline-flex items-center gap-1.5 rounded-xl border border-[#DFCBB3] bg-white hover:bg-[#FAF3E8] px-2.5 py-1.5 text-xs sm:text-[11px] font-semibold text-[#22150E] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5 text-[#B84A27] shrink-0" />
                            {isDownloading ? '...' : 'Descargar QR'}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyLink(r.code, `row-${r.id}`)}
                            className="min-h-[40px] sm:min-h-[34px] inline-flex items-center gap-1.5 rounded-xl border border-[#DFCBB3] bg-white hover:bg-[#FAF3E8] px-2.5 py-1.5 text-xs sm:text-[11px] font-semibold text-[#594133] transition-colors cursor-pointer"
                          >
                            {copiedId === `row-${r.id}` ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 shrink-0" />
                            )}
                            {copiedId === `row-${r.id}`
                              ? 'Copiado'
                              : 'Copiar enlace'}
                          </button>

                          <button
                            type="button"
                            onClick={() => startEditingPartner(r)}
                            className={`min-h-[40px] sm:min-h-[34px] inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs sm:text-[11px] font-semibold transition-colors cursor-pointer ${
                              isEditingThis
                                ? 'border-[#C88A2B] bg-amber-50 text-amber-900'
                                : 'border-[#DFCBB3] bg-white hover:bg-[#FAF3E8] text-[#594133]'
                            }`}
                          >
                            <Edit3 className="h-3.5 w-3.5 shrink-0" />
                            Editar
                          </button>

                          <button
                            type="button"
                            disabled={isToggling}
                            onClick={() => handleToggleActive(r)}
                            className="min-h-[40px] sm:min-h-[34px] inline-flex items-center gap-1.5 rounded-xl border border-[#DFCBB3] bg-white hover:bg-[#FAF3E8] px-2.5 py-1.5 text-xs sm:text-[11px] font-semibold text-[#594133] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {r.active ? (
                              <>
                                <PauseCircle className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                                {isToggling ? '...' : 'Pausar'}
                              </>
                            ) : (
                              <>
                                <PlayCircle className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                                {isToggling ? '...' : 'Activar'}
                              </>
                            )}
                          </button>

                          {mode === 'admin' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isDeletingThis) {
                                  setDeletingTargetId(null);
                                  setDeletePassword('');
                                  setDeleteError(null);
                                } else {
                                  setDeletingTargetId(r.id);
                                  setDeletePassword('');
                                  setDeleteError(null);
                                }
                              }}
                              className="min-h-[40px] sm:min-h-[34px] inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 text-xs sm:text-[11px] font-semibold text-rose-700 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5 shrink-0" />
                              Eliminar
                            </button>
                          )}
                        </div>

                        {/* Inline Admin-Password Confirmation (Admin Only) */}
                        <AnimatePresence>
                          {mode === 'admin' && isDeletingThis && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-1 rounded-xl border border-rose-200 bg-rose-50/90 p-3 space-y-2.5">
                                <div className="flex items-start gap-2 text-xs font-semibold text-rose-900">
                                  <KeyRound className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                                  <span>
                                    Eliminar permanentemente a{' '}
                                    <strong>{r.name}</strong>. Ingresa tu
                                    contraseña de Administrador:
                                  </span>
                                </div>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                  <input
                                    type="password"
                                    value={deletePassword}
                                    onChange={(e) => {
                                      setDeletePassword(e.target.value);
                                      setDeleteError(null);
                                    }}
                                    placeholder="Tu contraseña de Administrador"
                                    className="flex-1 min-h-[42px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-base sm:text-sm text-[#22150E] focus:border-rose-500 focus:outline-none"
                                  />
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={deletingBusy}
                                      onClick={() => handleConfirmDelete(r)}
                                      data-preserve-surface="true"
                                      className="flex-1 sm:flex-none min-h-[42px] rounded-xl bg-rose-700 hover:bg-rose-800 px-4 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-50"
                                    >
                                      {deletingBusy
                                        ? 'Eliminando...'
                                        : 'Confirmar'}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={deletingBusy}
                                      onClick={() => {
                                        setDeletingTargetId(null);
                                        setDeletePassword('');
                                        setDeleteError(null);
                                      }}
                                      className="min-h-[42px] rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 cursor-pointer"
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                                {deleteError && (
                                  <p className="text-[11px] font-bold text-rose-700">
                                    {deleteError}
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
