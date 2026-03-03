/**
 * Utilidades para autenticación OAuth con GitHub usando PKCE
 * 
 * IMPORTANTE DE SEGURIDAD:
 * - NUNCA almacenes el client_secret en el frontend
 * - Usamos PKCE (Proof Key for Code Exchange) para seguridad adicional
 * - El intercambio de código por token se hace en un worker seguro
 * 
 * FLUJO OAuth CON PKCE:
 * 1. Generar code_verifier y code_challenge
 * 2. Redirigir a GitHub con code_challenge
 * 3. GitHub redirige de vuelta con authorization code
 * 4. Enviar code + code_verifier al worker
 * 5. Worker intercambia con GitHub (con client_secret seguro)
 * 6. Worker devuelve access_token al frontend
 */

import pkceChallenge from 'pkce-challenge';
import type { OAuthConfig, AuthState } from '@/types';

// ============================================================================
// CONFIGURACIÓN OAuth - PLACEHOLDERS VACÍOS
// ============================================================================

/**
 * ⚠️ PLACEHOLDERS - DEBES REEMPLAZAR ESTOS VALORES ⚠️
 * 
 * Para configurar la autenticación con GitHub:
 * 
 * 1. Ve a GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
 * 2. Application name: Textastic (o el nombre que prefieras)
 * 3. Homepage URL: http://localhost:5173 (para desarrollo local)
 * 4. Authorization callback URL: http://localhost:5173/callback
 * 5. Desmarca "Enable Device Flow"
 * 6. Crea la app y copia el Client ID
 * 
 * Para el WORKER_EXCHANGE_URL:
 * - Necesitas crear un Cloudflare Worker (o similar) que haga el intercambio
 * - El worker debe tener el CLIENT_SECRET de forma segura
 * - El worker recibe { code, code_verifier } y devuelve { access_token }
 * 
 * Ejemplo de worker en Cloudflare Workers:
 * ```javascript
 * export default {
 *   async fetch(request, env) {
 *     if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
 *     
 *     const { code, code_verifier } = await request.json();
 *     
 *     const response = await fetch('https://github.com/login/oauth/access_token', {
 *       method: 'POST',
 *       headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
 *       body: JSON.stringify({
 *         client_id: env.GITHUB_CLIENT_ID,
 *         client_secret: env.GITHUB_CLIENT_SECRET,
 *         code,
 *         code_verifier,
 *       }),
 *     });
 *     
 *     const data = await response.json();
 *     return new Response(JSON.stringify(data), {
 *       headers: { 'Content-Type': 'application/json' },
 *     });
 *   },
 * };
 * ```
 */

// 🔴 REEMPLAZA CON TU CLIENT ID REAL DE GITHUB OAUTH APP
const CLIENT_ID = '';

// 🔴 REEMPLAZA CON TU URL DE REDIRECCIÓN REAL
// Para desarrollo local: 'http://localhost:5173/callback'
// Para producción: 'https://tu-dominio.com/callback'
const REDIRECT_URI = '';

// 🔴 REEMPLAZA CON LA URL DE TU WORKER DE INTERCAMBIO
// Este worker debe intercambiar el código por el token de forma segura
const WORKER_EXCHANGE_URL = '';

// Scopes solicitados a GitHub
const SCOPES = ['repo', 'user'];

/**
 * Configuración OAuth completa
 * Lanza error si los placeholders no han sido reemplazados
 */
export function getOAuthConfig(): OAuthConfig {
  // Validar que los placeholders hayan sido reemplazados
  if (!CLIENT_ID) {
    throw new Error(
      'CLIENT_ID no configurado. ' +
      'Por favor, edita src/utils/oauth.ts y reemplaza CLIENT_ID con tu Client ID de GitHub OAuth App. ' +
      'Instrucciones detalladas en los comentarios del archivo.'
    );
  }
  
  if (!REDIRECT_URI) {
    throw new Error(
      'REDIRECT_URI no configurado. ' +
      'Por favor, edita src/utils/oauth.ts y reemplaza REDIRECT_URI con tu URL de callback. ' +
      'Para desarrollo local usa: http://localhost:5173/callback'
    );
  }
  
  if (!WORKER_EXCHANGE_URL) {
    throw new Error(
      'WORKER_EXCHANGE_URL no configurado. ' +
      'Por favor, edita src/utils/oauth.ts y reemplaza WORKER_EXCHANGE_URL con la URL de tu worker. ' +
      'Este worker debe intercambiar el código por el token de forma segura (con el client_secret).'
    );
  }
  
  return {
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    workerExchangeUrl: WORKER_EXCHANGE_URL,
    scopes: SCOPES,
  };
}

// ============================================================================
// CLAVES DE ALMACENAMIENTO
// ============================================================================

const STORAGE_KEY_TOKEN = 'textastic_github_token';
const STORAGE_KEY_STATE = 'textastic_oauth_state';
const STORAGE_KEY_VERIFIER = 'textastic_pkce_verifier';

// ============================================================================
// GENERACIÓN PKCE
// ============================================================================

/**
 * Genera un par code_verifier y code_challenge para PKCE
 * El code_verifier se almacena temporalmente para el intercambio
 */
export async function generatePKCE(): Promise<{
  codeChallenge: string;
  codeVerifier: string;
}> {
  const challenge = await pkceChallenge();
  
  // Almacenar el verifier para usarlo después en el callback
  localStorage.setItem(STORAGE_KEY_VERIFIER, challenge.code_verifier);
  
  return {
    codeChallenge: challenge.code_challenge,
    codeVerifier: challenge.code_verifier,
  };
}

/**
 * Genera un state aleatorio para protección CSRF
 */
export function generateState(): string {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  localStorage.setItem(STORAGE_KEY_STATE, state);
  return state;
}

// ============================================================================
// INICIO DEL FLUJO OAuth
// ============================================================================

/**
 * Inicia el flujo de autenticación OAuth con GitHub
 * Redirige al usuario a GitHub para autorizar la aplicación
 */
export async function startOAuth(): Promise<void> {
  try {
    const config = getOAuthConfig();
    
    // Generar PKCE
    const { codeChallenge } = await generatePKCE();
    
    // Generar state para protección CSRF
    const state = generateState();
    
    // Construir URL de autorización
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('scope', config.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    console.log('[OAuth] Iniciando autorización...');
    console.log('[OAuth] URL:', authUrl.toString());
    
    // Redirigir a GitHub
    window.location.href = authUrl.toString();
    
  } catch (error) {
    console.error('[OAuth] Error iniciando flujo:', error);
    throw error;
  }
}

// ============================================================================
// MANEJO DEL CALLBACK
// ============================================================================

/**
 * Maneja el callback de GitHub después de la autorización
 * Extrae el código, verifica el state y obtiene el access token
 * 
 * @returns El access token si el flujo es exitoso
 */
export async function handleCallback(): Promise<string> {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  
  console.log('[OAuth] Callback recibido');
  console.log('[OAuth] Code presente:', !!code);
  console.log('[OAuth] State presente:', !!state);
  
  // Verificar errores de GitHub
  if (error) {
    const message = errorDescription || error;
    console.error('[OAuth] Error de GitHub:', message);
    throw new Error(`Error de autorización: ${message}`);
  }
  
  // Verificar que tenemos código
  if (!code) {
    throw new Error('No se recibió código de autorización');
  }
  
  // Verificar state para protección CSRF
  const storedState = localStorage.getItem(STORAGE_KEY_STATE);
  if (!storedState || storedState !== state) {
    throw new Error('Error de seguridad: state no coincide (posible ataque CSRF)');
  }
  
  // Limpiar state usado
  localStorage.removeItem(STORAGE_KEY_VERIFIER);
  
  // Recuperar code_verifier
  const codeVerifier = localStorage.getItem(STORAGE_KEY_VERIFIER);
  if (!codeVerifier) {
    throw new Error('Error: no se encontró code_verifier (¿la página se recargó?)');
  }
  
  // Intercambiar código por token usando el worker
  const config = getOAuthConfig();
  
  console.log('[OAuth] Intercambiando código por token...');
  
  try {
    const response = await fetch(config.workerExchangeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error del worker: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Error de GitHub: ${data.error_description || data.error}`);
    }
    
    const accessToken = data.access_token;
    
    if (!accessToken) {
      throw new Error('No se recibió access_token del worker');
    }
    
    // Almacenar token
    localStorage.setItem(STORAGE_KEY_TOKEN, accessToken);
    
    // Limpiar verifier
    localStorage.removeItem(STORAGE_KEY_VERIFIER);
    localStorage.removeItem(STORAGE_KEY_STATE);
    
    console.log('[OAuth] Token obtenido exitosamente');
    
    return accessToken;
    
  } catch (error) {
    console.error('[OAuth] Error en intercambio:', error);
    throw error;
  }
}

// ============================================================================
// GESTIÓN DE SESIÓN
// ============================================================================

/**
 * Obtiene el token de acceso almacenado
 */
export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEY_TOKEN);
}

/**
 * Verifica si el usuario está autenticado
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/**
 * Cierra la sesión eliminando el token
 */
export function logout(): void {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  console.log('[OAuth] Sesión cerrada');
}

/**
 * Obtiene información del usuario autenticado
 */
export async function getUserInfo(): Promise<{
  login: string;
  avatar_url: string;
  name: string;
} | null> {
  const token = getAccessToken();
  if (!token) return null;
  
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Error obteniendo usuario: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('[OAuth] Error obteniendo info de usuario:', error);
    return null;
  }
}

/**
 * Obtiene el estado completo de autenticación
 */
export async function getAuthState(): Promise<AuthState> {
  const token = getAccessToken();
  
  if (!token) {
    return {
      isAuthenticated: false,
      accessToken: null,
      username: null,
      avatarUrl: null,
    };
  }
  
  const userInfo = await getUserInfo();
  
  return {
    isAuthenticated: true,
    accessToken: token,
    username: userInfo?.login || null,
    avatarUrl: userInfo?.avatar_url || null,
  };
}
