import React from 'react';
import { VolumeUp, Videocam, Psychology, MenuBook, TrendingUp, Public } from '@mui/icons-material';
import { motion } from 'motion/react';
import { t } from '../../i18n';
import { LandingSectionProps } from './types';

export const LandingFeatures: React.FC<LandingSectionProps> = ({ lang, c }) => {
  const gradient = 'linear-gradient(to right, #4285f4, #ea4335, #fbbc05, #34a853)';
  const features = [
    { Icon: VolumeUp, title: t(lang, 'feat1Title'), description: t(lang, 'feat1Desc') },
    { Icon: Videocam, title: t(lang, 'feat2Title'), description: t(lang, 'feat2Desc') },
    { Icon: Psychology, title: t(lang, 'feat3Title'), description: t(lang, 'feat3Desc') },
    { Icon: MenuBook, title: t(lang, 'feat4Title'), description: t(lang, 'feat4Desc') },
    { Icon: TrendingUp, title: t(lang, 'feat5Title'), description: t(lang, 'feat5Desc') },
    { Icon: Public, title: t(lang, 'feat6Title'), description: t(lang, 'feat6Desc') },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
  };

  return (
    <section id="features" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: c.featureBg }}>
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold mb-4">
            {t(lang, 'featTitle1')}
            <span style={{ background: gradient, backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {t(lang, 'featTitle2')}
            </span>
          </h2>
          <p style={{ color: c.textMuted }} className="text-xl max-w-2xl mx-auto">{t(lang, 'featSubtitle')}</p>
        </motion.div>
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, idx) => (
            <motion.div 
              key={idx} 
              variants={itemVariants}
              whileHover={{ y: -10, transition: { duration: 0.2 } }}
              className="rounded-2xl p-8 hover:shadow-lg transition group cursor-pointer"
              style={{ background: c.bgCard }}
            >
              <div className="w-14 h-14 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition"
                style={{ background: c.featureIconBg }}>
                <feature.Icon sx={{ fontSize: 28, color: c.accent }} />
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p style={{ color: c.textMuted }}>{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export const LandingHowItWorks: React.FC<LandingSectionProps> = ({ lang, c }) => {
  const steps = [
    { number: '1', title: t(lang, 'step1Title'), description: t(lang, 'step1Desc') },
    { number: '2', title: t(lang, 'step2Title'), description: t(lang, 'step2Desc') },
    { number: '3', title: t(lang, 'step3Title'), description: t(lang, 'step3Desc') },
    { number: '4', title: t(lang, 'step4Title'), description: t(lang, 'step4Desc') },
  ];

  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: c.bg }}>
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold mb-4">{t(lang, 'howTitle')}</h2>
          <p style={{ color: c.textMuted }} className="text-xl">{t(lang, 'howSubtitle')}</p>
        </motion.div>
        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              className="relative"
            >
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
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
