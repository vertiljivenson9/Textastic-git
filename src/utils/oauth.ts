/**
 * auth.ts - Autenticación OAuth con GitHub usando PKCE
 * 
 * Flujo seguro: 
 * - PKCE para no exponer client_secret
 * - Intercambio de código por token mediante worker
 */

import pkceChallenge from 'pkce-challenge';
import type { OAuthConfig, AuthState } from '@/types';

// ============================================================================
// CONFIGURACIÓN FIJA (para tu deploy actual)
// ============================================================================

// Este Client ID viene de tu OAuth App en GitHub
const CLIENT_ID = 'Ov23liQm8V6IPqfoy10Q';

// URL de callback de tu frontend desplegado
const REDIRECT_URI = 'https://textastic-git.pages.dev/callback';

// URL de tu Worker que hace el intercambio seguro
const WORKER_EXCHANGE_URL = 'https://github-oauth-worker.vertiljivenson9.workers.dev';

// Scopes de GitHub
const SCOPES = ['repo', 'user'];

// ============================================================================
// VALIDACIÓN DE CONFIGURACIÓN
// ============================================================================

function getOAuthConfig(): OAuthConfig {
  if (!CLIENT_ID || !REDIRECT_URI || !WORKER_EXCHANGE_URL) {
    throw new Error('[OAuth] Configuración incompleta. Revisa CLIENT_ID, REDIRECT_URI y WORKER_EXCHANGE_URL.');
  }
  return {
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    workerExchangeUrl: WORKER_EXCHANGE_URL,
    scopes: SCOPES,
  };
}

// ============================================================================
// CLAVES DE ALMACENAMIENTO LOCAL
// ============================================================================

const STORAGE_KEY_TOKEN = 'textastic_github_token';
const STORAGE_KEY_STATE = 'textastic_oauth_state';
const STORAGE_KEY_VERIFIER = 'textastic_pkce_verifier';

// ============================================================================
// GENERACIÓN PKCE
// ============================================================================

export async function generatePKCE(): Promise<{ codeChallenge: string; codeVerifier: string }> {
  const challenge = await pkceChallenge();
  // Usamos sessionStorage para datos temporales (por pestaña)
  sessionStorage.setItem(STORAGE_KEY_VERIFIER, challenge.code_verifier);
  return {
    codeChallenge: challenge.code_challenge,
    codeVerifier: challenge.code_verifier,
  };
}

export function generateState(): string {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  // Usamos sessionStorage para datos temporales (por pestaña)
  sessionStorage.setItem(STORAGE_KEY_STATE, state);
  return state;
}

// ============================================================================
// INICIO DEL FLUJO OAUTH
// ============================================================================

export async function startOAuth(): Promise<void> {
  const config = getOAuthConfig();
  const { codeChallenge } = await generatePKCE();
  const state = generateState();

  const authUrl = new URL('https://github.com/login/oauth/authorize');
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('scope', config.scopes.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log('[OAuth] Redirigiendo a GitHub:', authUrl.toString());
  window.location.href = authUrl.toString();
}

// ============================================================================
// CALLBACK Y OBTENCIÓN DEL TOKEN (con depuración mejorada)
// ============================================================================

export async function handleCallback(): Promise<string> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) throw new Error(`[OAuth] GitHub error: ${errorDescription || error}`);
  if (!code) throw new Error('[OAuth] No se recibió código de autorización');

  // Leer de sessionStorage
  const storedState = sessionStorage.getItem(STORAGE_KEY_STATE);
  
  // --- DEPURACIÓN: mostrar valores si hay discrepancia ---
  if (!storedState || storedState !== state) {
    alert(`ERROR DE STATE:\nStored: ${storedState}\nURL: ${state}\nURL completa: ${window.location.href}`);
    console.error('[STATE_DEBUG] storedState:', storedState);
    console.error('[STATE_DEBUG] state from URL:', state);
    console.error('[STATE_DEBUG] URL:', window.location.href);
    throw new Error('[OAuth] State no coincide (posible CSRF)');
  }
  // -------------------------------------------------------

  const codeVerifier = sessionStorage.getItem(STORAGE_KEY_VERIFIER);
  if (!codeVerifier) throw new Error('[OAuth] code_verifier no encontrado');

  const config = getOAuthConfig();

  const response = await fetch(config.workerExchangeUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, code_verifier: codeVerifier }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[OAuth] Worker error ${response.status}: ${text}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(`[OAuth] GitHub error: ${data.error_description || data.error}`);

  const accessToken = data.access_token;
  if (!accessToken) throw new Error('[OAuth] No se recibió access_token del worker');

  // Guardar token y limpiar almacenamiento temporal
  localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
  sessionStorage.removeItem(STORAGE_KEY_VERIFIER);
  sessionStorage.removeItem(STORAGE_KEY_STATE);

  console.log('[OAuth] Token obtenido correctamente');
  return accessToken;
}

// ============================================================================
// GESTIÓN DE SESIÓN
// ============================================================================

export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  console.log('[OAuth] Sesión cerrada');
}

export async function getUserInfo(): Promise<{ login: string; avatar_url: string; name: string } | null> {
  const token = getAccessToken();
  if (!token) return null;

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
    });
    if (!response.ok) throw new Error(`Error obteniendo usuario: ${response.status}`);
    return await response.json();
  } catch (e) {
    console.error('[OAuth] Error obteniendo info:', e);
    return null;
  }
}

export async function getAuthState(): Promise<AuthState> {
  const token = getAccessToken();
  if (!token) return { isAuthenticated: false, accessToken: null, username: null, avatarUrl: null };
  const user = await getUserInfo();
  return {
    isAuthenticated: true,
    accessToken: token,
    username: user?.login || null,
    avatarUrl: user?.avatar_url || null,
  };
}