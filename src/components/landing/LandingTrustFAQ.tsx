import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Minus, HelpCircle, Sparkles, ShieldCheck, Accessibility, Brain, Eye } from 'lucide-react';
import { t } from '../../i18n';
import { LandingSectionProps } from './types';

export const LandingTrust: React.FC<LandingSectionProps> = ({ c, isDark }) => {
  const highlights = [
    { icon: Brain, label: 'Google Gemini', tag: 'IA Multimodal' },
    { icon: Accessibility, label: 'Avatar em Língua Gestual', tag: 'Acessibilidade Surdos' },
    { icon: Eye, label: 'Audiodescrição em Tempo Real', tag: 'Acessibilidade Cegos' },
    { icon: ShieldCheck, label: 'Segurança & Guardrails Éticos', tag: 'Conformidade de IA' }
  ];

  return (
    <section className="py-12 px-4 sm:px-6 lg:px-8 border-y" style={{ background: c.bgAlt, borderColor: c.border }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
          {highlights.map((item, idx) => (
            <div 
              key={idx} 
              className="flex items-center gap-3.5 p-3 rounded-2xl transition-all duration-300"
            >
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                style={{ background: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EEF2FF' }}
              >
                <item.icon size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-heading font-bold text-xs sm:text-sm tracking-tight leading-snug" style={{ color: c.text }}>
                  {item.label}
                </p>
                <span className="text-[10px] font-semibold tracking-wide uppercase text-blue-600 dark:text-blue-400 opacity-90">
                  {item.tag}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const LandingFAQ: React.FC<LandingSectionProps> = ({ lang, c, isDark }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    { q: t(lang, 'faq1Q'), a: t(lang, 'faq1A') },
    { q: t(lang, 'faq2Q'), a: t(lang, 'faq2A') },
    { q: t(lang, 'faq3Q'), a: t(lang, 'faq3A') },
    { q: t(lang, 'faq4Q'), a: t(lang, 'faq4A') },
  ];

  return (
    <section id="faq" className="py-24 px-4 sm:px-6 lg:px-8 relative" style={{ background: c.bgAlt }}>
      <div className="max-w-3xl mx-auto">
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/20 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10">
            <HelpCircle size={13} />
            <span>Perguntas Frequentes</span>
          </div>

          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight" style={{ color: c.text }}>
            {t(lang, 'faqTitle')}
          </h2>
          <p style={{ color: c.textMuted }} className="text-base sm:text-lg leading-relaxed">
            {t(lang, 'faqSubtitle')}
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-3xl overflow-hidden border transition-all duration-300"
              style={{ 
                background: c.bgCard, 
                borderColor: openIndex === i ? c.accent : c.border,
                boxShadow: openIndex === i ? c.cardShadow : 'none'
              }}
            >
              <button 
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full p-6 sm:p-7 flex justify-between items-center text-left gap-4"
              >
                <span className="font-heading font-bold text-base sm:text-lg tracking-tight" style={{ color: c.text }}>
                  {faq.q}
                </span>
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
                  style={{ background: openIndex === i ? (isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF') : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9') }}
                >
                  {openIndex === i ? (
                    <Minus size={16} style={{ color: c.accent }} />
                  ) : (
                    <Plus size={16} style={{ color: c.textMuted }} />
                  )}
                </div>
              </button>
              
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="px-6 sm:px-7 pb-6 sm:pb-7 text-sm sm:text-base leading-relaxed" style={{ color: c.textMuted }}>
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
