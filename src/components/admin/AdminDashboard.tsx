import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Eye, EyeOff, Activity,
  Server, Cpu, Zap, Clock, Users, Globe, MapPin, Search,
  RefreshCw, Download, LogOut, ArrowLeft, Check, Copy,
  MessageSquare, HardDrive, Laptop, Smartphone, AlertCircle,
  X, ChevronRight, Filter
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

const STORAGE_ADMIN_KEY = 'ngola_admin_token';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onExit }) => {
  const { c, isDark } = useTheme();

  // Auth states
  const [adminToken, setAdminToken] = useState<string>(() => sessionStorage.getItem(STORAGE_ADMIN_KEY) || '');
  const [inputKey, setInputKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(sessionStorage.getItem(STORAGE_ADMIN_KEY)));

  // Data states
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10); // in seconds, 0 = off

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'completed'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Inspector states
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<any | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Helper for admin headers
  const getAuthHeaders = useCallback((token: string) => {
    return {
      'Content-Type': 'application/json',
      'x-admin-key': token,
      'Authorization': `Bearer ${token}`,
    };
  }, []);

  // Fetch KPI & User telemetry data
  const fetchData = useCallback(async (tokenToUse?: string) => {
    const key = tokenToUse || adminToken;
    if (!key) return;

    setLoading(true);
    try {
      const res = await fetch('/api/telemetry/kpi', {
        headers: getAuthHeaders(key),
      });

      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefreshed(new Date());
        setIsAuthenticated(true);
        sessionStorage.setItem(STORAGE_ADMIN_KEY, key);
        setAdminToken(key);
      } else if (res.status === 401 || res.status === 403) {
        setIsAuthenticated(false);
        sessionStorage.removeItem(STORAGE_ADMIN_KEY);
        setAuthError('Chave de administração expirada ou inválida.');
      }
    } catch (err: any) {
      console.error('Admin telemetry fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [adminToken, getAuthHeaders]);

  // Initial check on mount if token is saved in sessionStorage
  useEffect(() => {
    if (adminToken) {
      fetchData(adminToken);
    }
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!isAuthenticated || autoRefreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchData();
    }, autoRefreshInterval * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, autoRefreshInterval, fetchData]);

  // Handle Admin Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setAuthError('Por favor insira a chave de administração.');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: inputKey.trim() }),
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setAdminToken(inputKey.trim());
        sessionStorage.setItem(STORAGE_ADMIN_KEY, inputKey.trim());
        setIsAuthenticated(true);
        await fetchData(inputKey.trim());
      } else {
        setAuthError(json.error || 'Chave de administração incorreta.');
      }
    } catch (err) {
      setAuthError('Falha ao contactar o servidor. Tente novamente.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_ADMIN_KEY);
    setAdminToken('');
    setInputKey('');
    setIsAuthenticated(false);
    setData(null);
  };

  // Copy session ID
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Fetch individual session details for inspection
  const handleInspectSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setInspectLoading(true);
    setSessionDetail(null);

    try {
      const res = await fetch(`/api/admin/session/${sessionId}`, {
        headers: getAuthHeaders(adminToken),
      });
      if (res.ok) {
        const json = await res.json();
        setSessionDetail(json);
      }
    } catch (err) {
      console.error('Error fetching session inspect details:', err);
    } finally {
      setInspectLoading(false);
    }
  };

  // Export User Telemetry data (JSON or CSV)
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

  // Helper to format User-Agent
  const formatDevice = (ua: string) => {
    if (!ua) return 'Desconhecido';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS Safari';
    if (ua.includes('Android')) return 'Android Mobile';
    if (ua.includes('Windows')) return 'Windows PC';
    if (ua.includes('Macintosh')) return 'macOS Apple';
    if (ua.includes('Linux')) return 'Linux OS';
    return ua.slice(0, 24);
  };

  // Filtered Sessions
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
          {/* Top subtle glow */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600" />

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-lg flex items-center justify-center">
              <div className="w-full h-full rounded-[22px] flex items-center justify-center bg-white dark:bg-slate-950">
                <Shield className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div className="space-y-1">
              <h1 className="font-heading font-extrabold text-2xl" style={{ color: c.text }}>
                Painel Administrativo
              </h1>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">
                Acesso Exclusivo • Dados de Usuários & Telemetria
              </p>
            </div>

            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Esta rota é restrita ao administrador. Insira a sua chave secreta para visualizar os dados de utilizadores e métricas de desempenho.
            </p>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2.5">
              <ShieldAlert size={16} className="shrink-0" />
              <span className="font-medium">{authError}</span>
            </div>
          )}

          {/* Form */}
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

          {/* Exit Link */}
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
    <div
      className="min-h-screen flex flex-col transition-colors pb-16"
      style={{ backgroundColor: isDark ? '#080C14' : '#F8FAFC' }}
    >
      {/* Top Admin Header */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md px-4 sm:px-8 py-4 transition-colors"
        style={{
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(148, 163, 184, 0.15)' : '#E2E8F0',
        }}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand & Route Title */}
          <div className="flex items-center gap-3.5 w-full md:w-auto">
            <button
              onClick={onExit}
              className="p-2 rounded-xl border hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-slate-400 hover:text-blue-500"
              title="Voltar ao Tutor"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-sm flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] flex items-center justify-center bg-white dark:bg-slate-950">
                <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-heading font-extrabold text-base sm:text-lg" style={{ color: c.text }}>
                  Ngola Tutor <span className="text-blue-500">Admin</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 font-mono">
                  /admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Painel Restrito • Telemetria, Sessões e Desempenho
              </p>
            </div>
          </div>

          {/* Action Bar (Auto-refresh, Manual refresh, Export, Logout) */}
          <div className="flex items-center flex-wrap gap-2.5 w-full md:w-auto justify-end">
            {/* Auto Refresh Select */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs" style={{ borderColor: c.border, backgroundColor: isDark ? '#080C14' : '#F1F5F9' }}>
              <Clock size={14} className="text-slate-400" />
              <span className="text-slate-400 font-medium">Atualização:</span>
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-transparent font-bold text-blue-500 focus:outline-none cursor-pointer"
              >
                <option value={0} className="bg-white dark:bg-slate-900">Pausado</option>
                <option value={5} className="bg-white dark:bg-slate-900">A cada 5s</option>
                <option value={10} className="bg-white dark:bg-slate-900">A cada 10s</option>
                <option value={30} className="bg-white dark:bg-slate-900">A cada 30s</option>
              </select>
            </div>

            {/* Manual Refresh */}
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="p-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ borderColor: c.border, color: c.text }}
              title="Atualizar Agora"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-blue-500' : 'text-slate-400'} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            {/* Export Dropdown */}
            <div className="relative group">
              <button
                className="p-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Download size={14} />
                <span>Exportar</span>
              </button>
              <div className="absolute right-0 top-full mt-1.5 w-40 rounded-2xl border shadow-xl hidden group-hover:block z-50 p-1 space-y-1" style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}>
                <button
                  onClick={() => handleExportData('json')}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-500/10 hover:text-blue-500 transition-colors flex items-center justify-between"
                  style={{ color: c.text }}
                >
                  <span>Arquivo JSON</span>
                  <span className="text-[10px] font-mono text-slate-400">.json</span>
                </button>
                <button
                  onClick={() => handleExportData('csv')}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold hover:bg-blue-500/10 hover:text-blue-500 transition-colors flex items-center justify-between"
                  style={{ color: c.text }}
                >
                  <span>Tabela CSV</span>
                  <span className="text-[10px] font-mono text-slate-400">.csv</span>
                </button>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 px-3 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Terminar Sessão de Administrador"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 space-y-8 w-full flex-1">
        
        {/* KPI Top Cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          
          {/* Card 1: Estabilidade & Uptime */}
          <div
            className="p-5 sm:p-6 rounded-3xl border shadow-sm relative overflow-hidden flex flex-col justify-between"
            style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                <Server size={16} /> Estabilidade
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div>
              <div className="font-heading font-black text-2xl sm:text-3xl" style={{ color: c.text }}>
                {aggregate?.systemUptimePercent ?? 100}%
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Latência média: <strong className="text-emerald-500">{stability?.averageLatencyMs ?? 0}ms</strong>
              </p>
            </div>
            <div className="mt-3 pt-3 border-t text-[11px] text-slate-400 flex justify-between" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#F1F5F9' }}>
              <span>Sucessos: <strong>{stability?.successfulRequests ?? 0}</strong></span>
              <span>Falhas: <strong className="text-red-400">{stability?.failedRequests ?? 0}</strong></span>
            </div>
          </div>

          {/* Card 2: Consumo de Tokens */}
          <div
            className="p-5 sm:p-6 rounded-3xl border shadow-sm relative overflow-hidden flex flex-col justify-between"
            style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                <Cpu size={16} /> Tokens de IA
              </span>
              <Zap size={16} className="text-blue-500" />
            </div>
            <div>
              <div className="font-heading font-black text-2xl sm:text-3xl" style={{ color: c.text }}>
                {(aggregate?.totalTokens ?? 0).toLocaleString()}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Total de requisições: <strong>{stability?.totalRequests ?? 0}</strong>
              </p>
            </div>
            <div className="mt-3 pt-3 border-t text-[11px] text-slate-400 flex justify-between" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#F1F5F9' }}>
              <span>Modelo: <strong>Gemini Flash</strong></span>
              <span>Grounding: <strong>Ativo</strong></span>
            </div>
          </div>

          {/* Card 3: Tempo Médio de Uso */}
          <div
            className="p-5 sm:p-6 rounded-3xl border shadow-sm relative overflow-hidden flex flex-col justify-between"
            style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                <Clock size={16} /> Tempo de Uso
              </span>
              <Activity size={16} className="text-amber-500" />
            </div>
            <div>
              <div className="font-heading font-black text-2xl sm:text-3xl" style={{ color: c.text }}>
                {aggregate?.avgDurationMinutes ?? 0} min
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Média por sessão de tutoria
              </p>
            </div>
            <div className="mt-3 pt-3 border-t text-[11px] text-slate-400 flex justify-between" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#F1F5F9' }}>
              <span>Total Mensagens: <strong>{aggregate?.totalMessages ?? 0}</strong></span>
            </div>
          </div>

          {/* Card 4: Utilizadores & Sessões */}
          <div
            className="p-5 sm:p-6 rounded-3xl border shadow-sm relative overflow-hidden flex flex-col justify-between"
            style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-500 flex items-center gap-1.5">
                <Users size={16} /> Utilizadores
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-500 font-mono">
                {stability?.activeUsersCount ?? 0} Online
              </span>
            </div>
            <div>
              <div className="font-heading font-black text-2xl sm:text-3xl" style={{ color: c.text }}>
                {stability?.totalSessionsCount ?? (data?.allSessions?.length || 0)}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Sessões registadas no sistema
              </p>
            </div>
            <div className="mt-3 pt-3 border-t text-[11px] text-slate-400 flex justify-between" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#F1F5F9' }}>
              <span>Conexões Ativas: <strong className="text-purple-400">{stability?.activeUsersCount ?? 0}</strong></span>
            </div>
          </div>

        </section>

        {/* Geographic Distribution Card */}
        <section
          className="p-6 sm:p-8 rounded-3xl border shadow-sm space-y-4"
          style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}
        >
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-sm sm:text-base flex items-center gap-2" style={{ color: c.text }}>
              <Globe size={18} className="text-blue-500" />
              Distribuição Geográfica de Utilizadores
            </h2>
            <span className="text-xs text-slate-400">
              {Object.keys(geo).length} regiões detectadas
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Object.entries(geo).length > 0 ? (
              Object.entries(geo).map(([country, count]: any, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl border flex items-center justify-between transition-colors"
                  style={{
                    backgroundColor: isDark ? '#080C14' : '#F8FAFC',
                    borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#E2E8F0',
                  }}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MapPin size={14} className="text-blue-500 shrink-0" />
                    <span className="text-xs font-bold truncate" style={{ color: c.text }}>
                      {country}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 shrink-0">
                    {count}
                  </span>
                </div>
              ))
            ) : (
              <div className="col-span-4 text-xs text-slate-400 italic py-3">
                A aguardar os primeiros acessos geográficos de utilizadores...
              </div>
            )}
          </div>
        </section>

        {/* User Data Table Section */}
        <section
          className="p-6 sm:p-8 rounded-3xl border shadow-sm space-y-6"
          style={{ backgroundColor: isDark ? '#0F172A' : '#FFFFFF', borderColor: c.border }}
        >
          {/* Table Header & Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="font-heading font-bold text-base sm:text-lg flex items-center gap-2" style={{ color: c.text }}>
                <Users size={18} className="text-indigo-500" />
                Dados Detalhados de Sessões dos Usuários
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Histórico em tempo real com IP, tokens consumidos, duração e mensagens
              </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center flex-wrap gap-3">
              {/* Filter Tabs */}
              <div className="flex items-center p-1 rounded-2xl border text-xs" style={{ borderColor: c.border, backgroundColor: isDark ? '#080C14' : '#F1F5F9' }}>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    statusFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-blue-500'
                  }`}
                >
                  Todos ({allSessionsList.length})
                </button>
                <button
                  onClick={() => setStatusFilter('online')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    statusFilter === 'online'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-emerald-500'
                  }`}
                >
                  Online
                </button>
                <button
                  onClick={() => setStatusFilter('completed')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                    statusFilter === 'completed'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  Finalizadas
                </button>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Pesquisar sessão, IP, cidade..."
                  className="pl-9 pr-4 py-2 rounded-2xl border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48 sm:w-64 transition-all"
                  style={{
                    backgroundColor: isDark ? '#080C14' : '#F1F5F9',
                    borderColor: isDark ? 'rgba(148, 163, 184, 0.2)' : '#CBD5E1',
                    color: c.text,
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto custom-scrollbar rounded-2xl border" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#E2E8F0' }}>
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr
                  className="border-b text-slate-400 font-bold uppercase tracking-wider text-[10px]"
                  style={{
                    borderColor: isDark ? 'rgba(148, 163, 184, 0.1)' : '#E2E8F0',
                    backgroundColor: isDark ? '#080C14' : '#F8FAFC',
                  }}
                >
                  <th className="py-3.5 px-4">ID da Sessão</th>
                  <th className="py-3.5 px-4">Localização & IP</th>
                  <th className="py-3.5 px-4">Dispositivo</th>
                  <th className="py-3.5 px-4">Tempo de Uso</th>
                  <th className="py-3.5 px-4">Tokens IA</th>
                  <th className="py-3.5 px-4">Mensagens</th>
                  <th className="py-3.5 px-4">Cache / Consent.</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: isDark ? 'rgba(148, 163, 184, 0.08)' : '#F1F5F9' }}>
                {allSessionsList.length > 0 ? (
                  allSessionsList.map((s, idx) => (
                    <tr
                      key={s.sessionId || idx}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Session ID */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-blue-500">
                            {s.sessionId.slice(0, 12)}...
                          </span>
                          <button
                            onClick={() => handleCopy(s.sessionId)}
                            className="p-1 rounded text-slate-400 hover:text-blue-500 transition-colors"
                            title="Copiar ID Completo"
                          >
                            {copiedId === s.sessionId ? (
                              <Check size={12} className="text-emerald-500" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Location & IP */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium" style={{ color: c.text }}>
                          <div className="flex items-center gap-1">
                            <MapPin size={12} className="text-amber-500 shrink-0" />
                            <span>{s.city || 'Desconhecida'}, {s.country || 'Global'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            IP: {s.ip}
                          </span>
                        </div>
                      </td>

                      {/* Device / User Agent */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                          {s.userAgent?.includes('Mobile') || s.userAgent?.includes('Android') || s.userAgent?.includes('iPhone') ? (
                            <Smartphone size={13} className="shrink-0 text-slate-400" />
                          ) : (
                            <Laptop size={13} className="shrink-0 text-slate-400" />
                          )}
                          <span className="truncate max-w-[120px]" title={s.userAgent}>
                            {formatDevice(s.userAgent)}
                          </span>
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-4 font-mono font-semibold" style={{ color: c.text }}>
                        {Math.floor(s.durationSeconds / 60)}m {s.durationSeconds % 60}s
                      </td>

                      {/* Tokens */}
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-500">
                        {s.totalTokens.toLocaleString()}
                      </td>

                      {/* Message Count */}
                      <td className="py-3.5 px-4 font-medium" style={{ color: c.text }}>
                        {s.messageCount || 1}
                      </td>

                      {/* Cache & Consent */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold w-fit ${s.cacheEnabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
                            Cache: {s.cacheEnabled ? 'Sim' : 'Não'}
                          </span>
                          <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold w-fit ${s.locationConsent ? 'bg-blue-500/10 text-blue-500' : 'bg-amber-500/10 text-amber-500'}`}>
                            Geo: {s.locationConsent ? 'Autorizado' : 'Negado'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          s.isOnline
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                          {s.isOnline ? 'Online' : 'Concluído'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleInspectSession(s.sessionId)}
                          className="px-3 py-1.5 rounded-xl border hover:bg-blue-500 hover:text-white transition-all text-xs font-semibold inline-flex items-center gap-1"
                          style={{ borderColor: c.border, color: c.text }}
                        >
                          <span>Inspecionar</span>
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto text-slate-400 mb-2 opacity-50" />
                      <p className="font-semibold text-xs">Nenhum dado de sessão encontrado com os filtros atuais.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 pt-2 gap-2">
            <span>Última atualização às {lastRefreshed.toLocaleTimeString()}</span>
            <span>Total de {allSessionsList.length} sessões listadas</span>
          </div>
        </section>

      </main>

      {/* Session Inspector Drawer / Modal */}
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
              {/* Inspector Header */}
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

              {/* Inspector Body */}
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                {inspectLoading ? (
                  <div className="py-12 text-center text-slate-400 space-y-3">
                    <RefreshCw size={24} className="animate-spin mx-auto text-blue-500" />
                    <p className="text-xs">A carregar detalhes da sessão e histórico de mensagens...</p>
                  </div>
                ) : sessionDetail ? (
                  <div className="space-y-6">
                    {/* Telemetry metadata cards */}
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

                    {/* Chat Messages History */}
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

              {/* Inspector Footer */}
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
    </div>
  );
};
