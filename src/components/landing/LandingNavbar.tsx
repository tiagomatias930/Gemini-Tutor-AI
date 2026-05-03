import React from 'react';
import { Menu, Close, Language, LightMode, DarkMode } from '@mui/icons-material';
import { t, type Lang } from '../../i18n';
import { ThemeColors, Theme } from './types';

interface LandingNavbarProps {
  lang: Lang;
  theme: Theme;
  c: ThemeColors;
  isDark: boolean;
  activeNav: string;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  scrollToSection: (id: string) => void;
  onStartLearning: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({
  lang, theme, c, isDark, activeNav, mobileMenuOpen, 
  setMobileMenuOpen, setLang, setTheme, scrollToSection, onStartLearning
}) => {
  const navItems = [
    { id: 'home', label: t(lang, 'navHome') },
    { id: 'features', label: t(lang, 'navFeatures') },
    { id: 'case-studies', label: t(lang, 'navCaseStudies') },
    { id: 'about', label: t(lang, 'navAbout') },
  ];

  return (
    <nav style={{ background: c.navBg, borderBottom: `1px solid ${c.border}`, transition: 'all 0.3s' }} className="fixed top-0 w-full backdrop-blur-sm z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight mb-3 text-center leading-tight">
            <span className="text-[#4285f4]">G</span><span className="text-[#ea4335]">e</span>
            <span className="text-[#fbbc05]">m</span><span className="text-[#4285f4]">i</span>
            <span className="text-[#34a853]">n</span><span className="text-[#ea4335]">i</span>
            <span style={{ color: c.text }}> Tutor</span>
          </h1>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map(item => (
              <button key={item.id} onClick={() => scrollToSection(item.id)}
                style={{ color: activeNav === item.id ? c.accent : c.textMuted, transition: 'color 0.2s' }}
                className="text-sm font-medium hover:opacity-80">
                {item.label}
              </button>
            ))}

            {/* Language Toggle */}
            <button onClick={() => setLang(lang === 'en' ? 'pt' : 'en')}
              style={{ border: `1px solid ${c.border}`, color: c.textMuted, transition: 'all 0.2s' }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium hover:opacity-80">
              <Language sx={{ fontSize: 14 }} />
              {lang === 'en' ? 'PT' : 'EN'}
            </button>

            {/* Theme Toggle */}
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{ border: `1px solid ${c.border}`, color: c.textMuted, transition: 'all 0.2s' }}
              className="flex items-center justify-center w-9 h-9 rounded-full hover:opacity-80">
              {isDark ? <LightMode sx={{ fontSize: 18 }} /> : <DarkMode sx={{ fontSize: 18 }} />}
            </button>

            <button onClick={onStartLearning}
              style={{ background: c.accent, transition: 'background 0.2s' }}
              className="px-6 py-2.5 text-white rounded-lg font-medium hover:opacity-90">
              {t(lang, 'navGetStarted')}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 md:hidden">
            <button onClick={() => setLang(lang === 'en' ? 'pt' : 'en')}
              style={{ color: c.textMuted }} className="p-2 rounded-lg">
              <Language sx={{ fontSize: 20 }} />
            </button>
            <button onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{ color: c.textMuted }} className="p-2 rounded-lg">
              {isDark ? <LightMode sx={{ fontSize: 20 }} /> : <DarkMode sx={{ fontSize: 20 }} />}
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ color: c.text }} className="p-2 rounded-lg">
              {mobileMenuOpen ? <Close sx={{ fontSize: 24 }} /> : <Menu sx={{ fontSize: 24 }} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div style={{ borderTop: `1px solid ${c.border}` }} className="md:hidden pb-4">
            {[...navItems, { id: 'contact', label: t(lang, 'navContact') }].map(item => (
              <button key={item.id} onClick={() => scrollToSection(item.id)}
                style={{ color: c.textMuted }} className="block w-full text-left px-4 py-2 font-medium hover:opacity-80">
                {item.label}
              </button>
            ))}
            <button onClick={onStartLearning}
              style={{ background: c.accent }}
              className="w-full mt-2 mx-4 px-6 py-2.5 text-white rounded-lg font-medium">
              {t(lang, 'navGetStarted')}
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
