import React from 'react';
import { CheckCircle, ArrowForward } from '@mui/icons-material';
import { motion } from 'motion/react';
import { t } from '../../i18n';
import { LandingSectionProps } from './types';

export const LandingCaseStudies: React.FC<LandingSectionProps> = ({ lang, c, isDark }) => {
  const stories = [
    {
      name: 'Tiago Matias', subject: 'Full Stack Development', improvement: '+85%',
      quote: lang === 'pt' ? 'Ngola Tutor ajudou tremendamente no meu aprendizado em desenvolvimento. Excelente ferramenta!' : 'Ngola Tutor tremendously helped my learning in development. Excellent tool!',
      avatar: 'https://avatars.githubusercontent.com/u/35434705'
    },
    {
      name: 'Tatiana', subject: 'Web Development', improvement: '+70%',
      quote: lang === 'pt' ? 'A qualidade das explicações é impressionante. Finalmente entendi conceitos complexos de forma clara.' : 'The quality of explanations is impressive. I finally understood complex concepts clearly.',
      avatar: 'https://avatars.githubusercontent.com/u/78913806'
    },
    {
      name: 'Manuel', subject: 'Software Engineering', improvement: '+75%',
      quote: lang === 'pt' ? 'Com o Ngola Tutor consegui melhorar meu código e entender design patterns muito melhor.' : 'With Ngola Tutor I improved my code and understood design patterns much better.',
      avatar: 'https://avatars.githubusercontent.com/u/45087017'
    },
    {
      name: 'Iacene', subject: 'Computer Science', improvement: '+80%',
      quote: lang === 'pt' ? 'Essa é a melhor ferramenta de aprendizado que já experimentei. Altamente recomendado!' : 'This is the best learning tool I have ever tried. Highly recommended!',
      avatar: 'https://avatars.githubusercontent.com/u/52156325'
    },
  ];

  return (
    <section id="case-studies" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: c.caseBg }}>
      <div className="max-w-7xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl lg:text-5xl font-bold mb-4">{t(lang, 'caseTitle')}</h2>
          <p style={{ color: c.textMuted }} className="text-xl">{t(lang, 'caseSubtitle')}</p>
        </motion.div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stories.map((story, idx) => (
            <motion.div 
              key={idx} 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 0.5 }}
              whileHover={{ y: -5 }}
              className="rounded-2xl p-8 hover:shadow-lg transition"
              style={{ background: c.caseCardBg, boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <img src={`${story.avatar}?s=80`} alt={story.name}
                className="w-16 h-16 rounded-full mb-4 object-cover" style={{ border: `2px solid ${c.border}` }} />
              <div className="text-3xl font-bold mb-2" style={{ color: c.accent }}>{story.improvement}</div>
              <p className="font-semibold mb-1">{story.name}</p>
              <p className="text-sm mb-4" style={{ color: c.textMuted }}>{story.subject}</p>
              <p className="italic text-sm" style={{ color: c.text }}>"{story.quote}"</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export const LandingAbout: React.FC<LandingSectionProps> = ({ lang, c }) => {
  return (
    <section id="about" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: c.bg }}>
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">{t(lang, 'aboutTitle')}</h2>
            <div className="space-y-6">
              <p>{t(lang, 'aboutP1')}</p>
              <p>{t(lang, 'aboutP2')}</p>
              <div className="space-y-3">
                {[t(lang, 'aboutItem1'), t(lang, 'aboutItem2'), t(lang, 'aboutItem3'), t(lang, 'aboutItem4')].map((item, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle sx={{ fontSize: 24, color: '#188038', flexShrink: 0, marginTop: '2px' }} />
                    <span>{item}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export const LandingCTA: React.FC<LandingSectionProps & { onStartLearning: () => void }> = ({ lang, isDark, onStartLearning }) => {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden" style={{ background: `url('/aluno.jpg') center/cover no-repeat` }}>
      <div className="absolute inset-0" style={{ background: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.3)' }} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="max-w-4xl mx-auto text-center text-white relative z-10"
      >
        <h2 className="text-4xl lg:text-5xl font-bold mb-6 mt-2 p-4">{t(lang, 'ctaTitle')}</h2>
        <p className="text-xl mb-8 opacity-90">{t(lang, 'ctaDesc')}</p>
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStartLearning}
          className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:shadow-xl transition inline-flex items-center gap-2"
        >
          {t(lang, 'ctaBtn')}
          <ArrowForward sx={{ fontSize: 20 }} />
        </motion.button>
      </motion.div>
    </section>
  );
};
