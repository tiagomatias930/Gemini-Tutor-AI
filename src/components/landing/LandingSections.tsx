import React from 'react';
import { Volume2, Video, Brain, BookOpen, TrendingUp, Globe, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { t } from '../../i18n';
import { LandingSectionProps } from './types';

export const LandingFeatures: React.FC<LandingSectionProps> = ({ lang, c, isDark }) => {
  const gradient = 'linear-gradient(135deg, #2563EB 0%, #6366F1 50%, #2563EB 100%)';

  const features = [
    {
      Icon: Volume2,
      title: t(lang, 'feat1Title'),
      description: t(lang, 'feat1Desc'),
      color: '#3B82F6',
      bgLight: '#EFF6FF',
      bgDark: 'rgba(59, 130, 246, 0.15)'
    },
    {
      Icon: Video,
      title: t(lang, 'feat2Title'),
      description: t(lang, 'feat2Desc'),
      color: '#F43F5E',
      bgLight: '#FFF1F2',
      bgDark: 'rgba(244, 63, 94, 0.15)'
    },
    {
      Icon: Brain,
      title: t(lang, 'feat3Title'),
      description: t(lang, 'feat3Desc'),
      color: '#8B5CF6',
      bgLight: '#F5F3FF',
      bgDark: 'rgba(139, 92, 246, 0.15)'
    },
    {
      Icon: BookOpen,
      title: t(lang, 'feat4Title'),
      description: t(lang, 'feat4Desc'),
      color: '#10B981',
      bgLight: '#ECFDF5',
      bgDark: 'rgba(16, 185, 129, 0.15)'
    },
    {
      Icon: TrendingUp,
      title: t(lang, 'feat5Title'),
      description: t(lang, 'feat5Desc'),
      color: '#F59E0B',
      bgLight: '#FFFBEB',
      bgDark: 'rgba(245, 158, 11, 0.15)'
    },
    {
      Icon: Globe,
      title: t(lang, 'feat6Title'),
      description: t(lang, 'feat6Desc'),
      color: '#06B6D4',
      bgLight: '#ECFEFF',
      bgDark: 'rgba(6, 182, 212, 0.15)'
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 relative" style={{ background: c.featureBg }}>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/20 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10">
            <span>Recursos e Inovações</span>
          </div>

          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            {t(lang, 'featTitle1')}{' '}
            <span style={{ background: gradient, backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {t(lang, 'featTitle2')}
            </span>
          </h2>
          <p style={{ color: c.textMuted }} className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            {t(lang, 'featSubtitle')}
          </p>
        </motion.div>

        {/* Feature Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, idx) => (
            <motion.div
              key={idx}
              variants={itemVariants}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
              className="rounded-3xl p-8 border transition-all duration-300 group relative overflow-hidden"
              style={{
                background: c.bgCard,
                borderColor: c.border,
                boxShadow: c.cardShadow
              }}
            >
              {/* Subtle hover corner glow */}
              <div
                className="absolute top-0 right-0 w-32 h-32 blur-3xl opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none rounded-full"
                style={{ background: feature.color }}
              />

              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm"
                style={{ background: isDark ? feature.bgDark : feature.bgLight }}
              >
                <feature.Icon size={26} style={{ color: feature.color }} />
              </div>

              <h3 className="font-heading text-xl font-bold mb-3 tracking-tight" style={{ color: c.text }}>
                {feature.title}
              </h3>

              <p style={{ color: c.textMuted }} className="text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export const LandingHowItWorks: React.FC<LandingSectionProps> = ({ lang, c, isDark }) => {
  const steps = [
    { number: '01', title: t(lang, 'step1Title'), description: t(lang, 'step1Desc') },
    { number: '02', title: t(lang, 'step2Title'), description: t(lang, 'step2Desc') },
    { number: '03', title: t(lang, 'step3Title'), description: t(lang, 'step3Desc') },
    { number: '04', title: t(lang, 'step4Title'), description: t(lang, 'step4Desc') },
  ];

  return (
    <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8" style={{ background: c.bg }}>
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/20 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-500/10">
            <span>Passo a Passo</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight" style={{ color: c.text }}>
            {t(lang, 'howTitle')}
          </h2>
          <p style={{ color: c.textMuted }} className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            {t(lang, 'howSubtitle')}
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.4 }}
              whileHover={{ y: -4 }}
              className="rounded-3xl p-8 text-left transition-all duration-300 relative border group"
              style={{
                background: c.bgCard,
                borderColor: c.stepBorder,
                boxShadow: c.cardShadow
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <span className="font-heading font-black text-3xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  {step.number}
                </span>
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight size={14} className="text-blue-500" />
                </div>
              </div>

              <h3 className="font-heading text-lg font-bold mb-2 tracking-tight" style={{ color: c.text }}>
                {step.title}
              </h3>
              <p style={{ color: c.textMuted }} className="text-xs sm:text-sm leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
