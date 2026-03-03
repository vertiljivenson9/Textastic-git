/**
 * Utilidades para el File System Virtual usando LightningFS
 * 
 * LightningFS es un sistema de archivos basado en IndexedDB que permite
 * persistir archivos en el navegador de forma asíncrona.
 */

import LightningFS from '@isomorphic-git/lightning-fs';

// ============================================================================
// INICIALIZACIÓN DEL FILE SYSTEM
// ============================================================================

/**
 * Instancia singleton del sistema de archivos
 * Usa IndexedDB como backend para persistencia entre sesiones
 */
const fs = new LightningFS('textastic-fs', {
  // Limpiar la base de datos si hay problemas de corrupción
  wipe: false,
});

/**
 * Promisified FS para usar async/await
 * LightningFS usa callbacks, así que lo envolvemos en Promises
 */
const pfs = fs.promises;

// Directorio raíz del workspace
export const WORKSPACE_ROOT = '/workspace';

/**
 * Inicializa el directorio de trabajo si no existe
 */
export async function initializeWorkspace(): Promise<void> {
  try {
    // Verificar si el directorio workspace existe
    try {
      await pfs.stat(WORKSPACE_ROOT);
    } catch {
      // Si no existe, crearlo
      await pfs.mkdir(WORKSPACE_ROOT);
      console.log('[FS] Workspace inicializado:', WORKSPACE_ROOT);
    }
  } catch (error) {
    console.error('[FS] Error inicializando workspace:', error);
    throw error;
  }
}

// ============================================================================
// OPERACIONES DE ARCHIVOS
// ============================================================================

/**
 * Escribe contenido en un archivo
 * @param path - Ruta del archivo (relativa a WORKSPACE_ROOT o absoluta)
 * @param content - Contenido a escribir
 */
export async function writeFile(path: string, content: string): Promise<void> {
  const fullPath = path.startsWith('/') ? path : `${WORKSPACE_ROOT}/${path}`;
  
  try {
    // Asegurar que el directorio padre existe
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    if (dir && dir !== '/') {
      await mkdir(dir, true);
    }
    
    // Escribir el archivo
    await pfs.writeFile(fullPath, content, 'utf8');
    console.log('[FS] Archivo escrito:', fullPath);
  } catch (error) {
    console.error('[FS] Error escribiendo archivo:', fullPath, error);
    throw error;
  }
}

/**
 * Lee el contenido de un archivo
 * @param path - Ruta del archivo
 * @returns Contenido del archivo como string
 */
export async function readFile(path: string): Promise<string> {
  const fullPath = path.startsWith('/') ? path : `${WORKSPACE_ROOT}/${path}`;
  
  try {
    const content = await pfs.readFile(fullPath, 'utf8') as string;
    return content;
  } catch (error) {
    console.error('[FS] Error leyendo archivo:', fullPath, error);
    throw error;
  }
}

/**
 * Verifica si un archivo existe
 * @param path - Ruta a verificar
 */
export async function exists(path: string): Promise<boolean> {
  const fullPath = path.startsWith('/') ? path : `${WORKSPACE_ROOT}/${path}`;
  
  try {
    await pfs.stat(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Elimina un archivo o directorio
 * @param path - Ruta a eliminar
 * @param recursive - Si es directorio, eliminar recursivamente
 */
export async function remove(path: string, recursive = false): Promise<void> {
  const fullPath = path.startsWith('/') ? path : `${WORKSPACE_ROOT}/${path}`;
  
  try {
    const stats = await pfs.stat(fullPath);
    
    if (stats.isDirectory()) {
      if (recursive) {
        // Leer contenido y eliminar recursivamente
        const items = await pfs.readdir(fullPath);
        for (const item of items) {
          await remove(`${fullPath}/${item}`, true);
        }
      }
      await pfs.rmdir(fullPath);
    } else {
      await pfs.unlink(fullPath);
    }
    
    console.log('[FS] Eliminado:', fullPath);
  } catch (error) {
    console.error('[FS] Error eliminando:', fullPath, error);
    throw error;
  }
}

// ============================================================================
// OPERACIONES DE DIRECTORIOS
// ============================================================================

/**
 * Crea un directorio
 * @param path - Ruta del directorio
 * @param recursive - Crear padres si no existen
 */
export async function mkdir(path: string, recursive = false): Promise<void> {
  const fullPath = path.startsWith('/') ? path : `${WORKSPACE_ROOT}/${path}`;
  
  try {
    if (recursive) {
      // Crear directorios padre recursivamente
      const parts = fullPath.split('/').filter(Boolean);
      let currentPath = '';
      
      for (const part of parts) {
        currentPath += `/${part}`;
        try {
          await pfs.mkdir(currentPath);
        } catch {
          // Ignorar error si el directorio ya existe
        }
      }
    } else {
      await pfs.mkdir(fullPath);
    }
    
    console.log('[FS] Directorio creado:', fullPath);
  } catch (error) {
    console.error('[FS] Error creando directorio:', fullPath, error);
    throw error;
  }
}

/**
 * Lista el contenido de un directorio
 * @param path - Ruta del directorio
 * @returns Array de nombres de archivos/carpetas
 */
export async function readdir(path: string): Promise<string[]> {
  const fullPath = path.startsWith('/') ? path : `${WORKSPACE_ROOT}/${path}`;
  
  try {
    const items = await pfs.readdir(fullPath);
    return items as string[];
  } catch (error) {
    console.error('[FS] Error leyendo directorio:', fullPath, error);
    throw error;
  }
}

/**
 * Obtiene información de un archivo o directorio
 * @param path - Ruta a consultar
 */
export async function stat(path: string): Promise<{
  isFile: () => boolean;
  isDirectory: () => boolean;
  size: number;
}> {
  const fullPath = path.startsWith('/') ? path : `${WORKSPACE_ROOT}/${path}`;
  
  try {
    const stats = await pfs.stat(fullPath);
    return stats as {
      isFile: () => boolean;
      isDirectory: () => boolean;
      size: number;
    };
  } catch (error) {
    console.error('[FS] Error obteniendo stats:', fullPath, error);
    throw error;
  }
}

// ============================================================================
// UTILIDADES DE ÁRBOL DE ARCHIVOS
// ============================================================================

import type { FileNode } from '@/types';

/**
 * Construye el árbol de archivos recursivamente
 * @param dirPath - Directorio raíz a escanear
 * @returns Árbol de archivos como array de FileNode
 */
export async function buildFileTree(dirPath: string = WORKSPACE_ROOT): Promise<FileNode[]> {
  const nodes: FileNode[] = [];
  
  try {
    const items = await readdir(dirPath);
    
    for (const item of items) {
      // Ignorar archivos ocultos y .git
      if (item.startsWith('.') && item !== '.github') continue;
      
      const itemPath = `${dirPath}/${item}`;
      const stats = await stat(itemPath);
      
      const node: FileNode = {
        name: item,
        path: itemPath,
        type: stats.isDirectory() ? 'directory' : 'file',
      };
      
      if (stats.isDirectory()) {
        node.children = await buildFileTree(itemPath);
      }
      
      nodes.push(node);
    }
    
    // Ordenar: directorios primero, luego archivos, ambos alfabéticamente
    nodes.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === 'directory' ? -1 : 1;
    });
    
  } catch (error) {
    console.error('[FS] Error construyendo árbol:', dirPath, error);
  }
  
  return nodes;
}

/**
 * Crea un nuevo archivo vacío
 * @param path - Ruta del nuevo archivo
 */
export async function createNewFile(path: string): Promise<void> {
  const fullPath = path.startsWith('/') ? path : `${WORKSPACE_ROOT}/${path}`;
  
  // Verificar si ya existe
  if (await exists(fullPath)) {
    throw new Error(`El archivo ya existe: ${path}`);
  }
  
  // Crear con contenido vacío
  await writeFile(fullPath, '');
}

/**
 * Renombra un archivo o directorio
 * @param oldPath - Ruta actual
 * @param newPath - Nueva ruta
 */
export async function rename(oldPath: string, newPath: string): Promise<void> {
  const fullOldPath = oldPath.startsWith('/') ? oldPath : `${WORKSPACE_ROOT}/${oldPath}`;
  const fullNewPath = newPath.startsWith('/') ? newPath : `${WORKSPACE_ROOT}/${newPath}`;
  
  try {
    await pfs.rename(fullOldPath, fullNewPath);
    console.log('[FS] Renombrado:', fullOldPath, '->', fullNewPath);
  } catch (error) {
    console.error('[FS] Error renombrando:', fullOldPath, error);
    throw error;
  }
}

/**
 * Limpia todo el workspace (¡CUIDADO!)
 * Útil para resetear el estado
 */
export async function clearWorkspace(): Promise<void> {
  try {
    const items = await readdir(WORKSPACE_ROOT);
    for (const item of items) {
      await remove(`${WORKSPACE_ROOT}/${item}`, true);
    }
    console.log('[FS] Workspace limpiado');
  } catch (error) {
    console.error('[FS] Error limpiando workspace:', error);
    throw error;
  }
}

// Exportar la instancia de fs para uso avanzado
export { fs, pfs };
