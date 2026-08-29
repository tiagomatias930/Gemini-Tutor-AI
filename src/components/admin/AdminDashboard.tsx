import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch, apiJson, ApiError } from '../../api/client';
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Eye, EyeOff, Activity,
  Server, Cpu, Zap, Clock, Users, Globe, MapPin, Search,
  RefreshCw, Download, LogOut, ArrowLeft, Check, Copy,
  MessageSquare, HardDrive, Laptop, Smartphone, AlertCircle,
  X, ChevronRight, Filter, LayoutDashboard, FileText, Bell,
  UserX, Trash2, Database, ScrollText, ChevronDown, Menu,
  Settings, Scale, FileDown, Eraser, AlertTriangle, Info,
  CheckCircle2, XCircle, Fingerprint, KeyRound
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface UserSessionMetrics {
  sessionId: string;
  ip: string;
  country: string;
  city: string;
  userAgent: string;
  startTime: number;
  lastHeartbeat: number;
  durationSeconds: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  messageCount: number;
  isOnline: boolean;
  cacheEnabled: boolean;
  locationConsent: boolean;
}

interface KPIData {
  stability: {
    serverStartTime: number;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatencyMs: number;
    recentLatencies: number[];
    uptimeSeconds: number;
    totalTokensConsumed: number;
    totalSessionsCount: number;
    activeUsersCount: number;
  };
  activeSessions: UserSessionMetrics[];
  allSessions?: UserSessionMetrics[];
  geoDistribution: Record<string, number>;
  aggregateStats: {
    totalTokens: number;
    avgDurationMinutes: number;
    totalMessages: number;
    totalUsers: number;
    systemUptimePercent: number;
  };
}

interface AdminDashboardProps {
  onExit: () => void;
}

const STORAGE_ADMIN_KEY = 'ngola_admin_session';

const MOCK_LOGS = [
  { id: 1, type: 'info', event: 'Sessão criada', details: 'Nova sessão iniciada em Luanda, Angola', time: 'Há 2 min' },
  { id: 2, type: 'warning', event: 'Exportação de dados', details: 'Administrador exportou telemetria JSON', time: 'Há 15 min' },
  { id: 3, type: 'info', event: 'Sessão anonimizada', details: 'Sessão anonimizada a pedido LGPD', time: 'Há 1 hora' },
  { id: 4, type: 'error', event: 'Erro na API', details: 'Falha ao contactar o provedor de LLM', time: 'Há 2 horas' },
  { id: 5, type: 'info', event: 'Login de Admin', details: 'Login efetuado com sucesso', time: 'Há 3 horas' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExit }) => {
  const { c, isDark } = useTheme();

  // Navigation state
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'lgpd' | 'logs'>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Auth states
  const [inputKey, setInputKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Data states
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'completed'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Inspector states
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // LGPD states
  const [lgpdSessionId, setLgpdSessionId] = useState('');
  const [lgpdConfirm, setLgpdConfirm] = useState<{
    isOpen: boolean;
    action: 'delete' | 'anonymize' | 'export' | 'purge';
    title: string;
    description: string;
    sessionId?: string;
  }>({ isOpen: false, action: 'purge', title: '', description: '' });

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Utilizadores & Sessões', icon: Users },
    { id: 'lgpd', label: 'Conformidade LGPD', icon: Scale },
    { id: 'logs', label: 'Registos de Sistema', icon: ScrollText },
  ] as const;

  // Helper for admin headers
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiJson<KPIData>('/api/telemetry/kpi');
      setData(json);
      setLastRefreshed(new Date());
      setIsAuthenticated(true);
      sessionStorage.setItem(STORAGE_ADMIN_KEY, '1');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        setIsAuthenticated(false);
        sessionStorage.removeItem(STORAGE_ADMIN_KEY);
        setAuthError('Sessão de administração expirada ou inválida.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!isAuthenticated || autoRefreshInterval <= 0) return;
    const interval = setInterval(() => {
      fetchData();
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, autoRefreshInterval, fetchData]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setAuthError('Por favor insira a chave de administração.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      await apiJson('/api/admin/verify', {
        method: 'POST',
        body: JSON.stringify({ key: inputKey.trim() }),
      });
      setIsAuthenticated(true);
      await fetchData();
    } catch (err) {
      setAuthError(err instanceof ApiError ? err.message : 'Falha ao contactar o servidor. Tente novamente.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiJson('/api/admin/logout', { method: 'POST' });
    } catch {
      // Cookie may already be gone.
    }
    sessionStorage.removeItem(STORAGE_ADMIN_KEY);
    setInputKey('');
    setIsAuthenticated(false);
    setData(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInspectSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setInspectLoading(true);
    setSessionDetail(null);

    try {
      const json = await apiJson(`/api/admin/session/${sessionId}`);
      setSessionDetail(json);
    } catch (err) {
      console.error('Error fetching session inspect details:', err);
    } finally {
      setInspectLoading(false);
    }
  };

  const handleExportData = (type: 'json' | 'csv') => {
    if (!data) return;
    const sessionList = data.allSessions || data.activeSessions || [];

    if (type === 'json') {
      const exportObject = {
        exportedAt: new Date().toISOString(),
        kpiSummary: data.stability,
        aggregateStats: data.aggregateStats,
        geoDistribution: data.geoDistribution,
        sessions: sessionList,
      };
      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ngola_tutor_telemetry_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['SessionId', 'IP', 'Country', 'City', 'DurationSeconds', 'TotalTokens', 'PromptTokens', 'CompletionTokens', 'Messages', 'CacheEnabled', 'LocationConsent', 'IsOnline', 'StartTime'];
      const rows = sessionList.map(s => [
        `"${s.sessionId}"`,
        `"${s.ip}"`,
        `"${s.country || ''}"`,
        `"${s.city || ''}"`,
        s.durationSeconds,
        s.totalTokens,
        s.promptTokens,
        s.completionTokens,
        s.messageCount,
        s.cacheEnabled,
        s.locationConsent,
        s.isOnline,
        new Date(s.startTime).toISOString(),
      ]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ngola_tutor_users_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const formatDevice = (ua: string) => {
    if (!ua) return 'Desconhecido';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS Safari';
    if (ua.includes('Android')) return 'Android Mobile';
    if (ua.includes('Windows')) return 'Windows PC';
    if (ua.includes('Macintosh')) return 'macOS Apple';
    if (ua.includes('Linux')) return 'Linux OS';
    return ua.slice(0, 24);
  };

  const allSessionsList = useMemo(() => {
    const rawList = data?.allSessions && data.allSessions.length > 0
      ? data.allSessions
      : (data?.activeSessions || []);

    return rawList.filter(s => {
      const matchSearch =
        s.sessionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.country && s.country.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.city && s.city.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.ip && s.ip.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.userAgent && s.userAgent.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;

      if (statusFilter === 'online') return s.isOnline;
      if (statusFilter === 'completed') return !s.isOnline;
      return true;
    });
  }, [data, searchQuery, statusFilter]);

  const stability = data?.stability;
  const aggregate = data?.aggregateStats;
  const geo = data?.geoDistribution || {};

  const triggerLgpdAction = (action: 'delete' | 'anonymize' | 'export' | 'purge') => {
    if (action !== 'purge' && !lgpdSessionId.trim()) {
      alert("Por favor, insira o ID da sessão alvo.");
      return;
    }
    
    let desc = "";
    if (action === 'delete') desc = `Tem a certeza que deseja eliminar permanentemente os dados da sessão ${lgpdSessionId}? Esta ação é irreversível.`;
    if (action === 'anonymize') desc = `Tem a certeza que deseja anonimizar a sessão ${lgpdSessionId}? O IP e localização serão removidos de forma irreversível.`;
    if (action === 'export') desc = `Deseja exportar todos os dados do titular referentes à sessão ${lgpdSessionId} para efeitos de portabilidade?`;
    if (action === 'purge') desc = `Tem a certeza que deseja purgar todos os dados de sessões expiradas (mais de 90 dias)?`;
    
    setLgpdConfirm({
      isOpen: true,
      action,
      title: "Confirmar Ação",
      description: desc,
      sessionId: lgpdSessionId
    });
  };

  const executeLgpdAction = async () => {
    const { action, sessionId } = lgpdConfirm;
    try {
      if (action === 'delete') {
        await apiJson(`/api/admin/session/${sessionId}`, { method: 'DELETE' });
      } else if (action === 'anonymize') {
        await apiJson(`/api/admin/session/${sessionId}/anonymize`, { method: 'POST' });
      } else if (action === 'export') {
        const res = await apiFetch(`/api/admin/session/${sessionId}/export`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lgpd_export_${sessionId}.json`;
        a.click();
      } else if (action === 'purge') {
        await apiJson(`/api/admin/data/purge`, { method: 'POST', body: JSON.stringify({ retentionDays: 90 }) });
      }
    } catch(e) {
      console.error('Falha ao executar ação LGPD:', e);
    } finally {
      setLgpdConfirm(prev => ({ ...prev, isOpen: false }));
      if (action !== 'export') {
        setLgpdSessionId('');
        void fetchData();
      }
    }
  };


  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER 1: Secure Login Gate (When not authenticated)
  // ─────────────────────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 sm:p-6 transition-colors"
        style={{ backgroundColor: isDark ? '#080C14' : '#F8FAFC' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md rounded-3xl p-8 sm:p-10 border shadow-2xl space-y-8 relative overflow-hidden"
          style={{
            backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
            borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#E2E8F0',
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-lg flex items-center justify-center">
              <div className="w-full h-full rounded-[22px] flex items-center justify-center bg-white dark:bg-slate-950">
                <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <div className="space-y-1">
              <h1 className="font-heading font-extrabold text-2xl" style={{ color: c.text }}>Painel Administrativo</h1>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Acesso Exclusivo • Dados de Usuários & Telemetria</p>
            </div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Esta rota é restrita ao administrador. Insira a sua chave secreta para visualizar os dados de utilizadores e métricas de desempenho.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2.5">
              <ShieldAlert size={16} className="shrink-0" />
              <span className="font-medium">{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                Chave de Acesso (ADMIN_SECRET)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="Insira a chave de administrador..."
                  autoFocus
                  required
                  className="w-full px-4 py-3.5 pr-12 rounded-2xl border text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                  style={{
                    backgroundColor: isDark ? '#080C14' : '#F1F5F9',
                    borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#CBD5E1',
                    color: c.text,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {authLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>A autenticar...</span>
                </>
              ) : (
                <>
                  <Lock size={16} />
                  <span>Entrar no Painel</span>
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={onExit}
              className="text-xs font-semibold text-slate-400 hover:text-blue-500 transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              <span>Voltar para o Ngola Tutor</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER 2: Full Admin Dashboard
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex transition-colors" style={{ backgroundColor: isDark ? '#080C14' : '#F8FAFC' }}>
      
      {/* Sidebar Navigation */}
      <aside
        className={`sticky top-0 h-screen border-r flex flex-col transition-all duration-300 z-50 ${isSidebarOpen ? 'w-[260px]' : 'w-[64px]'}`}
        style={{
          backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
          borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#E2E8F0',
        }}
      >
        <div className="p-4 border-b flex items-center justify-center h-16" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#E2E8F0' }}>
          {isSidebarOpen ? (
            <div className="flex items-center gap-3 w-full">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="font-heading font-extrabold text-sm truncate" style={{ color: c.text }}>Ngola Admin</span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-l-2 border-blue-600'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 border-l-2 border-transparent'
                } ${!isSidebarOpen && 'justify-center'}`}
                title={item.label}
              >
                <item.icon size={20} className={`shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                {isSidebarOpen && <span className="font-semibold text-sm truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t space-y-2" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#E2E8F0' }}>
          <button
            onClick={onExit}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all ${!isSidebarOpen && 'justify-center'}`}
            title="Voltar ao Tutor"
          >
            <ArrowLeft size={20} className="shrink-0" />
            {isSidebarOpen && <span className="font-semibold text-sm truncate">Sair do Admin</span>}
          </button>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 p-3 rounded-xl text-red-500 hover:bg-red-500/10 transition-all ${!isSidebarOpen && 'justify-center'}`}
            title="Terminar Sessão"
          >
            <LogOut size={20} className="shrink-0" />
            {isSidebarOpen && <span className="font-semibold text-sm truncate">Terminar Sessão</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header
          className="sticky top-0 z-40 border-b backdrop-blur-md px-4 sm:px-6 h-16 flex items-center justify-between transition-colors"
          style={{
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#E2E8F0',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-slate-500"
              style={{ borderColor: c.border }}
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400 font-medium">Admin</span>
              <ChevronRight size={14} className="text-slate-500" />
              <span className="font-semibold text-blue-500 capitalize">{navItems.find(n => n.id === activeTab)?.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs" style={{ borderColor: c.border, backgroundColor: isDark ? '#080C14' : '#F1F5F9' }}>
              <Clock size={14} className="text-slate-400" />
              <select value={autoRefreshInterval} onChange={(e) => setAutoRefreshInterval(Number(e.target.value))} className="bg-transparent font-bold text-blue-500 focus:outline-none cursor-pointer">
                <option value={0} className="bg-white dark:bg-slate-900">Pausado</option>
                <option value={5} className="bg-white dark:bg-slate-900">A cada 5s</option>
                <option value={10} className="bg-white dark:bg-slate-900">A cada 10s</option>
                <option value={30} className="bg-white dark:bg-slate-900">A cada 30s</option>
              </select>
            </div>

            <button onClick={() => fetchData()} disabled={loading} className="p-2 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: c.border }} title="Atualizar">
              <RefreshCw size={16} className={loading ? 'animate-spin text-blue-500' : 'text-slate-500'} />
            </button>

            {/* Export Dropdown */}
            <div className="relative group">
              <button className="p-2 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: c.border }} title="Exportar Dados">
                <Download size={16} className="text-slate-500" />
              </button>
              <div className="absolute right-0 top-full mt-1.5 w-40 rounded-2xl border shadow-xl hidden group-hover:block z-50 p-1 space-y-1" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                <button onClick={() => handleExportData('json')} className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-500/10 hover:text-blue-500 transition-colors flex items-center justify-between" style={{ color: c.text }}>
                  <span>Arquivo JSON</span>
                  <span className="text-[10px] font-mono text-slate-400">.json</span>
                </button>
                <button onClick={() => handleExportData('csv')} className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-500/10 hover:text-blue-500 transition-colors flex items-center justify-between" style={{ color: c.text }}>
                  <span>Tabela CSV</span>
                  <span className="text-[10px] font-mono text-slate-400">.csv</span>
                </button>
              </div>
            </div>

            <button className="relative p-2 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 transition-colors" style={{ borderColor: c.border }}>
              <Bell size={18} className="text-slate-500" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border-2" style={{ borderColor: isDark ? '#0F172A' : '#FFFFFF' }} />
            </button>

            <div className="flex items-center gap-2 pl-3 sm:pl-4 border-l" style={{ borderColor: c.border }}>
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                AD
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-bold leading-tight" style={{ color: c.text }}>Administrador</p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          
          {/* ===================== TAB: OVERVIEW ===================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <div className="p-5 sm:p-6 rounded-3xl border shadow-sm relative overflow-hidden flex flex-col justify-between" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5"><Server size={16} /> Estabilidade</span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <div>
                    <div className="font-heading font-black text-2xl sm:text-3xl" style={{ color: c.text }}>{aggregate?.systemUptimePercent ?? 100}%</div>
                    <p className="text-xs text-slate-400 mt-1">Latência média: <strong className="text-emerald-500">{stability?.averageLatencyMs ?? 0}ms</strong></p>
                  </div>
                  <div className="mt-3 pt-3 border-t text-[11px] text-slate-400 flex justify-between" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#F1F5F9' }}>
                    <span>Sucessos: <strong>{stability?.successfulRequests ?? 0}</strong></span>
                    <span>Falhas: <strong className="text-red-400">{stability?.failedRequests ?? 0}</strong></span>
                  </div>
                </div>

                <div className="p-5 sm:p-6 rounded-3xl border shadow-sm relative overflow-hidden flex flex-col justify-between" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1.5"><Cpu size={16} /> Tokens de IA</span>
                    <Zap size={16} className="text-blue-500" />
                  </div>
                  <div>
                    <div className="font-heading font-black text-2xl sm:text-3xl" style={{ color: c.text }}>{(aggregate?.totalTokens ?? 0).toLocaleString()}</div>
                    <p className="text-xs text-slate-400 mt-1">Total de requisições: <strong>{stability?.totalRequests ?? 0}</strong></p>
                  </div>
                  <div className="mt-3 pt-3 border-t text-[11px] text-slate-400 flex justify-between" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#F1F5F9' }}>
                    <span>Modelo: <strong>Gemini Flash</strong></span>
                    <span>Grounding: <strong>Ativo</strong></span>
                  </div>
                </div>

                <div className="p-5 sm:p-6 rounded-3xl border shadow-sm relative overflow-hidden flex flex-col justify-between" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5"><Clock size={16} /> Tempo de Uso</span>
                    <Activity size={16} className="text-amber-500" />
                  </div>
                  <div>
                    <div className="font-heading font-black text-2xl sm:text-3xl" style={{ color: c.text }}>{aggregate?.avgDurationMinutes ?? 0} min</div>
                    <p className="text-xs text-slate-400 mt-1">Média por sessão de tutoria</p>
                  </div>
                  <div className="mt-3 pt-3 border-t text-[11px] text-slate-400 flex justify-between" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#F1F5F9' }}>
                    <span>Total Mensagens: <strong>{aggregate?.totalMessages ?? 0}</strong></span>
                  </div>
                </div>

                <div className="p-5 sm:p-6 rounded-3xl border shadow-sm relative overflow-hidden flex flex-col justify-between" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center gap-1.5"><Users size={16} /> Utilizadores</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-500 font-mono">{stability?.activeUsersCount ?? 0} Online</span>
                  </div>
                  <div>
                    <div className="font-heading font-black text-2xl sm:text-3xl" style={{ color: c.text }}>{stability?.totalSessionsCount ?? (data?.allSessions?.length || 0)}</div>
                    <p className="text-xs text-slate-400 mt-1">Sessões registadas no sistema</p>
                  </div>
                  <div className="mt-3 pt-3 border-t text-[11px] text-slate-400 flex justify-between" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#F1F5F9' }}>
                    <span>Conexões Ativas: <strong className="text-purple-400">{stability?.activeUsersCount ?? 0}</strong></span>
                  </div>
                </div>
              </section>

              <section className="p-6 sm:p-8 rounded-3xl border shadow-sm space-y-4" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                <div className="flex items-center justify-between">
                  <h2 className="font-heading font-bold text-sm sm:text-base flex items-center gap-2" style={{ color: c.text }}><Globe size={18} className="text-blue-500" /> Distribuição Geográfica de Utilizadores</h2>
                  <span className="text-xs text-slate-400">{Object.keys(geo).length} regiões</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Object.entries(geo).length > 0 ? (
                    Object.entries(geo).map(([country, count]: any, i) => (
                      <div key={i} className="p-3.5 rounded-2xl border flex items-center justify-between transition-colors" style={{ backgroundColor: isDark ? '#080C14' : '#F8FAFC', borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#E2E8F0' }}>
                        <div className="flex items-center gap-2 truncate">
                          <MapPin size={14} className="text-blue-500 shrink-0" />
                          <span className="text-xs font-bold truncate" style={{ color: c.text }}>{country}</span>
                        </div>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 shrink-0">{count}</span>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full text-xs text-slate-400 italic py-3">A aguardar os primeiros acessos geográficos...</div>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* ===================== TAB: USERS ===================== */}
          {activeTab === 'users' && (
            <section className="p-6 sm:p-8 rounded-3xl border shadow-sm space-y-6" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-heading font-bold text-base sm:text-lg flex items-center gap-2" style={{ color: c.text }}><Users size={18} className="text-indigo-500" /> Histórico de Sessões</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Filtre e analise o comportamento e consumo dos utilizadores.</p>
                </div>
                <div className="flex items-center flex-wrap gap-3">
                  <div className="flex items-center p-1 rounded-2xl border text-xs" style={{ borderColor: c.border, backgroundColor: isDark ? '#080C14' : '#F1F5F9' }}>
                    <button onClick={() => setStatusFilter('all')} className={`px-3 py-1.5 rounded-xl font-bold transition-all ${statusFilter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-blue-500'}`}>Todos ({allSessionsList.length})</button>
                    <button onClick={() => setStatusFilter('online')} className={`px-3 py-1.5 rounded-xl font-bold transition-all ${statusFilter === 'online' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-emerald-500'}`}>Online</button>
                    <button onClick={() => setStatusFilter('completed')} className={`px-3 py-1.5 rounded-xl font-bold transition-all ${statusFilter === 'completed' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}>Finalizadas</button>
                  </div>
                  <div className="relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Pesquisar IP, cidade..." className="pl-9 pr-4 py-2 rounded-2xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48 sm:w-64 transition-all" style={{ backgroundColor: isDark ? '#080C14' : '#F1F5F9', borderColor: c.border, color: c.text }} />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"><X size={12} /></button>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar rounded-2xl border" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#E2E8F0' }}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-slate-400 font-bold uppercase tracking-wider text-[10px]" style={{ borderColor: c.border, backgroundColor: isDark ? '#080C14' : '#F8FAFC' }}>
                      <th className="py-3.5 px-4">ID da Sessão</th>
                      <th className="py-3.5 px-4">Localização & IP</th>
                      <th className="py-3.5 px-4">Dispositivo</th>
                      <th className="py-3.5 px-4">Tempo</th>
                      <th className="py-3.5 px-4">Tokens</th>
                      <th className="py-3.5 px-4">Msg</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.08)' : '#F1F5F9' }}>
                    {allSessionsList.length > 0 ? (
                      allSessionsList.map((s, idx) => (
                        <tr key={s.sessionId || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-blue-500">{s.sessionId.slice(0, 12)}...</span>
                              <button onClick={() => handleCopy(s.sessionId)} className="p-1 rounded text-slate-400 hover:text-blue-500" title="Copiar">
                                {copiedId === s.sessionId ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium" style={{ color: c.text }}>
                              <div className="flex items-center gap-1"><MapPin size={12} className="text-amber-500 shrink-0" /><span>{s.city || 'Desconhecida'}, {s.country || 'Global'}</span></div>
                              <span className="text-[10px] text-slate-400 font-mono">IP: {s.ip}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                              {s.userAgent?.includes('Mobile') ? <Smartphone size={13} className="shrink-0" /> : <Laptop size={13} className="shrink-0" />}
                              <span className="truncate max-w-[100px]" title={s.userAgent}>{formatDevice(s.userAgent)}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-semibold" style={{ color: c.text }}>{Math.floor(s.durationSeconds / 60)}m {s.durationSeconds % 60}s</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-500">{s.totalTokens.toLocaleString()}</td>
                          <td className="py-3.5 px-4 font-medium" style={{ color: c.text }}>{s.messageCount || 1}</td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${s.isOnline ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${s.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                              {s.isOnline ? 'Online' : 'Concluído'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button onClick={() => handleInspectSession(s.sessionId)} className="px-3 py-1.5 rounded-xl border hover:bg-blue-500 hover:text-white transition-all text-xs font-semibold inline-flex items-center gap-1" style={{ borderColor: c.border, color: c.text }}>
                              <span>Detalhes</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-400">
                          <Users className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
                          <p className="font-semibold text-xs">Nenhuma sessão encontrada.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ===================== TAB: LGPD ===================== */}
          {activeTab === 'lgpd' && (
            <div className="space-y-6 max-w-5xl">
              <div>
                <h2 className="font-heading font-bold text-2xl" style={{ color: c.text }}>Conformidade LGPD</h2>
                <p className="text-sm text-slate-400 mt-1">Gestão de privacidade, proteção de dados e direitos dos titulares.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Base Legal */}
                <div className="p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: c.text }}><Scale className="text-blue-500" size={18} /> Base Legal de Processamento</h3>
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl border bg-black/5 dark:bg-white/5 flex items-start gap-3" style={{ borderColor: c.border }}>
                      <Activity className="text-emerald-500 mt-0.5" size={16} />
                      <div>
                        <p className="font-bold text-sm" style={{ color: c.text }}>Interesse Legítimo</p>
                        <p className="text-xs text-slate-500 mt-1">Telemetria básica e logs de sistema (anonimizados por padrão).</p>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border bg-black/5 dark:bg-white/5 flex items-start gap-3" style={{ borderColor: c.border }}>
                      <MapPin className="text-amber-500 mt-0.5" size={16} />
                      <div>
                        <p className="font-bold text-sm" style={{ color: c.text }}>Consentimento Explícito</p>
                        <p className="text-xs text-slate-500 mt-1">Geolocalização detalhada e dados sensíveis de perfil.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direitos dos Titulares */}
                <div className="p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: c.text }}><UserX className="text-purple-500" size={18} /> Direitos dos Titulares</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {['Acesso', 'Retificação', 'Eliminação', 'Portabilidade', 'Oposição', 'Informação'].map(dir => (
                      <div key={dir} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                        <CheckCircle2 size={14} className="text-emerald-500" />
                        <span className="text-sm font-medium" style={{ color: c.text }}>{dir}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Política de Retenção */}
                <div className="p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: c.text }}><Clock className="text-amber-500" size={18} /> Política de Retenção</h3>
                  <ul className="space-y-4">
                    <li className="flex justify-between items-center border-b pb-2" style={{ borderColor: c.border }}>
                      <span className="text-sm text-slate-500">Dados de Sessão (Anónimos)</span>
                      <span className="font-bold text-sm" style={{ color: c.text }}>90 dias</span>
                    </li>
                    <li className="flex justify-between items-center border-b pb-2" style={{ borderColor: c.border }}>
                      <span className="text-sm text-slate-500">Histórico de Mensagens</span>
                      <span className="font-bold text-sm" style={{ color: c.text }}>30 dias</span>
                    </li>
                    <li className="flex justify-between items-center pb-2">
                      <span className="text-sm text-slate-500">Endereços IP brutos</span>
                      <span className="font-bold text-sm" style={{ color: c.text }}>7 dias</span>
                    </li>
                  </ul>
                </div>

                {/* Consentimentos Ativos */}
                <div className="p-6 rounded-3xl border shadow-sm" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                  <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: c.text }}><CheckCircle2 className="text-emerald-500" size={18} /> Consentimentos Ativos</h3>
                  <div className="flex items-center justify-around py-4">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full border-4 border-emerald-500 flex items-center justify-center mx-auto mb-2 text-lg font-bold" style={{ color: c.text }}>
                        85%
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Localização</p>
                    </div>
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full border-4 border-blue-500 flex items-center justify-center mx-auto mb-2 text-lg font-bold" style={{ color: c.text }}>
                        100%
                      </div>
                      <p className="text-xs text-slate-500 font-medium">Telemetria</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações de Conformidade */}
              <div className="p-6 rounded-3xl border shadow-sm mt-6" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                <h3 className="font-bold text-base mb-4 flex items-center gap-2" style={{ color: c.text }}><AlertTriangle className="text-red-500" size={18} /> Ações de Conformidade</h3>
                
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">ID da Sessão Alvo (Opcional para Purgar)</label>
                    <input 
                      type="text" 
                      value={lgpdSessionId}
                      onChange={e => setLgpdSessionId(e.target.value)}
                      placeholder="Insira o ID da sessão..." 
                      className="w-full px-4 py-2.5 rounded-xl border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      style={{ backgroundColor: isDark ? '#080C14' : '#F8FAFC', borderColor: c.border, color: c.text }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button onClick={() => triggerLgpdAction('anonymize')} className="p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 hover:bg-amber-500/10 transition-colors group" style={{ borderColor: c.border }}>
                    <Eraser className="text-amber-500 group-hover:scale-110 transition-transform" size={24} />
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400">Anonimizar Sessão</span>
                  </button>
                  <button onClick={() => triggerLgpdAction('delete')} className="p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 hover:bg-red-500/10 transition-colors group" style={{ borderColor: c.border }}>
                    <Trash2 className="text-red-500 group-hover:scale-110 transition-transform" size={24} />
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">Eliminar Dados</span>
                  </button>
                  <button onClick={() => triggerLgpdAction('export')} className="p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 hover:bg-blue-500/10 transition-colors group" style={{ borderColor: c.border }}>
                    <FileDown className="text-blue-500 group-hover:scale-110 transition-transform" size={24} />
                    <span className="text-sm font-bold text-blue-600 dark:text-blue-400">Exportar Titular</span>
                  </button>
                  <button onClick={() => triggerLgpdAction('purge')} className="p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 hover:bg-purple-500/10 transition-colors group" style={{ borderColor: c.border }}>
                    <Database className="text-purple-500 group-hover:scale-110 transition-transform" size={24} />
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">Purgar Expirados</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ===================== TAB: LOGS ===================== */}
          {activeTab === 'logs' && (
            <div className="space-y-6 max-w-6xl">
              <div>
                <h2 className="font-heading font-bold text-2xl" style={{ color: c.text }}>Registos de Sistema</h2>
                <p className="text-sm text-slate-400 mt-1">Monitorização de eventos, acessos e auditoria.</p>
              </div>
              
              <div className="rounded-3xl border shadow-sm overflow-hidden" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b bg-black/5 dark:bg-white/5 text-slate-500 font-bold text-xs uppercase tracking-wider" style={{ borderColor: c.border }}>
                        <th className="py-4 px-6">Timestamp</th>
                        <th className="py-4 px-6">Severidade</th>
                        <th className="py-4 px-6">Evento</th>
                        <th className="py-4 px-6">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.08)' : '#F1F5F9' }}>
                      {MOCK_LOGS.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-4 px-6 font-mono text-xs text-slate-400">{log.time}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              log.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                              log.type === 'warning' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                              'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            }`}>
                              {log.type}
                            </span>
                          </td>
                          <td className="py-4 px-6 font-semibold text-sm" style={{ color: c.text }}>{log.event}</td>
                          <td className="py-4 px-6 text-slate-500 text-xs">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Session Inspector Modal (Kept Existing) */}
      <AnimatePresence>
        {selectedSessionId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-black/60 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-3xl rounded-3xl border shadow-2xl overflow-hidden my-6 flex flex-col max-h-[85vh]"
              style={{
                backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
                borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#E2E8F0',
              }}
            >
              <div className="p-6 border-b flex items-center justify-between gap-4" style={{ borderColor: c.border, backgroundColor: isDark ? '#080C14' : '#F8FAFC' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-500">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-base" style={{ color: c.text }}>
                      Inspeção de Sessão
                    </h3>
                    <p className="font-mono text-xs text-blue-500 font-bold truncate max-w-xs sm:max-w-md">
                      {selectedSessionId}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedSessionId(null)}
                  className="p-2 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-slate-400 hover:text-red-500"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                {inspectLoading ? (
                  <div className="py-12 text-center text-slate-400 space-y-3">
                    <RefreshCw size={24} className="animate-spin mx-auto text-blue-500" />
                    <p className="text-xs">A carregar detalhes da sessão e histórico de mensagens...</p>
                  </div>
                ) : sessionDetail ? (
                  <div className="space-y-6">
                    {sessionDetail.telemetry && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-2xl border bg-black/5 dark:bg-white/5" style={{ borderColor: c.border }}>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Endereço IP</span>
                          <span className="font-mono text-xs font-bold" style={{ color: c.text }}>{sessionDetail.telemetry.ip}</span>
                        </div>
                        <div className="p-3.5 rounded-2xl border bg-black/5 dark:bg-white/5" style={{ borderColor: c.border }}>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Local</span>
                          <span className="text-xs font-bold truncate block" style={{ color: c.text }}>{sessionDetail.telemetry.city}, {sessionDetail.telemetry.country}</span>
                        </div>
                        <div className="p-3.5 rounded-2xl border bg-black/5 dark:bg-white/5" style={{ borderColor: c.border }}>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Tokens Usados</span>
                          <span className="font-mono text-xs font-bold text-blue-500">{sessionDetail.telemetry.totalTokens}</span>
                        </div>
                        <div className="p-3.5 rounded-2xl border bg-black/5 dark:bg-white/5" style={{ borderColor: c.border }}>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Duração</span>
                          <span className="font-mono text-xs font-bold" style={{ color: c.text }}>{sessionDetail.telemetry.durationSeconds}s</span>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-400">
                        Histórico de Mensagens Registadas ({sessionDetail.messages?.length || 0})
                      </h4>

                      {sessionDetail.messages && sessionDetail.messages.length > 0 ? (
                        <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                          {sessionDetail.messages.map((msg: any, i: number) => (
                            <div
                              key={i}
                              className={`p-3.5 rounded-2xl border text-xs space-y-1 ${
                                msg.role === 'user'
                                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-500'
                                  : 'bg-black/5 dark:bg-white/5 border-slate-200 dark:border-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                <span>{msg.role === 'user' ? '👤 Estudante' : '🤖 Ngola Tutor'}</span>
                                {msg.timestamp && (
                                  <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                )}
                              </div>
                              <p className="whitespace-pre-wrap font-sans text-xs leading-relaxed" style={{ color: msg.role === 'user' ? undefined : c.text }}>
                                {msg.text || msg.content || JSON.stringify(msg)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 rounded-2xl border text-center text-xs text-slate-400 italic" style={{ borderColor: c.border }}>
                          Nenhuma mensagem persistida no Firestore para esta sessão.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400 italic">
                    Não foi possível recuperar os dados da sessão selecionada.
                  </div>
                )}
              </div>

              <div className="p-4 border-t flex justify-end" style={{ borderColor: c.border, backgroundColor: isDark ? '#080C14' : '#F8FAFC' }}>
                <button
                  onClick={() => setSelectedSessionId(null)}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors"
                >
                  Fechar Inspeção
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LGPD Action Confirmation Modal */}
      <AnimatePresence>
        {lgpdConfirm.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md p-6 rounded-3xl shadow-2xl border"
              style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}
            >
              <div className="flex items-center gap-3 text-red-500 mb-4">
                <div className="p-2 bg-red-500/10 rounded-xl">
                  <AlertTriangle size={24} className="text-red-500" />
                </div>
                <h3 className="font-heading font-bold text-lg" style={{ color: c.text }}>{lgpdConfirm.title}</h3>
              </div>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">{lgpdConfirm.description}</p>
              
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setLgpdConfirm({ ...lgpdConfirm, isOpen: false })}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={executeLgpdAction}
                  className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-colors shadow-sm ${
                    lgpdConfirm.action === 'export' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  Confirmar Ação
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
