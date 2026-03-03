/**
 * Tipos principales de la aplicación Textastic
 * Define las interfaces para archivos, tabs y configuración
 */

/** Representa un archivo en el file system virtual */
export interface FileNode {
  /** Nombre del archivo o carpeta */
  name: string;
  /** Ruta completa desde la raíz */
  path: string;
  /** Si es directorio o archivo */
  type: 'file' | 'directory';
  /** Contenido del archivo (solo para type='file') */
  content?: string;
  /** Hijos si es directorio */
  children?: FileNode[];
}

/** Representa un tab abierto en el editor */
export interface EditorTab {
  /** ID único del tab */
  id: string;
  /** Nombre del archivo */
  name: string;
  /** Ruta completa del archivo */
  path: string;
  /** Contenido actual */
  content: string;
  /** Contenido original (para detectar cambios) */
  originalContent: string;
  /** Lenguaje para syntax highlighting */
  language: string;
  /** Si tiene cambios sin guardar */
  isDirty: boolean;
}

/** Estado de autenticación de GitHub */
export interface AuthState {
  /** Si el usuario está autenticado */
  isAuthenticated: boolean;
  /** Token de acceso OAuth */
  accessToken: string | null;
  /** Nombre de usuario de GitHub */
  username: string | null;
  /** Avatar del usuario */
  avatarUrl?: string | null;
}

/** Configuración de OAuth de GitHub */
export interface OAuthConfig {
  /** Client ID de la OAuth App (¡REEMPLAZAR CON TU VALOR REAL!) */
  clientId: string;
  /** URL de redirección después del login (¡REEMPLAZAR CON TU VALOR REAL!) */
  redirectUri: string;
  /** URL del worker para intercambio de código (¡REEMPLAZAR CON TU VALOR REAL!) */
  workerExchangeUrl: string;
  /** Scopes solicitados */
  scopes: string[];
}

/** Configuración del repositorio Git */
export interface RepoConfig {
  /** URL del repositorio */
  url: string;
  /** Rama actual */
  branch: string;
  /** Si está clonado localmente */
  isCloned: boolean;
  /** Ruta local del repositorio */
  localPath: string;
}

/** Props para el componente FileTree */
export interface FileTreeProps {
  /** Nodos a mostrar */
  nodes: FileNode[];
  /** Nodo seleccionado */
  selectedPath?: string;
  /** Callback al hacer click en un archivo */
  onFileSelect: (node: FileNode) => void;
  /** Nivel de indentación (uso interno) */
  level?: number;
}

/** Props para el componente EditorPane */
export interface EditorPaneProps {
  /** Tabs abiertos */
  tabs: EditorTab[];
  /** Tab activo */
  activeTabId: string | null;
  /** Callback al cambiar de tab */
  onTabChange: (tabId: string) => void;
  /** Callback al cerrar un tab */
  onTabClose: (tabId: string) => void;
  /** Callback al cambiar contenido */
  onContentChange: (tabId: string, content: string) => void;
}

/** Estado global de la aplicación */
export interface AppState {
  /** Archivos en el workspace */
  files: FileNode[];
  /** Tabs abiertos */
  tabs: EditorTab[];
  /** Tab activo */
  activeTabId: string | null;
  /** Configuración del repo */
  repoConfig: RepoConfig;
  /** Estado de auth */
  auth: AuthState;
}
