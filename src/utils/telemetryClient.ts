/**
 * Ngola Tutor — Client-side Telemetry, Geolocation & Offline Cache Manager
 */

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

// Get or initialize a unique anonymous session ID
export const getOrCreateSessionId = (): string => {
  try {
    let sid = sessionStorage.getItem(STORAGE_KEY_SESSION_ID);
    if (!sid) {
      sid = 'session_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
      sessionStorage.setItem(STORAGE_KEY_SESSION_ID, sid);
    }
    return sid;
  } catch {
    return 'session_fallback_' + Date.now();
  }
};

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
  const sessionId = getOrCreateSessionId();
  let sessionSeconds = 0;

  const sendHeartbeat = async () => {
    const consent = getConsentPreferences();
    if (!consent.acceptedTerms || !consent.telemetryConsent) return;

    sessionSeconds += 20;
    const geo = consent.locationConsent ? await detectClientGeo() : { country: 'Anônimo', city: 'Não partilhado' };

    try {
      await fetch('/api/telemetry/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
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
