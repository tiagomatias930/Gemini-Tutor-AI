import { type Lang } from '../../i18n';

export type Theme = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  bgAlt: string;
  bgCard: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  border: string;
  borderHover: string;
  accent: string;
  accentHover: string;
  navBg: string;
  heroBadgeBg: string;
  heroBadgeText: string;
  cardShadow: string;
  featureBg: string;
  featureIconBg: string;
  stepBorder: string;
  caseBg: string;
  caseCardBg: string;
  ctaOverlay: string;
}

export const darkTheme: ThemeColors = {
  bg: '#080C14',
  bgAlt: '#0F172A',
  bgCard: '#131C31',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textSubtle: '#64748B',
  border: 'rgba(148, 163, 184, 0.12)',
  borderHover: '#3B82F6',
  accent: '#3B82F6',
  accentHover: '#2563EB',
  navBg: 'rgba(8, 12, 20, 0.85)',
  heroBadgeBg: 'rgba(59, 130, 246, 0.12)',
  heroBadgeText: '#60A5FA',
  cardShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.4), 0 4px 12px -2px rgba(0, 0, 0, 0.2)',
  featureBg: '#0B1120',
  featureIconBg: 'rgba(59, 130, 246, 0.12)',
  stepBorder: 'rgba(148, 163, 184, 0.15)',
  caseBg: '#0B1120',
  caseCardBg: '#131C31',
  ctaOverlay: 'rgba(8, 12, 20, 0.85)',
};

export const lightTheme: ThemeColors = {
  bg: '#FFFFFF',
  bgAlt: '#F8FAFC',
  bgCard: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#475569',
  textSubtle: '#94A3B8',
  border: '#E2E8F0',
  borderHover: '#2563EB',
  accent: '#2563EB',
  accentHover: '#1D4ED8',
  navBg: 'rgba(255, 255, 255, 0.88)',
  heroBadgeBg: '#EEF2FF',
  heroBadgeText: '#3730A3',
  cardShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.02)',
  featureBg: '#F8FAFC',
  featureIconBg: '#EEF2FF',
  stepBorder: '#E2E8F0',
  caseBg: '#F8FAFC',
  caseCardBg: '#FFFFFF',
  ctaOverlay: 'rgba(15, 23, 42, 0.4)',
};

export interface LandingSectionProps {
  lang: Lang;
  theme: Theme;
  c: ThemeColors;
  isDark: boolean;
}
