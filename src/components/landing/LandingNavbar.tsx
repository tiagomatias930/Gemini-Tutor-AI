import React from 'react';
import { Menu, X, Sun, Moon, Sparkles, ArrowRight, Globe } from 'lucide-react';
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
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <nav
      style={{
        background: c.navBg,
        borderBottom: `1px solid ${c.border}`,
      }}
      className="fixed top-0 w-full backdrop-blur-xl z-50 transition-all duration-300 shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">

          {/* Logo & Brand */}
          <div
            onClick={() => scrollToSection('home')}
            className="flex items-center gap-3 cursor-pointer select-none group"
          >
            <div className="w-10 h-10 rounded-2xl via-indigo-600 to-violet-500 p-0.5  group-hover:scale-105 transition-transform duration-300">
              <div className="w-full h-full rflex items-center justify-center bg-white">
                <img src="/logoGT.png" alt="logo" />              
                </div>
            </div>
            <div className="flex flex-col">
              <span className="font-heading font-extrabold text-xl tracking-tight leading-none" style={{ color: c.text }}>
                Ngola<span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">Tutor</span>
              </span>

            </div>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/50 p-1 rounded-full border border-slate-200/60 dark:border-slate-700/60">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  style={{
                    color: activeNav === item.id ? (isDark ? '#FFFFFF' : '#0F172A') : c.textMuted,
                    backgroundColor: activeNav === item.id ? (isDark ? 'rgba(255,255,255,0.1)' : '#FFFFFF') : 'transparent'
                  }}
                  className="px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 hover:text-blue-600 dark:hover:text-blue-400 shadow-none data-[active=true]:shadow-sm"
                  data-active={activeNav === item.id}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'pt' : 'en')}
              style={{
                border: `1px solid ${c.border}`,
                color: c.text,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 hover:scale-105"
            >
              <Globe size={14} className="text-blue-500" />
              <span>{lang === 'en' ? 'EN' : 'PT'}</span>
              <span className="text-sm">{lang === 'en' ? '🇺🇸' : '🇦🇴'}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{
                border: `1px solid ${c.border}`,
                color: c.textMuted,
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
              }}
              className="flex items-center justify-center w-9 h-9 rounded-xl hover:text-amber-500 transition-all duration-200 hover:scale-105"
              title={isDark ? "Modo Claro" : "Modo Escuro"}
            >
              {isDark ? <Sun size={17} className="text-amber-400" /> : <Moon size={17} className="text-slate-600" />}
            </button>

            {/* CTA Button */}
            <button
              onClick={onStartLearning}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-semibold text-xs tracking-wide shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <span>{t(lang, 'navGetStarted')}</span>
              <ArrowRight size={15} />
            </button>
          </div>

          {/* Mobile Menu Controls */}
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setLang(lang === 'en' ? 'pt' : 'en')}
              style={{ color: c.text, border: `1px solid ${c.border}` }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
            >
              <span>{lang === 'en' ? 'EN 🇺🇸' : 'PT 🇦🇴'}</span>
            </button>
            <button
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              style={{ color: c.textMuted, border: `1px solid ${c.border}` }}
              className="p-2 rounded-lg"
            >
              {isDark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ color: c.text, border: `1px solid ${c.border}` }}
              className="p-2 rounded-lg"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div
            style={{ borderTop: `1px solid ${c.border}`, background: c.navBg }}
            className="md:hidden py-4 px-2 space-y-2 rounded-b-2xl animate-in fade-in slide-in-from-top-4 duration-300"
          >
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                style={{ color: activeNav === item.id ? c.accent : c.text }}
                className="block w-full text-left px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={onStartLearning}
              className="w-full mt-3 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25"
            >
              <span>{t(lang, 'navGetStarted')}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
