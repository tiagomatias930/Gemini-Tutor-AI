/**
 * Ngola Tutor — Client-side Telemetry, Geolocation & Offline Cache Manager
 */
import { apiJson } from '../api/client';

export interface ConsentPreferences {
  acceptedTerms: boolean;
  locationConsent: boolean;
  telemetryConsent: boolean;
  cacheEnabled: boolean;
  acceptedTimestamp: string;
}

const STORAGE_KEY_CONSENT = 'ngola_consent_preferences_v1';
const STORAGE_KEY_OFFLINE_CACHE = 'ngola_offline_messages_cache';
const STORAGE_KEY_SESSION_ID = 'ngola_telemetry_session_id';
const SERVER_SESSION_ID = /^[a-f0-9]{32}$/;

// Default preferences
export const getDefaultConsent = (): ConsentPreferences => ({
  acceptedTerms: false,
  locationConsent: true,
  telemetryConsent: true,
  cacheEnabled: true,
  acceptedTimestamp: '',
});

// Get user consent from localStorage
export const getConsentPreferences = (): ConsentPreferences => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONSENT);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // Ignore localStorage errors
  }
  return getDefaultConsent();
};

// Save user consent
export const saveConsentPreferences = (prefs: Partial<ConsentPreferences>): ConsentPreferences => {
  const current = getConsentPreferences();
  const updated: ConsentPreferences = {
    ...current,
    ...prefs,
    acceptedTerms: true,
    acceptedTimestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY_CONSENT, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
  return updated;
};

export const rememberServerSessionId = (sessionId?: string): void => {
  if (!sessionId || !SERVER_SESSION_ID.test(sessionId)) return;
  try {
    sessionStorage.setItem(STORAGE_KEY_SESSION_ID, sessionId);
  } catch {
    // Ignore sessionStorage errors
  }
};

export const getStoredServerSessionId = (): string | null => {
  try {
    const sid = sessionStorage.getItem(STORAGE_KEY_SESSION_ID);
    return sid && SERVER_SESSION_ID.test(sid) ? sid : null;
  } catch {
    return null;
  }
};

export const bootstrapStudentSession = async (): Promise<string | null> => {
  const stored = getStoredServerSessionId();
  if (stored) return stored;
  try {
    const data = await apiJson<{ sessionId?: string }>('/api/health');
    rememberServerSessionId(data.sessionId);
    return getStoredServerSessionId();
  } catch {
    return null;
  }
};

export const getOrCreateSessionId = (): string => getStoredServerSessionId() ?? '';

// Approximate Geolocation detector (client-side assistance)
export const detectClientGeo = async (): Promise<{ country?: string; city?: string }> => {
  try {
    // Use Intl timezone as a fast privacy-safe geo indicator
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (timeZone.includes('Luanda') || timeZone.includes('Africa/Luanda')) {
      return { country: 'Angola 🇦🇴', city: 'Luanda' };
    }
    if (timeZone.includes('Lisbon') || timeZone.includes('Portugal')) {
      return { country: 'Portugal 🇵🇹', city: 'Lisboa' };
    }
    if (timeZone.includes('Sao_Paulo') || timeZone.includes('Brazil')) {
      return { country: 'Brasil 🇧🇷', city: 'São Paulo' };
    }
    if (timeZone.includes('Maputo')) {
      return { country: 'Moçambique 🇲🇿', city: 'Maputo' };
    }
    if (timeZone.includes('London')) {
      return { country: 'Reino Unido 🇬🇧', city: 'Londres' };
    }
    return { country: timeZone.split('/')[0] || 'Global', city: timeZone.split('/')[1]?.replace(/_/g, ' ') || 'Web' };
  } catch {
    return { country: 'Global', city: 'Navegador' };
  }
};

// Offline / Cache resilience helpers
export const saveOfflineChatBackup = (messages: any[]) => {
  const consent = getConsentPreferences();
  if (!consent.cacheEnabled) return;
  try {
    localStorage.setItem(STORAGE_KEY_OFFLINE_CACHE, JSON.stringify({
      savedAt: new Date().toISOString(),
      messages: messages.slice(-50), // keep latest 50 messages
    }));
  } catch {
    // Ignore quota errors
  }
};

export const getOfflineChatBackup = (): any[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_OFFLINE_CACHE);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.messages || null;
    }
  } catch {
    return null;
  }
  return null;
};

// Start automated Telemetry Heartbeat (tracks session time and network health)
export const startTelemetryHeartbeat = () => {
  let sessionSeconds = 0;

  const sendHeartbeat = async () => {
    const consent = getConsentPreferences();
    if (!consent.acceptedTerms || !consent.telemetryConsent) return;

    sessionSeconds += 20;
    const geo = consent.locationConsent ? await detectClientGeo() : { country: 'Anônimo', city: 'Não partilhado' };

    try {
      await apiJson('/api/telemetry/heartbeat', {
        method: 'POST',
        body: JSON.stringify({
          durationSeconds: sessionSeconds,
          locationConsent: consent.locationConsent,
          cacheEnabled: consent.cacheEnabled,
          country: geo.country,
          city: geo.city,
        }),
      });
    } catch {
      // Offline or network instability
    }
  };

  // Run every 20 seconds
  const interval = setInterval(sendHeartbeat, 20000);
  // Send first heartbeat
  sendHeartbeat();

  return () => clearInterval(interval);
};

// ─── LGPD Compliance Utilities ──────────────────────────────────────────────

// Clear ALL user data from localStorage (Right to Deletion - LGPD Art. 18)
export const clearAllUserData = (): void => {
  try {
    // Remove consent preferences
    localStorage.removeItem(STORAGE_KEY_CONSENT);
    // Remove offline cache
    localStorage.removeItem(STORAGE_KEY_OFFLINE_CACHE);
    // Remove session ID
    sessionStorage.removeItem(STORAGE_KEY_SESSION_ID);
    // Remove other app-specific data
    localStorage.removeItem('gt_student_memory');
    localStorage.removeItem('lp_lang');
    localStorage.removeItem('gt_hide_guide');
    localStorage.removeItem('ngola_admin_token');
    // Remove theme preference
    localStorage.removeItem('ngola_theme');
  } catch {
    // Ignore errors
  }
};

// Export all user data for portability (LGPD Art. 18, V)
export const exportUserData = (): object => {
  const data: Record<string, any> = {};
  try {
    // Collect all stored user data
    data.consentPreferences = getConsentPreferences();
    data.sessionId = getOrCreateSessionId();
    data.offlineMessages = getOfflineChatBackup();
    data.studentMemory = localStorage.getItem('gt_student_memory');
    data.languagePreference = localStorage.getItem('lp_lang');
    data.themePreference = localStorage.getItem('ngola_theme');
    data.exportTimestamp = new Date().toISOString();
    data.exportFormat = 'LGPD Art. 18 - Portabilidade de Dados';
  } catch {
    // Return whatever we collected
  }
  return data;
};

// Get a human-readable summary of what data is stored (LGPD Art. 18, II)
export const getDataInventory = (): Array<{ category: string; description: string; legalBasis: string; retention: string; stored: boolean }> => {
  const consent = getConsentPreferences();
  return [
    {
      category: 'Preferências de Consentimento',
      description: 'Registo das suas escolhas de privacidade e consentimento',
      legalBasis: 'Obrigação Legal (LGPD Art. 7, II)',
      retention: 'Enquanto o utilizador mantiver conta ativa',
      stored: true,
    },
    {
      category: 'ID de Sessão Anónimo',
      description: 'Identificador temporário para manter a sessão de tutoria',
      legalBasis: 'Execução de Contrato (LGPD Art. 7, V)',
      retention: 'Duração da sessão do navegador',
      stored: !!sessionStorage.getItem(STORAGE_KEY_SESSION_ID),
    },
    {
      category: 'Cache de Mensagens Offline',
      description: 'Backup local das últimas 50 mensagens para resiliência offline',
      legalBasis: 'Consentimento (LGPD Art. 7, I)',
      retention: 'Até o utilizador limpar ou revogar consentimento',
      stored: consent.cacheEnabled && !!localStorage.getItem(STORAGE_KEY_OFFLINE_CACHE),
    },
    {
      category: 'Memória do Estudante',
      description: 'Contexto de aprendizagem personalizado (nível, matérias, estilo)',
      legalBasis: 'Consentimento (LGPD Art. 7, I)',
      retention: 'Até o utilizador limpar dados',
      stored: !!localStorage.getItem('gt_student_memory'),
    },
    {
      category: 'Preferência de Idioma',
      description: 'Idioma selecionado (PT/EN)',
      legalBasis: 'Interesse Legítimo (LGPD Art. 7, IX)',
      retention: 'Persistente',
      stored: !!localStorage.getItem('lp_lang'),
    },
    {
      category: 'Telemetria de Desempenho',
      description: 'Métricas de uso: duração da sessão, tokens consumidos, latência',
      legalBasis: 'Interesse Legítimo (LGPD Art. 7, IX)',
      retention: '90 dias no servidor',
      stored: consent.telemetryConsent,
    },
    {
      category: 'Localização Geográfica Aproximada',
      description: 'País e cidade derivados do fuso horário (não GPS)',
      legalBasis: 'Consentimento (LGPD Art. 7, I)',
      retention: '90 dias no servidor',
      stored: consent.locationConsent,
    },
  ];
};
