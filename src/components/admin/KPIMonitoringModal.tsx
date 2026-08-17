import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Clock, Cpu, Globe, MapPin, HardDrive, RefreshCw, X, ShieldAlert, Server, Users, Zap } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface KPIMonitoringModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KPIMonitoringModal: React.FC<KPIMonitoringModalProps> = ({ isOpen, onClose }) => {
  const { c, isDark } = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/telemetry/kpi');
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Error fetching KPI metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMetrics();
      const interval = setInterval(fetchMetrics, 10000); // 10s auto-refresh
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const stability = data?.stability;
  const aggregate = data?.aggregateStats;
  const sessions = data?.activeSessions || [];
  const geo = data?.geoDistribution || {};

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-black/60 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-5xl rounded-3xl border shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]"
          style={{
            backgroundColor: isDark ? '#080C14' : '#FFFFFF',
            borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#E2E8F0',
          }}
        >
          {/* Modal Header */}
          <div className="p-6 border-b flex items-center justify-between gap-4" style={{ borderColor: c.border, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-500">
                <Activity size={22} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-heading font-extrabold text-lg sm:text-xl" style={{ color: c.text }}>
                  Painel de Monitoramento & KPIs do Sistema
                </h3>
                <p className="text-xs font-semibold text-slate-400">
                  Métricas em Tempo Real • Tokens, Tempo de Uso, Localizações e Estabilidade
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchMetrics}
                disabled={loading}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-slate-400 hover:text-blue-500"
                title="Atualizar Métricas"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin text-blue-500' : ''} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-slate-400 hover:text-red-500"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            
            {/* Top KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              
              {/* Estabilidade do Sistema */}
              <div className="p-5 rounded-2xl border" style={{ backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: c.border }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1">
                    <Server size={14} /> Estabilidade
                  </span>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="font-heading font-black text-2xl" style={{ color: c.text }}>
                  {aggregate?.systemUptimePercent ?? 100}%
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Latência média: <strong className="text-emerald-500">{stability?.averageLatencyMs ?? 120}ms</strong>
                </p>
              </div>

              {/* Total de Tokens Consumidos */}
              <div className="p-5 rounded-2xl border" style={{ backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: c.border }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1">
                    <Cpu size={14} /> Tokens de IA
                  </span>
                  <Zap size={14} className="text-blue-500" />
                </div>
                <div className="font-heading font-black text-2xl" style={{ color: c.text }}>
                  {(aggregate?.totalTokens ?? 0).toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Requisições totais: <strong>{stability?.totalRequests ?? 0}</strong>
                </p>
              </div>

              {/* Tempo Médio de Uso */}
              <div className="p-5 rounded-2xl border" style={{ backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: c.border }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1">
                    <Clock size={14} /> Tempo Médio
                  </span>
                </div>
                <div className="font-heading font-black text-2xl" style={{ color: c.text }}>
                  {aggregate?.avgDurationMinutes ?? 0} min
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Tempo por sessão de mentoria
                </p>
              </div>

              {/* Usuários & Sessões Ativas */}
              <div className="p-5 rounded-2xl border" style={{ backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: c.border }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center gap-1">
                    <Users size={14} /> Sessões
                  </span>
                </div>
                <div className="font-heading font-black text-2xl" style={{ color: c.text }}>
                  {stability?.activeUsersCount ?? 1} Ativas
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Total de sessões: <strong>{stability?.totalSessionsCount ?? 1}</strong>
                </p>
              </div>

            </div>

            {/* Geographical Distribution & Locations */}
            <div className="p-6 rounded-3xl border" style={{ backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: c.border }}>
              <h4 className="font-heading font-bold text-sm mb-4 flex items-center gap-2" style={{ color: c.text }}>
                <Globe size={16} className="text-blue-500" /> Distribuição Geográfica de Usuários (Endereços Detectados)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(geo).length > 0 ? (
                  Object.entries(geo).map(([country, count]: any, i) => (
                    <div key={i} className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-semibold truncate" style={{ color: c.text }}>{country}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">{count}</span>
                    </div>
                  ))
                ) : (
                  <div className="col-span-4 text-xs text-slate-400 italic">Nenhum dado geográfico registrado ainda.</div>
                )}
              </div>
            </div>

            {/* Active Sessions & History Table */}
            <div className="p-6 rounded-3xl border space-y-4" style={{ backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: c.border }}>
              <div className="flex items-center justify-between">
                <h4 className="font-heading font-bold text-sm flex items-center gap-2" style={{ color: c.text }}>
                  <Activity size={16} className="text-emerald-500" /> Sessões e Telemetria em Execução
                </h4>
                <span className="text-[11px] text-slate-400">Atualizado às {lastRefreshed.toLocaleTimeString()}</span>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-slate-400 font-bold uppercase tracking-wider text-[10px]" style={{ borderColor: c.border }}>
                      <th className="pb-3">Sessão / ID</th>
                      <th className="pb-3">Endereço / Local</th>
                      <th className="pb-3">Tempo de Uso</th>
                      <th className="pb-3">Tokens</th>
                      <th className="pb-3">Cache Local</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: c.border }}>
                    {sessions.length > 0 ? (
                      sessions.map((s: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 font-mono font-bold text-blue-500">{s.sessionId.slice(0, 14)}...</td>
                          <td className="py-3 font-medium" style={{ color: c.text }}>
                            <div className="flex items-center gap-1.5">
                              <MapPin size={12} className="text-amber-500" />
                              <span>{s.city || 'Desconhecida'}, {s.country || 'Global'}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">IP: {s.ip}</span>
                          </td>
                          <td className="py-3 font-medium" style={{ color: c.text }}>
                            {Math.floor(s.durationSeconds / 60)}m {s.durationSeconds % 60}s
                          </td>
                          <td className="py-3 font-mono font-semibold" style={{ color: c.text }}>
                            {s.totalTokens.toLocaleString()}
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.cacheEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
                              {s.cacheEnabled ? 'Ativo' : 'Desativado'}
                            </span>
                          </td>
                          <td className="py-3">
                            <span className={`flex items-center gap-1 text-[11px] font-bold ${s.isOnline ? 'text-emerald-500' : 'text-slate-400'}`}>
                              <span className={`w-2 h-2 rounded-full ${s.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                              {s.isOnline ? 'Online' : 'Concluído'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          A aguardar novas sessões de utilizadores...
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 sm:p-6 border-t flex items-center justify-between text-xs" style={{ borderColor: c.border, backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }}>
            <span className="text-slate-400">
              Ngola Tutor AI Engine • Infraestrutura Pública e Governança de IA
            </span>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-md transition-colors"
            >
              Fechar Painel
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
