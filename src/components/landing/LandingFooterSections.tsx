import React from 'react';
import { CheckCircle2, ArrowRight, Star, Sparkles, Quote, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { t } from '../../i18n';
import { LandingSectionProps } from './types';

export const LandingCaseStudies: React.FC<LandingSectionProps> = ({ lang, c, isDark }) => {
  const stories = [
    {
      name: 'Tiago Matias',
      subject: 'Desenvolvimento Full Stack',
      improvement: '+85%',
      quote: lang === 'pt' ? 'O Ngola Tutor revolucionou a forma como compreendo algoritmos e arquitetura de software.' : 'Ngola Tutor revolutionized how I understand algorithms and software architecture.',
      avatar: 'https://avatars.githubusercontent.com/u/35434705'
    },
    {
      name: 'Tatiana',
      subject: 'Desenvolvimento Web',
      improvement: '+70%',
      quote: lang === 'pt' ? 'A paciência do tutor e o quadro interativo tornam conceitos difíceis super claros e visuais.' : 'The tutor’s patience and the interactive whiteboard make difficult concepts super clear and visual.',
      avatar: 'https://avatars.githubusercontent.com/u/78913806'
    },
    {
      name: 'Manuel',
      subject: 'Engenharia de Software',
      improvement: '+75%',
      quote: lang === 'pt' ? 'Com o suporte socrático aprendi a deduzir a resposta sozinho sem ficar dependente de soluções prontas.' : 'With the Socratic support I learned to deduce answers by myself without relying on ready-made solutions.',
      avatar: 'https://avatars.githubusercontent.com/u/45087017'
    },
    {
      name: 'Iacene',
      subject: 'Ciência da Computação',
      improvement: '+80%',
      quote: lang === 'pt' ? 'Os recursos de acessibilidade e o diálogo por voz colocam a plataforma em outro patamar de inclusão.' : 'The accessibility features and voice dialogue place the platform on another level of inclusion.',
      avatar: 'https://avatars.githubusercontent.com/u/52156325'
    },
  ];

  return (
    <section id="case-studies" className="py-24 px-4 sm:px-6 lg:px-8 relative" style={{ background: c.caseBg }}>
      <div className="max-w-7xl mx-auto">

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 space-y-3"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/20 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10">
            <Star size={13} className="text-amber-500 fill-amber-500" />
            <span>Casos de Sucesso & Depoimentos</span>
          </div>

          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight" style={{ color: c.text }}>
            {t(lang, 'caseTitle')}
          </h2>
          <p style={{ color: c.textMuted }} className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            {t(lang, 'caseSubtitle')}
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stories.map((story, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.08, duration: 0.4 }}
              whileHover={{ y: -6 }}
              className="rounded-3xl p-7 border transition-all duration-300 flex flex-col justify-between relative group"
              style={{
                background: c.caseCardBg,
                borderColor: c.border,
                boxShadow: c.cardShadow
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <img
                    src={`${story.avatar}?s=96`}
                    alt={story.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-blue-500/30 shadow-md"
                  />
                  <div className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    {story.improvement}
                  </div>
                </div>

                <h3 className="font-heading font-bold text-base" style={{ color: c.text }}>{story.name}</h3>
                <p className="text-xs font-medium mb-4" style={{ color: c.textMuted }}>{story.subject}</p>

                <p className="text-xs sm:text-sm leading-relaxed italic relative" style={{ color: c.text }}>
                  "{story.quote}"
                </p>
              </div>

              <div className="flex items-center gap-1 mt-6 text-amber-500">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={13} className="fill-amber-500" />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const LandingAbout: React.FC<LandingSectionProps> = ({ lang, c, isDark }) => {
  return (
    <section id="about" className="py-24 px-4 sm:px-6 lg:px-8 relative" style={{ background: c.bg }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-12 items-center">

          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/20 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10">
              <ShieldCheck size={14} />
              <span>Educação Inclusiva & Bem Público</span>
            </div>

            <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight" style={{ color: c.text }}>
              {t(lang, 'aboutTitle')}
            </h2>

            <div className="space-y-4 text-base sm:text-lg leading-relaxed" style={{ color: c.textMuted }}>
              <p>{t(lang, 'aboutP1')}</p>
              <p>{t(lang, 'aboutP2')}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 pt-4">
              {[t(lang, 'aboutItem1'), t(lang, 'aboutItem2'), t(lang, 'aboutItem3'), t(lang, 'aboutItem4')].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-3 p-3.5 rounded-2xl border transition-all duration-200"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                    borderColor: c.border
                  }}
                >
                  <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-sm font-semibold leading-snug" style={{ color: c.text }}>
                    {item}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="lg:col-span-5 relative"
          >

            <div>
              <img src="/aluno.jpg" alt="alunos" className='rounded-2xl' />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export const LandingCTA: React.FC<LandingSectionProps & { onStartLearning: () => void }> = ({ lang, isDark, onStartLearning }) => {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Image & Overlay */}
      <div
        className="absolute inset-0 z-0 scale-105"
        style={{
          background: `url('/aluno.jpg') center/cover no-repeat`,
        }}
      />
      <div
        className="absolute inset-0 z-0 backdrop-blur-xs"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(8,12,20,0.92) 0%, rgba(15,23,42,0.88) 100%)'
            : 'linear-gradient(135deg, rgba(37,99,235,0.9) 0%, rgba(255, 255, 255, 0) 100%)'
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7 }}
        className="max-w-4xl mx-auto text-center text-white relative z-10 space-y-6"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold tracking-wider uppercase">
          <span>Comece Gratuitamente Agora</span>
        </div>

        <h2 className="font-heading text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
          {t(lang, 'ctaTitle')}
        </h2>

        <p className="text-base sm:text-xl font-normal opacity-90 max-w-2xl mx-auto leading-relaxed">
          {t(lang, 'ctaDesc')}
        </p>

        <div className="pt-4">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onStartLearning}
            className="px-9 py-4 bg-white text-blue-600 rounded-2xl font-bold text-sm tracking-wide shadow-2xl hover:shadow-white/20 transition-all inline-flex items-center gap-3 group"
          >
            <span>{t(lang, 'ctaBtn')}</span>
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform text-blue-600" />
          </motion.button>
        </div>
      </motion.div>
    </section>
  );
};
