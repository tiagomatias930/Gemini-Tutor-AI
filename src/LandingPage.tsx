import React, { useState, useEffect } from 'react';
import {
  VolumeUp, Videocam, Psychology, TrendingUp,
  People, Chat, ArrowForward, CheckCircle, Menu, Close,
  Public, Email, Phone, Facebook, Twitter, LinkedIn, GitHub,
  AutoAwesome, MenuBook, Palette, DarkMode, LightMode, Language,
} from '@mui/icons-material';
import { type Lang, t } from './i18n';

interface LandingPageProps {
  onStartLearning: () => void;
}

type Theme = 'light' | 'dark';

// Dark theme color map
const dark = {
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

const light = {
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

export function LandingPage({ onStartLearning }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('home');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('lp_theme') as Theme) || 'light');
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem('lp_lang') as Lang) || 'en');

  useEffect(() => { localStorage.setItem('lp_theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('lp_lang', lang); }, [lang]);

  const c = theme === 'dark' ? dark : light;
  const isDark = theme === 'dark';

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setActiveNav(id);
    setMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'home', label: t(lang, 'navHome') },
    { id: 'features', label: t(lang, 'navFeatures') },
    { id: 'case-studies', label: t(lang, 'navCaseStudies') },
    { id: 'about', label: t(lang, 'navAbout') },
  ];

  const features = [
    { Icon: VolumeUp, title: t(lang, 'feat1Title'), description: t(lang, 'feat1Desc') },
    { Icon: Videocam, title: t(lang, 'feat2Title'), description: t(lang, 'feat2Desc') },
    { Icon: Psychology, title: t(lang, 'feat3Title'), description: t(lang, 'feat3Desc') },
    { Icon: MenuBook, title: t(lang, 'feat4Title'), description: t(lang, 'feat4Desc') },
    { Icon: TrendingUp, title: t(lang, 'feat5Title'), description: t(lang, 'feat5Desc') },
    { Icon: Public, title: t(lang, 'feat6Title'), description: t(lang, 'feat6Desc') },
  ];

  const steps = [
    { number: '1', title: t(lang, 'step1Title'), description: t(lang, 'step1Desc') },
    { number: '2', title: t(lang, 'step2Title'), description: t(lang, 'step2Desc') },
    { number: '3', title: t(lang, 'step3Title'), description: t(lang, 'step3Desc') },
    { number: '4', title: t(lang, 'step4Title'), description: t(lang, 'step4Desc') },
  ];

  const stories = [
    { name: 'Tiago Matias', subject: 'Full Stack Development', improvement: '+85%',
      quote: lang === 'pt' ? 'Gemini Tutor ajudou tremendamente no meu aprendizado em desenvolvimento. Excelente ferramenta!' : 'Gemini Tutor tremendously helped my learning in development. Excellent tool!',
      avatar: 'https://avatars.githubusercontent.com/u/35434705' },
    { name: 'Tatiana', subject: 'Web Development', improvement: '+70%',
      quote: lang === 'pt' ? 'A qualidade das explicações é impressionante. Finalmente entendi conceitos complexos de forma clara.' : 'The quality of explanations is impressive. I finally understood complex concepts clearly.',
      avatar: 'https://avatars.githubusercontent.com/u/78913806' },
    { name: 'Manuel', subject: 'Software Engineering', improvement: '+75%',
      quote: lang === 'pt' ? 'Com o Gemini Tutor consegui melhorar meu código e entender design patterns muito melhor.' : 'With Gemini Tutor I improved my code and understood design patterns much better.',
      avatar: 'https://avatars.githubusercontent.com/u/45087017' },
    { name: 'Iacene', subject: 'Computer Science', improvement: '+80%',
      quote: lang === 'pt' ? 'Essa é a melhor ferramenta de aprendizado que já experimentei. Altamente recomendado!' : 'This is the best learning tool I have ever tried. Highly recommended!',
      avatar: 'https://avatars.githubusercontent.com/u/52156325' },
  ];

  const gradient = 'linear-gradient(to right, #4285f4, #ea4335, #fbbc05, #34a853)';

  return (
    <div style={{ background: c.bg, color: c.text, transition: 'background 0.3s, color 0.3s' }} className="w-full min-h-screen">

      {/* ─── NAVIGATION ─── */}
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

      {/* ─── HERO SECTION ─── */}
      <section id="home" className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 mt-20 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div style={{ background: c.heroBadgeBg }} className="inline-block px-4 py-2 rounded-full">
                  <span style={{ color: c.heroBadgeText }} className="font-medium text-sm">{t(lang, 'heroBadge')}</span>
                </div>
                <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                  {t(lang, 'heroTitle1')}
                  <span style={{ background: gradient, backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {t(lang, 'heroTitle2')}
                  </span>
                </h1>
                <p style={{ color: c.textMuted }} className="text-xl">{t(lang, 'heroDesc')}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={onStartLearning}
                  style={{ background: c.accent }}
                  className="px-8 py-4 text-white rounded-lg font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 group">
                  {t(lang, 'heroBtn1')}
                  <ArrowForward sx={{ fontSize: 20, transition: 'transform 0.2s' }} className="group-hover:translate-x-1" />
                </button>
                <button onClick={() => scrollToSection('features')}
                  style={{ border: `2px solid ${c.border}`, color: c.text, transition: 'all 0.2s' }}
                  className="px-8 py-4 rounded-lg font-semibold hover:opacity-80">
                  {t(lang, 'heroBtn2')}
                </button>
              </div>
            </div>

            {/* Right Visual */}
            <div className="relative hidden lg:block">
              <div className="relative w-full aspect-square">
                <div className="absolute inset-0 rounded-3xl" style={{ background: `url('/Main.jpg')`, opacity: isDark ? 0.4 : 0.6, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />
                {[
                  { pos: 'top-1 right-1', Icon: Psychology, color: '#1a73e8', bgIcon: isDark ? '#1e2538' : '#e8f0fe', title: t(lang, 'cardAI'), desc: t(lang, 'cardAIDesc') },
                  { pos: 'bottom-1 left-1', Icon: VolumeUp, color: '#d33b27', bgIcon: isDark ? '#2e1f1a' : '#fce5cd', title: t(lang, 'cardVoice'), desc: t(lang, 'cardVoiceDesc') },
                  { pos: 'bottom-1/4 right-8', Icon: CheckCircle, color: '#188038', bgIcon: isDark ? '#1a2e1f' : '#e6f4ea', title: t(lang, 'cardHelp'), desc: t(lang, 'cardHelpDesc') },
                ].map((card, i) => (
                  <div key={i} className={`absolute ${card.pos} w-38 h-32 rounded-2xl p-6 transform hover:scale-105 transition`}
                    style={{ background: c.bgCard, boxShadow: c.cardShadow }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: card.bgIcon }}>
                        <card.Icon sx={{ fontSize: 20, color: card.color }} />
                      </div>
                      <span className="font-semibold text-sm">{card.title}</span>
                    </div>
                    <p style={{ color: c.textMuted }} className="text-xs">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURES SECTION ─── */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: c.featureBg }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              {t(lang, 'featTitle1')}
              <span style={{ background: gradient, backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {t(lang, 'featTitle2')}
              </span>
            </h2>
            <p style={{ color: c.textMuted }} className="text-xl max-w-2xl mx-auto">{t(lang, 'featSubtitle')}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <div key={idx} className="rounded-2xl p-8 hover:shadow-lg transition group cursor-pointer"
                style={{ background: c.bgCard, transition: 'all 0.3s' }}>
                <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition"
                  style={{ background: c.featureIconBg }}>
                  <feature.Icon sx={{ fontSize: 28, color: c.accent }} />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p style={{ color: c.textMuted }}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: c.bg }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">{t(lang, 'howTitle')}</h2>
            <p style={{ color: c.textMuted }} className="text-xl">{t(lang, 'howSubtitle')}</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, idx) => (
              <div key={idx} className="relative">
                {idx < 3 && (
                  <div className="hidden md:block absolute top-1/4 left-full w-full h-1 transform -translate-y-1/2"
                    style={{ background: `linear-gradient(to right, ${c.accent}, transparent)` }} />
                )}
                <div className="rounded-2xl p-8 text-center transition"
                  style={{ background: c.bgCard, border: `2px solid ${c.stepBorder}`, transition: 'all 0.3s' }}>
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-white">{step.number}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p style={{ color: c.textMuted }}>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CASE STUDIES ─── */}
      <section id="case-studies" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: c.caseBg }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">{t(lang, 'caseTitle')}</h2>
            <p style={{ color: c.textMuted }} className="text-xl">{t(lang, 'caseSubtitle')}</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stories.map((story, idx) => (
              <div key={idx} className="rounded-2xl p-8 hover:shadow-lg transition"
                style={{ background: c.caseCardBg, boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.06)' }}>
                <img src={`${story.avatar}?s=80`} alt={story.name}
                  className="w-16 h-16 rounded-full mb-4 object-cover" style={{ border: `2px solid ${c.border}` }} />
                <div className="text-3xl font-bold mb-2" style={{ color: c.accent }}>{story.improvement}</div>
                <p className="font-semibold mb-1">{story.name}</p>
                <p className="text-sm mb-4" style={{ color: c.textMuted }}>{story.subject}</p>
                <p className="italic text-sm" style={{ color: c.text }}>"{story.quote}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ABOUT SECTION ─── */}
      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: c.bg }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">{t(lang, 'aboutTitle')}</h2>
              <div className="space-y-6">
                <p>{t(lang, 'aboutP1')}</p>
                <p>{t(lang, 'aboutP2')}</p>
                <div className="space-y-3">
                  {[t(lang, 'aboutItem1'), t(lang, 'aboutItem2'), t(lang, 'aboutItem3'), t(lang, 'aboutItem4')].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle sx={{ fontSize: 24, color: '#188038', flexShrink: 0, marginTop: '2px' }} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA SECTION ─── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative" style={{ background: `url('/aluno.jpg') center/cover no-repeat` }}>
        <div className="absolute inset-0" style={{ background: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.3)' }} />
        <div className="max-w-4xl mx-auto text-center text-white relative z-10">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6 mt-2 p-4">{t(lang, 'ctaTitle')}</h2>
          <p className="text-xl mb-8 opacity-90">{t(lang, 'ctaDesc')}</p>
          <button onClick={onStartLearning}
            className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:shadow-xl transition hover:scale-105 inline-flex items-center gap-2">
            {t(lang, 'ctaBtn')}
            <ArrowForward sx={{ fontSize: 20 }} />
          </button>
        </div>
      </section>
    </div>
  );
}
