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
  bg: '#0f1117', bgAlt: '#1a1d27', bgCard: '#1e2130',
  text: '#e4e6eb', textMuted: '#9aa0a6', textSubtle: '#6b7280',
  border: '#2d3348', borderHover: '#4285f4',
  accent: '#4285f4', accentHover: '#5a9cf6',
  navBg: 'rgba(15,17,23,0.95)',
  heroBadgeBg: 'rgba(66,133,244,0.15)', heroBadgeText: '#8ab4f8',
  cardShadow: '0 4px 24px rgba(0,0,0,0.4)',
  featureBg: '#161925', featureIconBg: '#1e2538',
  stepBorder: '#2d3348',
  caseBg: '#161925', caseCardBg: '#1e2130',
  ctaOverlay: 'rgba(0,0,0,0.7)',
};

export const lightTheme: ThemeColors = {
  bg: '#ffffff', bgAlt: '#f8f9fa', bgCard: '#ffffff',
  text: '#202124', textMuted: '#5f6368', textSubtle: '#9aa0a6',
  border: '#e8eaed', borderHover: '#1a73e8',
  accent: '#1a73e8', accentHover: '#1765cc',
  navBg: 'rgba(255,255,255,0.95)',
  heroBadgeBg: '#e8f0fe', heroBadgeText: '#1a73e8',
  cardShadow: '0 4px 24px rgba(0,0,0,0.08)',
  featureBg: '#f8f9fa', featureIconBg: '#f1f3f4',
  stepBorder: '#e8eaed',
  caseBg: '#f8f9fa', caseCardBg: '#ffffff',
  ctaOverlay: 'rgba(0,0,0,0.3)',
};

export interface LandingSectionProps {
  lang: Lang;
  theme: Theme;
  c: ThemeColors;
  isDark: boolean;
}
