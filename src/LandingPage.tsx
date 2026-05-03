import React, { useState } from 'react';
import {
  VolumeUp,
  Videocam,
  Psychology,
  TrendingUp,
  People,
  Chat,
  ArrowForward,
  CheckCircle,
  Menu,
  Close,
  Public,
  Email,
  Phone,
  Facebook,
  Twitter,
  LinkedIn,
  GitHub,
  AutoAwesome,
  MenuBook,
  Palette,
} from '@mui/icons-material';
import { url } from 'inspector';

interface LandingPageProps {
  onStartLearning: () => void;
}

export function LandingPage({ onStartLearning }: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('home');

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth' });
    setActiveNav(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="w-full min-h-screen bg-white text-gray-900">
      {/* ─── NAVIGATION ─── */}
      <nav className="fixed top-0 w-full bg-white/95 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            {/* Logo */}

            {/* Title — scales from 2.5rem on small mobile to 4rem on desktop */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-normal tracking-tight text-slate-800 mb-3 text-center leading-tight">
              <span className="text-[#4285f4]">G</span><span className="text-[#ea4335]">e</span>
              <span className="text-[#fbbc05]">m</span><span className="text-[#4285f4]">i</span>
              <span className="text-[#34a853]">n</span><span className="text-[#ea4335]">i</span>
              <span className="text-slate-800"> Tutor</span>
            </h1>
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              {[
                { id: 'home', label: 'Home' },
                { id: 'features', label: 'Features' },
                { id: 'case-studies', label: 'Case Studies' },
                { id: 'about', label: 'About' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-sm font-medium transition ${activeNav === item.id
                    ? 'text-[#1a73e8]'
                    : 'text-[#5f6368] hover:text-[#1a73e8]'
                    }`}
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={onStartLearning}
                className="px-6 py-2.5 bg-[#1a73e8] text-white rounded-lg font-medium hover:bg-[#1765cc] transition"
              >
                Get Started
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <Close sx={{ fontSize: 24 }} /> : <Menu sx={{ fontSize: 24 }} />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden pb-4 border-t border-[#e8eaed]">
              {[
                { id: 'home', label: 'Home' },
                { id: 'features', label: 'Features' },
                { id: 'case-studies', label: 'Case Studies' },
                { id: 'about', label: 'About' },
                { id: 'contact', label: 'Contact' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="block w-full text-left px-4 py-2 text-[#5f6368] hover:text-[#1a73e8] font-medium"
                >
                  {item.label}
                </button>
              ))}
              <button
                onClick={onStartLearning}
                className="w-full mt-2 mx-4 px-6 py-2.5 bg-[#1a73e8] text-white rounded-lg font-medium hover:bg-[#1765cc]"
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ─── HERO SECTION ─── */}
      <section id="home" className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 mt-20 min-h-screen flex items-center">
        <div className="max-w-7xl mx-auto w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="inline-block px-4 py-2 bg-[#e8f0fe] rounded-full">
                  <span className="text-[#1a73e8] font-medium text-sm">Welcome to Next Generation Learning with Gemini Tutor</span>
                </div>
                <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                  Master Any{' '}
                  <span style={{ background: 'linear-gradient(to right, #4285f4, #ea4335, #fbbc05, #34a853)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Subject With AI
                  </span>
                </h1>
                <p className="text-xl text-[#5f6368]">
                  Get personalized tutoring with voice, video, and AI-generated illustrations.
                  Gemini Tutor adapts to your learning style and pace.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={onStartLearning}
                  className="px-8 py-4 bg-[#1a73e8] text-white rounded-lg font-semibold hover:bg-[#1765cc] transition flex items-center justify-center gap-2 group"
                >
                  Start Learning Now
                  <ArrowForward sx={{ fontSize: 20, transition: 'transform 0.2s' }} className="group-hover:translate-x-1" />
                </button>
                <button
                  onClick={() => scrollToSection('features')}
                  className="px-8 py-4 border-2 border-[#dadce0] text-[#202124] rounded-lg font-semibold hover:border-[#1a73e8] hover:text-[#1a73e8] transition"
                >
                  Learn More
                </button>
              </div>

            </div>

            {/* Right Visual */}
            <div className="relative hidden lg:block">
              <div className="relative w-full aspect-square">
                {/* Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#f8f9fa] via-white to-transparent rounded-3xl" style={{ background: `url('/Main.jpg')`, opacity: 0.6, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }} />

                {/* Floating cards */}
                <div className="absolute top-1 right-1 w-38 h-32 bg-white rounded-2xl shadow-lg p-6 transform hover:scale-105 transition">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#e8f0fe] rounded-lg flex items-center justify-center">
                      <Psychology sx={{ fontSize: 20, color: '#1a73e8' }} />
                    </div>
                    <span className="font-semibold text-sm">AI Learning</span>
                  </div>
                  <p className="text-xs text-gray-600">Personalized paths for each student</p>
                </div>

                <div className="absolute bottom-1 left-1 w-38 h-32 bg-white rounded-2xl shadow-lg p-6 transform hover:scale-105 transition">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#fce5cd] rounded-lg flex items-center justify-center">
                      <VolumeUp sx={{ fontSize: 20, color: '#d33b27' }} />
                    </div>
                    <span className="font-semibold text-sm">Voice Mode</span>
                  </div>
                  <p className="text-xs text-gray-600">Natural conversation learning</p>
                </div>

                <div className="absolute bottom-1/4 right-8 w-38 h-32 bg-white rounded-2xl shadow-lg p-6 transform hover:scale-105 transition">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#e6f4ea] rounded-lg flex items-center justify-center">
                      <CheckCircle sx={{ fontSize: 20, color: '#188038' }} />
                    </div>
                    <span className="font-semibold text-sm">Instant Help</span>
                  </div>
                  <p className="text-xs text-gray-600">Get answers to your questions immediately</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* ─── FEATURES SECTION ─── */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">
              Powerful Features for{' '}
              <span style={{ background: 'linear-gradient(to right, #4285f4, #ea4335, #fbbc05, #34a853)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Better Learning
              </span>
            </h2>
            <p className="text-xl text-[#5f6368] max-w-2xl mx-auto">
              Everything you need to master any subject at your own pace
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                Icon: VolumeUp,
                title: 'Voice Conversation',
                description: 'Natural conversation with AI tutor using voice. Supported in multiple languages.'
              },
              {
                Icon: Videocam,
                title: 'Visual Learning',
                description: 'Share images, diagrams, and documents. AI will analyze and explain them.'
              },
              {
                Icon: Psychology,
                title: 'Adaptive Learning',
                description: 'AI learns your level and adjusts explanations accordingly, from beginner to advanced.'
              },
              {
                Icon: MenuBook,
                title: 'Multi-Subject',
                description: 'Support for 150+ subjects: Math, Science, Languages, History, and more.'
              },
              {
                Icon: TrendingUp,
                title: 'Progress Tracking',
                description: 'Monitor your learning progress and understand your strengths and improvements.'
              },
              {
                Icon: Public,
                title: 'Multilingual',
                description: 'Learn in Portuguese, English, French, Spanish and many other languages.'
              }
            ].map((feature, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-8 hover:shadow-lg transition group cursor-pointer"
              >
                <div className="w-14 h-14 bg-[#f1f3f4] rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition">
                  <feature.Icon sx={{ fontSize: 28, color: '#1a73e8' }} />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">How Gemini Tutor Works</h2>
            <p className="text-xl text-gray-600">A simple process to get personalized learning</p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              { number: '1', title: 'Get Started', description: 'Start learning today' },
              { number: '2', title: 'Click in Get API Key ', description: 'Get your API key' },
              { number: '3', title: 'Start Session', description: 'Begin with voice, video, or text' },
              { number: '4', title: 'Learn & Progress', description: 'Get instant help and track progress' }
            ].map((step, idx) => (
              <div key={idx} className="relative">
                {idx < 3 && (
                  <div className="hidden md:block absolute top-1/4 left-full w-full h-1 bg-gradient-to-r from-blue-600 to-transparent transform -translate-y-1/2" />
                )}
                <div className="bg-white rounded-2xl p-8 text-center border-2 border-[#e8eaed] hover:border-[#1a73e8] transition">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-white">{step.number}</span>
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-gray-600">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CASE STUDIES ─── */}
      <section id="case-studies" className="py-20 px-4 sm:px-6 lg:px-8 bg-[#f8f9fa]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl lg:text-5xl font-bold mb-4">Student Success Stories</h2>
            <p className="text-xl text-gray-600">See how students improved with Gemini Tutor</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                name: 'Tiago Matias',
                subject: 'Full Stack Development',
                improvement: '+85%',
                quote: 'Gemini Tutor ajudou tremendamente no meu aprendizado em desenvolvimento. Excelente ferramenta!',
                avatar: 'https://avatars.githubusercontent.com/u/35434705'
              },
              {
                name: 'Tatiana',
                subject: 'Web Development',
                improvement: '+70%',
                quote: 'A qualidade das explicações é impressionante. Finalmente entendi conceitos complexos de forma clara.',
                avatar: 'https://avatars.githubusercontent.com/u/78913806'
              },
              {
                name: 'Manuel',
                subject: 'Software Engineering',
                improvement: '+75%',
                quote: 'Com o Gemini Tutor consegui melhorar meu código e entender design patterns muito melhor.',
                avatar: 'https://avatars.githubusercontent.com/u/45087017'
              },
              {
                name: 'Iacene',
                subject: 'Computer Science',
                improvement: '+80%',
                quote: 'Essa é a melhor ferramenta de aprendizado que já experimentei. Altamente recomendado!',
                avatar: 'https://avatars.githubusercontent.com/u/52156325'
              }
            ].map((story, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition">
                <img
                  src={`${story.avatar}?s=80`}
                  alt={story.name}
                  className="w-16 h-16 rounded-full mb-4 border-2 border-[#e8eaed] object-cover"
                />
                <div className="text-3xl font-bold text-[#1a73e8] mb-2">{story.improvement}</div>
                <p className="font-semibold text-[#202124] mb-1">{story.name}</p>
                <p className="text-sm text-[#5f6368] mb-4">{story.subject}</p>
                <p className="text-[#202124] italic text-sm">"{story.quote}"</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ABOUT SECTION ─── */}
      <section id="about" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">About Gemini Tutor</h2>
              <div className="space-y-6 text-[#202124]">
                <p>
                  Gemini Tutor is powered by Google's advanced Gemini AI, bringing state-of-the-art
                  artificial intelligence to personalized education. We believe every student deserves
                  access to a patient, knowledgeable tutor available 24/7.
                </p>
                <p>
                  Our platform combines the latest in AI technology with proven pedagogical methods,
                  allowing students to learn at their own pace, in their own style, and in their preferred language.
                </p>
                <div className="space-y-3">
                  {[
                    'Personalized learning paths based on student level',
                    'Multi-modal support: voice, video, and text',
                    'Support for 150+ subjects and topics',
                    '24/7 availability - learn whenever you want']
                    .map((item) => 
                      (
                      <div className="flex items-start gap-3">
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
      <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: `url('/aluno.jpg')`, opacity: 1.5, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl lg:text-5xl font-bold mb-6 bg-border-black mt-2 p-4;">Ready to Transform Your Learning?</h2>
          <p className="text-xl mb-8 opacity-130">
            Start learning with AI-powered personalized tutoring today. No credit card required.
          </p>
          <button
            onClick={onStartLearning}
            className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:shadow-xl transition hover:scale-105 inline-flex items-center gap-2"
          >
            Get Started Free
            <ArrowForward sx={{ fontSize: 20 }} />
          </button>
        </div>
      </section>
    </div>
  );
}
