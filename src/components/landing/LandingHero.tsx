import React from 'react';
import { ArrowRight, Brain, Mic, CheckCircle2, Sparkles, BookOpen, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import { t } from '../../i18n';
import { LandingSectionProps } from './types';

interface LandingHeroProps extends LandingSectionProps {
  onStartLearning: () => void;
  scrollToSection: (id: string) => void;
}

export const LandingHero: React.FC<LandingHeroProps> = ({
  lang, c, isDark, onStartLearning, scrollToSection
}) => {
  const gradient = 'linear-gradient(135deg, #2563EB 0%, #000000ff 50%, #ffc400ff 100%)';

  return (
    <section id="home" className="pt-36 pb-24 px-4 sm:px-6 lg:px-8 min-h-[90vh] flex items-center overflow-hidden relative">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-blue-500/10 via-indigo-500/10 to-purple-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto w-full">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">

          {/* Left Hero Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="lg:col-span-7 space-y-8"
          >
            <div className="space-y-5">

              {/* Headline */}
              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.15]">
                {t(lang, 'heroTitle1')}{' '}
                <span style={{ background: gradient, backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {t(lang, 'heroTitle2')}
                </span>
              </h1>

              {/* Description */}
              <p style={{ color: c.textMuted }} className="text-lg sm:text-xl font-normal leading-relaxed max-w-2xl">
                {t(lang, 'heroDesc')}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onStartLearning}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-sm tracking-wide shadow-xl shadow-blue-500/25 hover:shadow-blue-500/35 flex items-center justify-center gap-3 transition-all duration-300 group"
              >
                <span>{t(lang, 'heroBtn1')}</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => scrollToSection('features')}
                style={{
                  border: `1.5px solid ${c.border}`,
                  color: c.text,
                  background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                }}
                className="px-8 py-4 rounded-2xl font-bold text-sm tracking-wide hover:border-blue-500/50 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <BookOpen size={17} className="text-blue-500" />
                <span>{t(lang, 'heroBtn2')}</span>
              </motion.button>
            </div>

            {/* Highlighted tags */}
            <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-slate-200/50 dark:border-slate-800/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-xs font-semibold" style={{ color: c.textMuted }}>Avatar em Língua Gestual</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-xs font-semibold" style={{ color: c.textMuted }}>Visão Computacional & Audiodescrição</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span className="text-xs font-semibold" style={{ color: c.textMuted }}>Método Socrático sem Julgamentos</span>
              </div>
            </div>
          </motion.div>

          {/* Right Hero Visual / Interactive Preview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            className="lg:col-span-5 relative"
          >
            <div className="relative w-full aspect-square max-w-[460px] mx-auto">

              {/* Pulsing Backlight */}
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  opacity: [0.35, 0.55, 0.35]
                }}
                transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-4 bg-gradient-to-tr from-blue-600/30 via-indigo-600/20 to-purple-600/30 blur-2xl rounded-3xl"
              />

              {/* Main Image Container */}
              <div
                className="absolute inset-0 rounded-3xl overflow-hidden shadow-2xl border"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  background: `url('/Main.webp') center/cover no-repeat`,
                  opacity: isDark ? 0.88 : 1,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
              </div>

              {/* Floating Glassmorphic Feature Cards */}
              {[
                {
                  pos: 'top-4 -right-4',
                  Icon: Brain,
                  color: '#3B82F6',
                  bgIcon: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
                  title: t(lang, 'cardAI'),
                  desc: t(lang, 'cardAIDesc'),
                  delay: 0.6
                },
                {
                  pos: 'bottom-6 -left-6',
                  Icon: Mic,
                  color: '#F43F5E',
                  bgIcon: isDark ? 'rgba(244, 63, 94, 0.15)' : '#FFF1F2',
                  title: t(lang, 'cardVoice'),
                  desc: t(lang, 'cardVoiceDesc'),
                  delay: 0.8
                },
                {
                  pos: 'bottom-1/3 -right-6',
                  Icon: CheckCircle2,
                  color: '#10B981',
                  bgIcon: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                  title: t(lang, 'cardHelp'),
                  desc: t(lang, 'cardHelpDesc'),
                  delay: 1.0
                },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: card.delay, duration: 0.5 }}
                  whileHover={{ y: -4 }}
                  className={`absolute ${card.pos} w-48 rounded-2xl p-4 shadow-xl backdrop-blur-xl z-10 border transition-all duration-300`}
                  style={{
                    background: isDark ? 'rgba(19, 28, 49, 0.85)' : 'rgba(255, 255, 255, 0.92)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(226, 232, 240, 0.8)'
                  }}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: card.bgIcon }}>
                      <card.Icon size={16} style={{ color: card.color }} />
                    </div>
                    <span className="font-heading font-bold text-xs" style={{ color: c.text }}>{card.title}</span>
                  </div>
                  <p style={{ color: c.textMuted }} className="text-[11px] leading-relaxed line-clamp-2">{card.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
