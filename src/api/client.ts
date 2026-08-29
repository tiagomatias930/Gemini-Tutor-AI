export interface ApiErrorBody {
  error?: string | { message?: string; code?: string };
  message?: string;
  code?: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const ensureApiPath = (path: string) => {
  if (!path.startsWith('/api/')) {
    throw new ApiError('Only same-origin backend API paths are allowed.', 400, 'INVALID_API_PATH');
  }
};

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  ensureApiPath(path);
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: 'include' });
  } catch (cause) {
    throw new ApiError(
      cause instanceof Error ? cause.message : 'Unable to reach the backend.',
      0,
      'NETWORK_ERROR',
      cause,
    );
  }

  if (response.ok) return response;

  let body: ApiErrorBody | undefined;
  try {
    body = await response.clone().json() as ApiErrorBody;
  } catch {
    // Non-JSON errors still receive a stable client-side shape.
  }
  const nested = typeof body?.error === 'object' ? body.error : undefined;
  const message = nested?.message
    || (typeof body?.error === 'string' ? body.error : undefined)
    || body?.message
    || `Request failed (${response.status}).`;
  throw new ApiError(
    message,
    response.status,
    nested?.code || body?.code || `HTTP_${response.status}`,
    body?.details,
  );
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await apiFetch(path, { ...init, headers });
  if (response.status === 204) return undefined as T;
  try {
    return await response.json() as T;
  } catch (cause) {
    throw new ApiError('The backend returned an invalid response.', response.status, 'INVALID_RESPONSE', cause);
  }
}

export interface LiveSessionAdapter {
  close(): void;
  sendRealtimeInput(input: unknown): void;
}

interface LiveCallbacks {
  onopen?: () => void;
  onmessage: (message: any) => void;
  onerror?: (error: Error) => void;
  onclose?: (event: CloseEvent) => void;
}

interface LiveSessionOptions {
  callbacks: LiveCallbacks;
  context?: object;
  memory?: string;
  history?: Array<{role: 'user' | 'assistant'; text: string}>;
}

type LiveServerEnvelope =
  | {type: 'ready'}
  | {type: 'message'; data: unknown}
  | {type: 'error'; error?: {code?: string; message?: string}};

export async function connectLiveSession(options: LiveSessionOptions): Promise<LiveSessionAdapter> {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${window.location.host}/api/live`);
  let ready = false;
  let settled = false;
  let manuallyClosed = false;

  return await new Promise<LiveSessionAdapter>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.close();
        reject(new ApiError('The live tutor took too long to connect.', 504, 'LIVE_CONNECT_TIMEOUT'));
      }
    }, 15_000);

    const failBeforeReady = (error: ApiError) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(error);
    };

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({
        type: 'start',
        context: options.context,
        memory: options.memory,
        history: options.history?.slice(-12),
      }));
    });

    socket.addEventListener('message', event => {
      let envelope: LiveServerEnvelope;
      try {
        envelope = JSON.parse(String(event.data)) as LiveServerEnvelope;
      } catch {
        const error = new ApiError('The live tutor returned an invalid message.', 502, 'INVALID_LIVE_RESPONSE');
        options.callbacks.onerror?.(error);
        failBeforeReady(error);
        socket.close();
        return;
      }

      if (envelope.type === 'ready') {
        ready = true;
        settled = true;
        window.clearTimeout(timeout);
        const adapter: LiveSessionAdapter = {
          close() {
            manuallyClosed = true;
            socket.close(1000, 'Client ended session');
          },
          sendRealtimeInput(input: unknown) {
            if (socket.readyState !== WebSocket.OPEN) {
              throw new ApiError('The live tutor is not connected.', 503, 'LIVE_NOT_CONNECTED');
            }
            const media = (input as {media?: unknown})?.media;
            socket.send(JSON.stringify({type: 'realtime_input', media}));
          },
        };
        resolve(adapter);
        options.callbacks.onopen?.();
        return;
      }

      if (envelope.type === 'message') {
        options.callbacks.onmessage(envelope.data);
        return;
      }

      const error = new ApiError(
        envelope.error?.message || 'The live tutor encountered an error.',
        503,
        envelope.error?.code || 'LIVE_PROVIDER_ERROR',
      );
      options.callbacks.onerror?.(error);
      failBeforeReady(error);
    });

    socket.addEventListener('error', () => {
      const error = new ApiError(
        'Unable to connect to the live tutor.',
        503,
        'LIVE_CONNECTION_ERROR',
      );
      options.callbacks.onerror?.(error);
      failBeforeReady(error);
    });

    socket.addEventListener('close', event => {
      window.clearTimeout(timeout);
      if (!ready) {
        failBeforeReady(new ApiError(
          'The live tutor is unavailable. Please try again.',
          503,
          'LIVE_UNAVAILABLE',
        ));
      }
      if (ready || manuallyClosed) options.callbacks.onclose?.(event);
    });
  });
}
