import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Add, Remove, Google, GitHub, School , Work} from '@mui/icons-material';
import { t } from '../../i18n';
import { LandingSectionProps } from './types';

export const LandingTrust: React.FC<LandingSectionProps> = ({ c, isDark }) => {
  const partners = [
    { name: 'Google Gemini', Icon: Google },
    { name: '42 Luanda', Icon: Work },
    { name: 'GitHub Education', Icon: GitHub }
    ];

  return (
    <div className="py-12 border-y" style={{ borderColor: c.border, background: c.bgAlt }}>
      <div className="max-w-7xl mx-auto px-4">
        <p className="text-center text-sm font-medium mb-8 uppercase tracking-widest opacity-60">
          Powered by Tiago Matias, Mauro Gunza, and Constância Tati
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
          {partners.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <p className="font-bold text-xl md:text-2xl tracking-tighter">{p.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
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
    <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: c.bgAlt }}>
      <div className="max-w-3xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold mb-4">{t(lang, 'faqTitle')}</h2>
          <p style={{ color: c.textMuted }} className="text-xl">{t(lang, 'faqSubtitle')}</p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl overflow-hidden border transition-all duration-300"
              style={{ 
                background: c.bgCard, 
                borderColor: openIndex === i ? c.accent : c.border,
                boxShadow: openIndex === i ? c.cardShadow : 'none'
              }}
            >
              <button 
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full p-6 flex justify-between items-center text-left"
              >
                <span className="font-bold text-lg">{faq.q}</span>
                {openIndex === i ? <Remove style={{ color: c.accent }} /> : <Add />}
              </button>
              <AnimatePresence>
                {openIndex === i && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="px-6 pb-6" style={{ color: c.textMuted }}>
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
