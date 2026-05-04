import React, { useState, useEffect } from 'react';
import { type Lang } from './i18n';
import { LandingNavbar } from './components/landing/LandingNavbar';
import { LandingHero } from './components/landing/LandingHero';
import { LandingFeatures, LandingHowItWorks } from './components/landing/LandingSections';
import { LandingCaseStudies, LandingAbout, LandingCTA } from './components/landing/LandingFooterSections';
import { LandingTrust, LandingFAQ } from './components/landing/LandingTrustFAQ';
import { useTheme } from './contexts/ThemeContext';

interface LandingPageProps {
  onStartLearning: () => void;
}

export function LandingPage({ onStartLearning }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('home');
  const { theme, c, isDark, toggleTheme } = useTheme();
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lp_lang') as Lang) || 'en');

  useEffect(() => { localStorage.setItem('lp_lang', lang); }, [lang]);

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

      {/* Basic Footer */}
      <footer className="py-12 px-4 border-t" style={{ borderColor: c.border, background: c.bg }}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
             <span className="text-xl font-bold">
               <span className="text-[#4285f4]">G</span><span className="text-[#ea4335]">e</span>
               <span className="text-[#fbbc05]">m</span><span className="text-[#4285f4]">i</span>
               <span className="text-[#34a853]">n</span><span className="text-[#ea4335]">i</span>
               <span style={{ color: c.text }}> Tutor</span>
             </span>
          </div>
          <p style={{ color: c.textMuted }} className="text-sm">
            © {new Date().getFullYear()} Gemini Tutor AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

