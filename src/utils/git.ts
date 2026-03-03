/**
 * Utilidades para operaciones Git usando isomorphic-git
 * 
 * isomorphic-git es una implementación pura de Git en JavaScript
 * que funciona en el navegador usando el filesystem virtual.
 */

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import { WORKSPACE_ROOT, pfs } from './fs';

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

/**
 * Configuración por defecto para operaciones git
 */
const GIT_CONFIG = {
  fs: pfs,
  http,
  dir: WORKSPACE_ROOT,
  defaultBranch: 'main',
};

// ============================================================================
// CLONAR REPOSITORIO
// ============================================================================

/**
 * Clona un repositorio de GitHub
 * 
 * @param url - URL del repositorio (https://github.com/usuario/repo.git)
 * @param token - Token de acceso OAuth (opcional, para repos privados)
 * @param onProgress - Callback para reportar progreso
 */
export async function cloneRepository(
  url: string,
  token?: string,
  onProgress?: (event: {
    phase: string;
    loaded: number;
    total: number;
  }) => void
): Promise<void> {
  console.log('[Git] Clonando repositorio:', url);
  
  try {
    const config: {
      fs: typeof pfs;
      http: typeof http;
      dir: string;
      url: string;
      singleBranch: boolean;
      depth: number;
      headers?: { Authorization: string };
      onProgress?: (event: { phase: string; loaded: number; total: number }) => void;
    } = {
      ...GIT_CONFIG,
      url,
      singleBranch: true,
      depth: 1,
    };
    
    // Agregar token si está disponible
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`,
      };
    }
    
    // Agregar callback de progreso si se proporciona
    if (onProgress) {
      config.onProgress = onProgress;
    }
    
    await git.clone(config);
    
    console.log('[Git] Repositorio clonado exitosamente');
    
  } catch (error) {
    console.error('[Git] Error clonando repositorio:', error);
    throw error;
  }
}

// ============================================================================
// CONFIGURACIÓN DE USUARIO
// ============================================================================

/**
 * Configura el nombre y email del usuario para commits
 * 
 * @param name - Nombre del usuario
 * @param email - Email del usuario
 */
export async function setUserConfig(name: string, email: string): Promise<void> {
  try {
    await git.setConfig({
      ...GIT_CONFIG,
      path: 'user.name',
      value: name,
    });
    
    await git.setConfig({
      ...GIT_CONFIG,
      path: 'user.email',
      value: email,
    });
    
    console.log('[Git] Configuración de usuario actualizada:', name, email);
  } catch (error) {
    console.error('[Git] Error configurando usuario:', error);
    throw error;
  }
}

/**
 * Obtiene la configuración actual
 */
export async function getUserConfig(): Promise<{
  name: string | undefined;
  email: string | undefined;
}> {
  try {
    const name = await git.getConfig({
      ...GIT_CONFIG,
      path: 'user.name',
    });
    
    const email = await git.getConfig({
      ...GIT_CONFIG,
      path: 'user.email',
    });
    
    return {
      name: name as string | undefined,
      email: email as string | undefined,
    };
  } catch (error) {
    console.error('[Git] Error obteniendo configuración:', error);
    return { name: undefined, email: undefined };
  }
}

// ============================================================================
// STATUS Y CAMBIOS
// ============================================================================

/**
 * Obtiene el estado de los archivos (modificados, nuevos, eliminados)
 * 
 * @returns Array con el estado de cada archivo
 */
export async function getStatus(): Promise<
  Array<{
    filepath: string;
    workdir: string;
    stage: string;
  }>
> {
  try {
    const status = await git.statusMatrix({
      ...GIT_CONFIG,
    });
    
    // statusMatrix devuelve: [filepath, head, workdir, stage]
    // 0 = absent, 1 = present but differs, 2 = present and same
    return status.map(([filepath, _head, workdir, stage]) => ({
      filepath: filepath as string,
      workdir: workdir === 0 ? 'absent' : workdir === 1 ? 'modified' : 'unmodified',
      stage: stage === 0 ? 'absent' : stage === 1 ? 'modified' : 'unmodified',
    }));
  } catch (error) {
    console.error('[Git] Error obteniendo status:', error);
    throw error;
  }
}

/**
 * Verifica si hay cambios sin commitear
 */
export async function hasChanges(): Promise<boolean> {
  try {
    const status = await getStatus();
    return status.some(
      (file) => file.workdir !== 'unmodified' || file.stage !== 'unmodified'
    );
  } catch (error) {
    console.error('[Git] Error verificando cambios:', error);
    return false;
  }
}

// ============================================================================
// STAGE Y COMMIT
// ============================================================================

/**
 * Agrega archivos al staging area
 * 
 * @param filepath - Ruta del archivo o '.' para todos
 */
export async function add(filepath: string = '.'): Promise<void> {
  try {
    await git.add({
      ...GIT_CONFIG,
      filepath,
    });
    
    console.log('[Git] Archivo(s) agregado(s):', filepath);
  } catch (error) {
    console.error('[Git] Error agregando archivo:', error);
    throw error;
  }
}

/**
 * Crea un commit con los cambios staged
 * 
 * @param message - Mensaje del commit
 */
export async function commit(message: string): Promise<string> {
  try {
    // Asegurar que tenemos configuración de usuario
    const { name, email } = await getUserConfig();
    
    if (!name || !email) {
      // Usar valores por defecto si no están configurados
      await setUserConfig('Textastic User', 'user@textastic.dev');
    }
    
    const sha = await git.commit({
      ...GIT_CONFIG,
      message,
      author: {
        name: name || 'Textastic User',
        email: email || 'user@textastic.dev',
      },
    });
    
    console.log('[Git] Commit creado:', sha);
    return sha;
    
  } catch (error) {
    console.error('[Git] Error creando commit:', error);
    throw error;
  }
}

/**
 * Agrega todos los cambios y crea un commit
 * 
 * @param message - Mensaje del commit
 */
export async function commitAll(message: string): Promise<string> {
  try {
    // Agregar todos los cambios
    const status = await getStatus();
    
    for (const file of status) {
      if (file.workdir !== 'unmodified') {
        await add(file.filepath);
      }
    }
    
    // Crear el commit
    return await commit(message);
    
  } catch (error) {
    console.error('[Git] Error en commitAll:', error);
    throw error;
  }
}

// ============================================================================
// PUSH Y PULL
// ============================================================================

/**
 * Sube los commits al repositorio remoto
 * 
 * @param token - Token de acceso OAuth
 * @param remote - Nombre del remoto (default: 'origin')
 * @param branch - Rama a pushear (default: 'main')
 */
export async function push(
  token: string,
  remote: string = 'origin',
  branch: string = 'main'
): Promise<void> {
  console.log('[Git] Pushing a', remote, branch);
  
  try {
    await git.push({
      ...GIT_CONFIG,
      remote,
      ref: branch,
      onAuth: () => {
        return {
          username: token,
          password: 'x-oauth-basic',
        };
      },
    });
    
    console.log('[Git] Push exitoso');
    
  } catch (error) {
    console.error('[Git] Error en push:', error);
    throw error;
  }
}

/**
 * Descarga cambios del repositorio remoto
 * 
 * @param token - Token de acceso OAuth
 * @param remote - Nombre del remoto (default: 'origin')
 * @param branch - Rama a pullear (default: 'main')
 */
export async function pull(
  token: string,
  remote: string = 'origin',
  branch: string = 'main'
): Promise<void> {
  console.log('[Git] Pulling desde', remote, branch);
  
  try {
    await git.pull({
      ...GIT_CONFIG,
      remote,
      ref: branch,
      onAuth: () => {
        return {
          username: token,
          password: 'x-oauth-basic',
        };
      },
      fastForwardOnly: true,
    });
    
    console.log('[Git] Pull exitoso');
    
  } catch (error) {
    console.error('[Git] Error en pull:', error);
    throw error;
  }
}

// ============================================================================
// INFORMACIÓN DEL REPOSITORIO
// ============================================================================

/**
 * Obtiene el remoto configurado
 */
export async function getRemote(): Promise<string | null> {
  try {
    const remotes = await git.listRemotes({
      ...GIT_CONFIG,
    });
    
    const origin = remotes.find((r) => r.remote === 'origin');
    return origin?.url || null;
  } catch (error) {
    console.error('[Git] Error obteniendo remote:', error);
    return null;
  }
}

/**
 * Obtiene la rama actual
 */
export async function getCurrentBranch(): Promise<string | null> {
  try {
    const branch = await git.currentBranch({
      ...GIT_CONFIG,
    });
    
    return branch || null;
  } catch (error) {
    console.error('[Git] Error obteniendo branch:', error);
    return null;
  }
}

/**
 * Obtiene el historial de commits
 * 
 * @param depth - Número de commits a obtener (default: 10)
 */
export async function getLog(depth: number = 10): Promise<
  Array<{
    oid: string;
    commit: {
      message: string;
      author: {
        name: string;
        email: string;
        timestamp: number;
      };
    };
  }>
> {
  try {
    const log = await git.log({
      ...GIT_CONFIG,
      depth,
    });
    
    return log;
  } catch (error) {
    console.error('[Git] Error obteniendo log:', error);
    return [];
  }
}

/**
 * Verifica si el directorio actual es un repositorio git
 */
export async function isRepo(): Promise<boolean> {
  try {
    await git.currentBranch({
      ...GIT_CONFIG,
    });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// UTILIDADES DE URL
// ============================================================================

/**
 * Extrae el owner y repo de una URL de GitHub
 * 
 * @param url - URL del repositorio
 * @returns Objeto con owner y repo
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    // Soporta formatos:
    // https://github.com/owner/repo.git
    // https://github.com/owner/repo
    // git@github.com:owner/repo.git
    
    const httpsMatch = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    const sshMatch = url.match(/github\.com:([^\/]+)\/([^\/\.]+)/);
    
    const match = httpsMatch || sshMatch;
    
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Construye la URL HTTPS de un repositorio
 * 
 * @param owner - Dueño del repositorio
 * @param repo - Nombre del repositorio
 */
export function buildRepoUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}.git`;
}
