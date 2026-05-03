import React from 'react';
import { ArrowForward, Psychology, VolumeUp, CheckCircle } from '@mui/icons-material';
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
  const gradient = 'linear-gradient(to right, #4285f4, #ea4335, #fbbc05, #34a853)';

  return (
    <section id="home" className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 mt-20 min-h-screen flex items-center overflow-hidden">
      <div className="max-w-7xl mx-auto w-full">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                style={{ background: c.heroBadgeBg }} className="inline-block px-4 py-2 rounded-full"
              >
                <span style={{ color: c.heroBadgeText }} className="font-medium text-sm">{t(lang, 'heroBadge')}</span>
              </motion.div>
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                {t(lang, 'heroTitle1')}
                <span style={{ background: gradient, backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  {t(lang, 'heroTitle2')}
                </span>
              </h1>
              <p style={{ color: c.textMuted }} className="text-xl">{t(lang, 'heroDesc')}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onStartLearning}
                style={{ background: c.accent }}
                className="px-8 py-4 text-white rounded-lg font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 group"
              >
                {t(lang, 'heroBtn1')}
                <ArrowForward sx={{ fontSize: 20, transition: 'transform 0.2s' }} className="group-hover:translate-x-1" />
              </motion.button>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => scrollToSection('features')}
                style={{ border: `2px solid ${c.border}`, color: c.text, transition: 'all 0.2s' }}
                className="px-8 py-4 rounded-lg font-semibold hover:opacity-80"
              >
                {t(lang, 'heroBtn2')}
              </motion.button>
            </div>
          </motion.div>

          {/* Right Visual */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }}
            className="relative hidden lg:block"
          >
            <div className="relative w-full aspect-square max-w-[500px] ml-auto">
              {/* Decorative glow behind the image */}
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3]
                }}
                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -inset-4 bg-gradient-to-tr from-blue-500/20 to-purple-500/20 blur-3xl rounded-full" 
              />
              
              {/* Main Image with premium styling */}
              <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10" 
                style={{ 
                  background: `url('/Main.png')`, 
                  opacity: isDark ? 0.8 : 1, 
                  backgroundSize: 'cover', 
                  backgroundPosition: 'center', 
                  backgroundRepeat: 'no-repeat' 
                }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              </div>

              {/* Floating Info Cards */}
              {[
                { pos: 'top-4 -right-4', Icon: Psychology, color: '#4285f4', bgIcon: isDark ? '#1e2538' : '#e8f0fe', title: t(lang, 'cardAI'), desc: t(lang, 'cardAIDesc'), delay: 0.8 },
                { pos: 'bottom-8 -left-8', Icon: VolumeUp, color: '#ea4335', bgIcon: isDark ? '#2e1f1a' : '#fce5cd', title: t(lang, 'cardVoice'), desc: t(lang, 'cardVoiceDesc'), delay: 1.0 },
                { pos: 'bottom-1/4 -right-8', Icon: CheckCircle, color: '#34a853', bgIcon: isDark ? '#1a2e1f' : '#e6f4ea', title: t(lang, 'cardHelp'), desc: t(lang, 'cardHelpDesc'), delay: 1.2 },
              ].map((card, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: card.delay, duration: 0.6 }}
                  className={`absolute ${card.pos} w-48 rounded-2xl p-5 shadow-2xl backdrop-blur-md z-10`}
                  style={{ 
                    background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'}`
                  }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner" style={{ background: card.bgIcon }}>
                      <card.Icon sx={{ fontSize: 22, color: card.color }} />
                    </div>
                    <span className="font-bold text-sm">{card.title}</span>
                  </div>
                  <p style={{ color: c.textMuted }} className="text-xs leading-relaxed">{card.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
