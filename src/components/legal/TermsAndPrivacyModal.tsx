import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, MapPin, Cpu, HardDrive, Check, X, Lock, Eye, AlertCircle, ChevronRight, UserX, Mail, Database } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { ConsentPreferences, getConsentPreferences, saveConsentPreferences, clearAllUserData } from '../../utils/telemetryClient';

interface TermsAndPrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConsentUpdated?: (prefs: ConsentPreferences) => void;
}

export const TermsAndPrivacyModal: React.FC<TermsAndPrivacyModalProps> = ({
  isOpen,
  onClose,
  onConsentUpdated
}) => {
  const { c, isDark } = useTheme();
  const [showCustomize, setShowCustomize] = useState(false);
  const [showDeletionConfirm, setShowDeletionConfirm] = useState(false);

  const [locationConsent, setLocationConsent] = useState(() => getConsentPreferences().locationConsent);
  const [telemetryConsent, setTelemetryConsent] = useState(() => getConsentPreferences().telemetryConsent);
  const [cacheEnabled, setCacheEnabled] = useState(() => getConsentPreferences().cacheEnabled);

  const handleAcceptAll = () => {
    const updated = saveConsentPreferences({
      locationConsent: true,
      telemetryConsent: true,
      cacheEnabled: true,
    });
    onConsentUpdated?.(updated);
    onClose();
  };

  const handleRejectNonEssential = () => {
    const updated = saveConsentPreferences({
      locationConsent: false,
      telemetryConsent: false,
      cacheEnabled: false,
    });
    onConsentUpdated?.(updated);
    onClose();
  };

  const handleSaveCustom = () => {
    const updated = saveConsentPreferences({
      locationConsent,
      telemetryConsent,
      cacheEnabled,
    });
    onConsentUpdated?.(updated);
    onClose();
  };

  const handleDeleteData = () => {
    clearAllUserData();
    setShowDeletionConfirm(true);
    setTimeout(() => {
      setShowDeletionConfirm(false);
      window.location.reload();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 backdrop-blur-md bg-black/60 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-2xl rounded-3xl border shadow-2xl overflow-hidden my-8"
          style={{
            backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
            borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#E2E8F0',
            boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(15, 23, 42, 0.15)'
          }}
        >
          {/* Top Banner */}
          <div className="p-3 sm:p-4 pb-2 border-b" style={{ borderColor: c.border }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 dark:bg-blue-500/15 flex items-center justify-center border border-blue-500/20 text-blue-600 dark:text-blue-400">
                  <ShieldCheck size={26} />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-xl sm:text-2xl tracking-tight" style={{ color: c.text }}>
                    Aviso de Privacidade (LGPD)
                  </h3>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mt-0.5">
                    Transparência, Direitos & Escolha
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm mt-4 leading-relaxed" style={{ color: c.textMuted }}>
              O <strong>Ngola Tutor AI - Projeto Educacional</strong> (Controlador de Dados) respeita a sua privacidade de acordo com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong>. Detalhamos abaixo como seus dados são tratados e quais as bases legais. Utilizamos Local Storage e Session Storage (cookies locais) para o funcionamento do app.
            </p>
          </div>

          {/* Body Content */}
          <div className="p-6 sm:p-8 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
            
            {/* 1. Localização & Endereço IP */}
            <div 
              className="p-4 sm:p-5 rounded-2xl border transition-all duration-200"
              style={{ 
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#F8FAFC',
                borderColor: c.border 
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-500 mt-0.5">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-sm" style={{ color: c.text }}>
                      1. Acesso à Localização Aproximada
                    </h4>
                    <p className="text-xs leading-relaxed mt-1" style={{ color: c.textMuted }}>
                      <strong>Propósito:</strong> Roteamento otimizado de servidores e métricas regionais.<br/>
                      <strong>Base Legal:</strong> Consentimento (Art. 7, I, LGPD).<br/>
                      <strong>Retenção:</strong> 90 dias no servidor.
                    </p>
                  </div>
                </div>

                {showCustomize && (
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input 
                      type="checkbox" 
                      checked={locationConsent} 
                      onChange={(e) => setLocationConsent(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                )}
              </div>
            </div>

            {/* 2. Telemetria, Tokens & Monitoramento de Estabilidade */}
            <div 
              className="p-4 sm:p-5 rounded-2xl border transition-all duration-200"
              style={{ 
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#F8FAFC',
                borderColor: c.border 
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-500 mt-0.5">
                    <Cpu size={18} />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-sm" style={{ color: c.text }}>
                      2. Telemetria de Desempenho
                    </h4>
                    <p className="text-xs leading-relaxed mt-1" style={{ color: c.textMuted }}>
                      <strong>Propósito:</strong> Monitorar estabilidade, tempo de uso e consumo de IA.<br/>
                      <strong>Base Legal:</strong> Interesse Legítimo (Art. 7, IX, LGPD).<br/>
                      <strong>Retenção:</strong> 90 dias no servidor.
                    </p>
                  </div>
                </div>

                {showCustomize && (
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input 
                      type="checkbox" 
                      checked={telemetryConsent} 
                      onChange={(e) => setTelemetryConsent(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                )}
              </div>
            </div>

            {/* 3. Permissão de Cache & Resiliência Offline */}
            <div 
              className="p-4 sm:p-5 rounded-2xl border transition-all duration-200"
              style={{ 
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#F8FAFC',
                borderColor: c.border 
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-500 mt-0.5">
                    <HardDrive size={18} />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-sm" style={{ color: c.text }}>
                      3. Cache Local (Armazenamento)
                    </h4>
                    <p className="text-xs leading-relaxed mt-1" style={{ color: c.textMuted }}>
                      <strong>Propósito:</strong> Salvar progresso e conversas para resiliência offline.<br/>
                      <strong>Base Legal:</strong> Consentimento (Art. 7, I, LGPD).<br/>
                      <strong>Retenção:</strong> Até limpeza pelo usuário.
                    </p>
                  </div>
                </div>

                {showCustomize && (
                  <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                    <input 
                      type="checkbox" 
                      checked={cacheEnabled} 
                      onChange={(e) => setCacheEnabled(e.target.checked)}
                      className="sr-only peer" 
                    />
                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                )}
              </div>
            </div>

            {/* Seção Direitos do Titular */}
            <div className="pt-4 border-t" style={{ borderColor: c.border }}>
              <h4 className="font-heading font-bold text-sm mb-3 flex items-center gap-2" style={{ color: c.text }}>
                <Lock size={16} className="text-blue-500" />
                Seus Direitos (Art. 18, LGPD)
              </h4>
              <ul className="text-xs space-y-2 mb-4" style={{ color: c.textMuted }}>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500"/> Confirmação, Acesso e Portabilidade de Dados</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500"/> Correção de dados incompletos ou inexatos</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500"/> Eliminação de dados e Revogação do Consentimento</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-emerald-500"/> Informação sobre compartilhamento</li>
              </ul>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleDeleteData}
                  disabled={showDeletionConfirm}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                >
                  <UserX size={14} />
                  {showDeletionConfirm ? 'Dados Apagados!' : 'Solicitar Exclusão de Dados'}
                </button>
              </div>
            </div>

            {/* Contato DPO */}
            <div className="pt-2">
              <p className="text-xs flex items-center gap-2" style={{ color: c.textMuted }}>
                <Mail size={14} />
                Contato do DPO (Encarregado): <strong>dpo@ngolatutor.ai</strong>
              </p>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="p-6 sm:p-8 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: c.border }}>
            <button
              onClick={() => setShowCustomize(!showCustomize)}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {showCustomize ? 'Ocultar Opções Detalhadas' : 'Personalizar Permissões'}
              <ChevronRight size={14} className={showCustomize ? 'rotate-90 transition-transform' : ''} />
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              {showCustomize ? (
                <button
                  onClick={handleSaveCustom}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-300 transition-colors"
                >
                  Salvar Preferências
                </button>
              ) : null}

              <button
                onClick={handleRejectNonEssential}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Rejeitar Não-Essenciais
              </button>

              <button
                onClick={handleAcceptAll}
                className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/25 transition-all active:scale-95"
              >
                Aceitar e Continuar
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
