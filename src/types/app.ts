export type UserRole = 'ai_manager' | 'admin' | 'telemarketing' | 'vendedor';

export type LeadCategory = 'none' | 'cita' | 'demo' | 'orden';

export type CallOutcome = 'pending' | 'scheduled' | 'not_scheduled';

export type CreditTier = 'alto' | 'medio' | 'basico';

export interface LeadQualification {
  creditProfile: string;
  housingStatus: string;
  investmentPriority: string;
  score: number;
  tier: CreditTier;
  knowsBrand?: boolean;
  isClient?: boolean;
  productRating?: number | null;
  healthyEatingInterest?: string;
  desiredProduct?: string;
  cedeGoldenTicket?: boolean;
  usCreditEstablished?: 'yes' | 'building' | 'no' | null;
  usCreditLabel?: string;
}

export type GiftVisualKey =
  | 'cutlery'
  | 'bowls'
  | 'knife'
  | 'thermo'
  | 'bamboo'
  | 'skillet'
  | 'pot'
  | 'blender'
  | 'kettle';

export type GiftThemeId =
  | 'autumn'
  | 'marble-gold'
  | 'obsidian-luxe'
  | 'emerald-sage'
  | 'ruby-velvet'
  | 'custom';

export type ShowcaseStyleId = 'luminous-gold' | 'crystal-aurora' | 'royal-ember';

export interface GiftItem {
  id: string;
  name: string;
  subtitle: string;
  usageTip?: string;
  tag: string;
  visualKey: GiftVisualKey;
  customImageUrl?: string;
  accentColor: string;
  active: boolean;
  stockLabel: string;
  probability?: number;
}

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  tag: string;
  avatarUrl?: string | null;
  active: boolean;
  hasPin: boolean;
  tokenVersion: number;
  referrerId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionInfo {
  authenticated: boolean;
  userId?: string;
  username?: string;
  displayName?: string;
  role?: UserRole;
  tag?: string;
  avatarUrl?: string | null;
}

export type SecurityQuestionType =
  | 'personal'
  | 'fecha'
  | 'clave'
  | 'codigo'
  | 'gusto'
  | 'custom';

export interface AiSecurityQuestionChallenge {
  questionId: string;
  type: SecurityQuestionType;
  typeLabel: string;
  prompt: string;
}

export interface AiSecurityQuestionPublic {
  id: string;
  type: SecurityQuestionType;
  typeLabel: string;
  prompt: string;
  hasAnswer: boolean;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  address?: string;
  acceptedTerms: boolean;
  giftId: string | null;
  giftName: string | null;
  giftVisualKey: GiftVisualKey | null;
  claimCode: string;
  called: boolean;
  calledAt: string | null;
  callOutcome: CallOutcome;
  calledBy?: string | null;
  scheduledAt?: string | null;
  category: LeadCategory;
  orderAmount: number | null;
  notes: string;
  qualification?: LeadQualification | null;
  promoCodeInvalidated?: boolean;
  promoCodeInvalidatedAt?: string | null;
  sellerLocked?: boolean;
  sellerConfirmedAt?: string | null;
  sellerConfirmedBy?: string | null;
  referralCode?: string | null;
  referrerId?: string | null;
  referrerName?: string | null;
  createdAt: string;
}

export type ReferralMetricKey = 'leads' | 'citas' | 'demos' | 'ordenes' | 'points';

export interface ReferralPrizeRule {
  prizeName: string;
  metric: ReferralMetricKey;
  targetCount: number;
  maxWinners: number;
  pointsPerLead: number;
  pointsPerCita: number;
  pointsPerDemo: number;
  pointsPerOrden: number;
}

export type ReferralPartnerType = 'vendedor' | 'embajador';

export interface ReferralPartner {
  id: string;
  accountId?: string | null;
  partnerType?: ReferralPartnerType;
  ownerVendedorAccountId?: string | null;
  ownerVendedorName?: string | null;
  ownerVendedorTag?: string | null;
  name: string;
  code: string;
  emoji?: string | null;
  avatarUrl?: string | null;
  phone?: string;
  notes?: string;
  active: boolean;
  visitsCount: number;
  uniqueVisitsCount: number;
  lastVisitAt?: string | null;
  qrStyleId?: QrStyleId;
  createdAt: string;
}

export interface ReferralVisitEvent {
  id: string;
  referrerId: string | null;
  referralCode: string;
  visitorId: string;
  visitedAt: string;
}

export interface ProcessControls {
  publicFormEnabled: boolean;
  publicFormDisabledTitle: string;
  publicFormDisabledMessage: string;
  welcomeVideoEnabled: boolean;
  qualificationQuizEnabled: boolean;
  giftRevealEnabled: boolean;
  clientGuardEnabled: boolean;
}

export interface SystemHealthReport {
  storage: 'supabase' | 'local';
  timestamp: string;
  uptimeSeconds: number;
  counts: {
    accounts: number;
    aiManagers: number;
    admins: number;
    vendedores: number;
    telemarketing: number;
    leads: number;
    referrers: number;
    embajadores: number;
    qrCodes: number;
    visits: number;
    openAlerts: number;
    totalAlerts: number;
    activityLogs: number;
    activeGifts: number;
    totalGifts: number;
  };
  processControls: ProcessControls;
}

export interface AppSettings {
  advisorName: string;
  hostTitle: string;
  brandSubtitle: string;
  defaultTicketAmount: number;
  requirePin: boolean;
  pinCode: string;
  giftTheme?: GiftThemeId;
  customBoxColor?: string;
  showcaseStyle?: ShowcaseStyleId;
  randomizeGifts?: boolean;
  referralPrizeRule?: ReferralPrizeRule;
  processControls?: ProcessControls;
}

export type QrStyleId =
  | 'classic-gold'
  | 'obsidian-dots'
  | 'ivory-rounded'
  | 'emerald-heritage'
  | 'ruby-atelier';

export type QrDotShape = 'square' | 'rounded' | 'dots';

export interface QrCodeRecord {
  id: string;
  name: string;
  targetUrl: string;
  styleId: QrStyleId;
  dotShape: QrDotShape;
  foregroundColor: string;
  backgroundColor: string;
  includeLogo: boolean;
  frameText?: string;
  referralCode?: string | null;
  referrerId?: string | null;
  accountId?: string | null;
  createdAt: string;
}

export type SecurityAlertSeverity = 'critical' | 'high' | 'medium' | 'info';

export type SecurityAlertCategory =
  | 'qr_abuse'
  | 'vendedor'
  | 'telemarketing'
  | 'access'
  | 'audit';

export type SecurityAlertStatus = 'open' | 'reviewed' | 'dismissed';

export interface SecurityAlert {
  id: string;
  code: string;
  severity: SecurityAlertSeverity;
  category: SecurityAlertCategory;
  status: SecurityAlertStatus;
  title: string;
  description: string;
  actorRole?: UserRole | 'public' | 'system';
  actorName?: string | null;
  actorTag?: string | null;
  leadId?: string | null;
  leadName?: string | null;
  claimCode?: string | null;
  phoneMasked?: string | null;
  referralCode?: string | null;
  ipMasked?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string | null;
  createdAt: string;
}

export type ActivityLogCategory =
  | 'leads'
  | 'telemarketing'
  | 'status'
  | 'accounts'
  | 'qr'
  | 'catalog'
  | 'security'
  | 'system';

export interface ActivityLogEntry {
  id: string;
  action: string;
  category: ActivityLogCategory;
  actorRole: UserRole | 'public' | 'system';
  actorId?: string | null;
  actorName: string;
  actorUsername?: string | null;
  actorTag?: string | null;
  summary: string;
  fromState?: string | null;
  toState?: string | null;
  targetType?: 'lead' | 'account' | 'qr' | 'referrer' | 'gift' | 'settings' | 'security' | 'system';
  targetId?: string | null;
  targetLabel?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
}

export interface AppState {
  settings: AppSettings;
  gifts: GiftItem[];
  leads: Lead[];
  qrHistory?: QrCodeRecord[];
  referrers?: ReferralPartner[];
  accounts?: UserAccount[];
  visitLog?: ReferralVisitEvent[];
  securityAlerts?: SecurityAlert[];
  activityLogs?: ActivityLogEntry[];
  role?: UserRole;
}
