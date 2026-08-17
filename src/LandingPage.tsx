import React, { useState, useEffect } from 'react';
import { type Lang } from './i18n';
import { LandingNavbar } from './components/landing/LandingNavbar';
import { LandingHero } from './components/landing/LandingHero';
import { LandingFeatures, LandingHowItWorks } from './components/landing/LandingSections';
import { LandingCaseStudies, LandingAbout, LandingCTA } from './components/landing/LandingFooterSections';
import { LandingTrust, LandingFAQ } from './components/landing/LandingTrustFAQ';
import { useTheme } from './contexts/ThemeContext';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { TermsAndPrivacyModal } from './components/legal/TermsAndPrivacyModal';
import { getConsentPreferences, startTelemetryHeartbeat } from './utils/telemetryClient';

interface LandingPageProps {
  onStartLearning: () => void;
}

export function LandingPage({ onStartLearning }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('home');
  const { theme, c, isDark, toggleTheme } = useTheme();
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lp_lang') as Lang) || 'en');

  const [showTermsModal, setShowTermsModal] = useState(() => !getConsentPreferences().acceptedTerms);

  useEffect(() => { localStorage.setItem('lp_lang', lang); }, [lang]);

  useEffect(() => {
    const cleanup = startTelemetryHeartbeat();
    return () => cleanup();
  }, []);

  const setTheme = () => toggleTheme();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const navHeight = 80;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - navHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    setActiveNav(id);
    setMobileMenuOpen(false);
  };

  const commonProps = { lang, theme, c, isDark };

  return (
    <div style={{ background: c.bg, color: c.text, transition: 'background 0.3s, color 0.3s' }} className="w-full min-h-screen">
      <LandingNavbar
        {...commonProps}
        activeNav={activeNav}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        setLang={setLang}
        setTheme={setTheme}
        scrollToSection={scrollToSection}
        onStartLearning={onStartLearning}
      />

      <main>
        <LandingHero
          {...commonProps}
          onStartLearning={onStartLearning}
          scrollToSection={scrollToSection}
        />

        <LandingTrust {...commonProps} />

        <LandingFeatures {...commonProps} />

        <LandingHowItWorks {...commonProps} />

        <LandingCaseStudies {...commonProps} />

        <LandingAbout {...commonProps} />

        <LandingFAQ {...commonProps} />

        <LandingCTA
          {...commonProps}
          onStartLearning={onStartLearning}
        />
      </main>

      {/* Modern Accessible Footer */}
      <footer className="py-14 px-4 sm:px-6 lg:px-8 border-t" style={{ borderColor: c.border, background: c.bgAlt }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl to-indigo-600 p-0.5">
              <div className="w-full h-full rounded-[10px] flex items-center justify-center bg-white">
                <img src="/logoGT.png" alt="logo" />
              </div>
            </div>
            <span className="font-heading font-extrabold text-lg tracking-tight">
              Ngola<span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">Tutor</span> AI
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs font-semibold" style={{ color: c.textMuted }}>
            <button
              onClick={() => setShowTermsModal(true)}
              className="hover:text-blue-500 transition-colors flex items-center gap-1.5"
            >
              <ShieldCheck size={14} className="text-blue-500" />
              <span>Termos & Privacidade</span>
            </button>
          </div>

          <p style={{ color: c.textMuted }} className="text-xs sm:text-sm flex items-center gap-1">
            © {new Date().getFullYear()} Ngola Tutor AI. Educação e Ensino para todos.
          </p>
        </div>
      </footer>

      {/* Terms, Telemetry Notice & Cache Permission Modal */}
      <TermsAndPrivacyModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
    </div>
  );
}
