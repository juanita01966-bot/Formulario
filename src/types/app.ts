export type LeadCategory = 'none' | 'cita' | 'demo' | 'orden';

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
  category: LeadCategory;
  orderAmount: number | null;
  notes: string;
  qualification?: LeadQualification | null;
  promoCodeInvalidated?: boolean;
  promoCodeInvalidatedAt?: string | null;
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

export interface ReferralPartner {
  id: string;
  name: string;
  code: string;
  phone?: string;
  notes?: string;
  active: boolean;
  visitsCount: number;
  uniqueVisitsCount: number;
  lastVisitAt?: string | null;
  qrStyleId?: QrStyleId;
  createdAt: string;
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
  createdAt: string;
}

export interface AppState {
  settings: AppSettings;
  gifts: GiftItem[];
  leads: Lead[];
  qrHistory?: QrCodeRecord[];
  referrers?: ReferralPartner[];
}
