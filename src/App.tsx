/**
 * Textastic - Editor de código con integración GitHub
 * 
 * Aplicación principal que integra:
 * - Monaco Editor con multi-tabs
 * - File tree recursivo
 * - Virtual filesystem con LightningFS
 * - Git operations con isomorphic-git
 * - OAuth con GitHub usando PKCE
 * 
 * Layout:
 * - Sidebar izquierda: File tree
 * - Centro: Editor Monaco con tabs
 * - Derecha: Preview pane
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';

// Iconos
import {
  FolderGit,
  Plus,
  Save,
  Upload,
  Download,
  Github,
  LogOut,
  RefreshCw,
  Check,
  FileCode,
  Menu,
  X,
} from 'lucide-react';

// Componentes UI
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

// Componentes propios
import { FileTree } from '@/components/FileTree';
import { EditorPane } from '@/components/EditorPane';
import { PreviewPane } from '@/components/PreviewPane';

// Utilidades
import {
  initializeWorkspace,
  buildFileTree,
  writeFile,
  readFile,
  createNewFile,
  WORKSPACE_ROOT,
} from '@/utils/fs';
import {
  startOAuth,
  handleCallback,
  getAuthState,
  logout,
} from '@/utils/oauth';
import {
  cloneRepository,
  commitAll,
  push,
  pull,
  setUserConfig,
} from '@/utils/git';

// Tipos
import type { FileNode, EditorTab, AuthState } from '@/types';

// ============================================================================
// COMPONENTE PRINCIPAL DE LA APLICACIÓN
// ============================================================================

const TextasticApp: React.FC = () => {
  // -------------------------------------------------------------------------
  // ESTADO
  // -------------------------------------------------------------------------
  
  // File system
  const [files, setFiles] = useState<FileNode[]>([]);
  
  // Editor tabs
  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const tabIdCounter = useRef(0);
  
  // Autenticación
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    accessToken: null,
    username: null,
    avatarUrl: null,
  });
  
  // Repo
  const [repoUrl, setRepoUrl] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  
  // UI
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  
  // -------------------------------------------------------------------------
  // EFECTOS INICIALES
  // -------------------------------------------------------------------------
  
  // Inicializar workspace y cargar estado de auth
  useEffect(() => {
    const init = async () => {
      try {
        // Inicializar filesystem
        await initializeWorkspace();
        
        // Cargar árbol de archivos
        await refreshFileTree();
        
        // Verificar autenticación
        const auth = await getAuthState();
        setAuthState(auth);
        
        console.log('[App] Inicialización completada');
      } catch (error) {
        console.error('[App] Error en inicialización:', error);
        toast.error('Error al inicializar la aplicación');
      }
    };
    
    init();
  }, []);
  
  // -------------------------------------------------------------------------
  // FUNCIONES DEL FILE TREE
  // -------------------------------------------------------------------------
  
  /**
   * Refresca el árbol de archivos desde el filesystem
   */
  const refreshFileTree = useCallback(async () => {
    try {
      const tree = await buildFileTree();
      setFiles(tree);
    } catch (error) {
      console.error('[App] Error refrescando file tree:', error);
    }
  }, []);
  
  /**
   * Maneja la selección de un archivo en el tree
   */
  const handleFileSelect = useCallback(async (node: FileNode) => {
    if (node.type !== 'file') return;
    
    try {
      // Verificar si ya está abierto
      const existingTab = tabs.find((t) => t.path === node.path);
      
      if (existingTab) {
        // Activar el tab existente
        setActiveTabId(existingTab.id);
        return;
      }
      
      // Leer contenido del archivo
      const content = await readFile(node.path);
      
      // Detectar lenguaje
      const ext = node.name.split('.').pop()?.toLowerCase() || '';
      const languageMap: Record<string, string> = {
        js: 'javascript',
        jsx: 'javascript',
        ts: 'typescript',
        tsx: 'typescript',
        html: 'html',
        css: 'css',
        json: 'json',
        py: 'python',
        md: 'markdown',
      };
      
      // Crear nuevo tab
      const newTab: EditorTab = {
        id: `tab-${tabIdCounter.current++}`,
        name: node.name,
        path: node.path,
        content,
        originalContent: content,
        language: languageMap[ext] || 'plaintext',
        isDirty: false,
      };
      
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      
    } catch (error) {
      console.error('[App] Error abriendo archivo:', error);
      toast.error('Error al abrir el archivo');
    }
  }, [tabs]);
  
  // -------------------------------------------------------------------------
  // FUNCIONES DE TABS
  // -------------------------------------------------------------------------
  
  /**
   * Cambia el tab activo
   */
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);
  
  /**
   * Cierra un tab
   */
  const handleTabClose = useCallback((tabId: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.id === tabId);
      const newTabs = prev.filter((t) => t.id !== tabId);
      
      // Si cerramos el tab activo, activar otro
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          // Intentar activar el anterior, o el primero
          const newIndex = Math.max(0, index - 1);
          setActiveTabId(newTabs[newIndex]?.id || null);
        } else {
          setActiveTabId(null);
        }
      }
      
      return newTabs;
    });
  }, [activeTabId]);
  
  /**
   * Maneja cambios en el contenido del editor
   */
  const handleContentChange = useCallback((tabId: string, content: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId
          ? {
              ...tab,
              content,
              isDirty: content !== tab.originalContent,
            }
          : tab
      )
    );
  }, []);
  
  /**
   * Guarda el archivo actual
   */
  const handleSave = useCallback(async () => {
    if (!activeTabId) return;
    
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.isDirty) return;
    
    try {
      await writeFile(tab.path, tab.content);
      
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, originalContent: t.content, isDirty: false }
            : t
        )
      );
      
      toast.success(`Guardado: ${tab.name}`);
      
    } catch (error) {
      console.error('[App] Error guardando:', error);
      toast.error('Error al guardar el archivo');
    }
  }, [activeTabId, tabs]);
  
  // -------------------------------------------------------------------------
  // FUNCIONES DE GIT
  // -------------------------------------------------------------------------
  
  /**
   * Clona un repositorio
   */
  const handleClone = useCallback(async () => {
    if (!repoUrl.trim()) {
      toast.error('Ingresa la URL del repositorio');
      return;
    }
    
    setIsCloning(true);
    
    try {
      const token = authState.accessToken || undefined;
      
      await cloneRepository(repoUrl, token, (progress) => {
        console.log('[Clone] Progreso:', progress);
      });
      
      // Configurar usuario si está autenticado
      if (authState.username) {
        await setUserConfig(authState.username, `${authState.username}@users.noreply.github.com`);
      }
      
      await refreshFileTree();
      toast.success('Repositorio clonado exitosamente');
      
    } catch (error) {
      console.error('[App] Error clonando:', error);
      toast.error('Error al clonar el repositorio');
    } finally {
      setIsCloning(false);
    }
  }, [repoUrl, authState, refreshFileTree]);
  
  /**
   * Crea un commit con los cambios
   */
  const handleCommit = useCallback(async () => {
    if (!authState.isAuthenticated) {
      toast.error('Debes iniciar sesión para hacer commit');
      return;
    }
    
    const hasChanges = tabs.some((t) => t.isDirty);
    if (!hasChanges) {
      toast.info('No hay cambios para commitear');
      return;
    }
    
    // Primero guardar todos los archivos modificados
    for (const tab of tabs) {
      if (tab.isDirty) {
        try {
          await writeFile(tab.path, tab.content);
        } catch (error) {
          console.error('[App] Error guardando antes de commit:', error);
        }
      }
    }
    
    setIsCommitting(true);
    
    try {
      const message = `Update from Textastic - ${new Date().toLocaleString()}`;
      await commitAll(message);
      
      // Actualizar estado de tabs
      setTabs((prev) =>
        prev.map((t) =>
          t.isDirty ? { ...t, originalContent: t.content, isDirty: false } : t
        )
      );
      
      toast.success('Commit creado exitosamente');
      
    } catch (error) {
      console.error('[App] Error en commit:', error);
      toast.error('Error al crear el commit');
    } finally {
      setIsCommitting(false);
    }
  }, [authState, tabs]);
  
  /**
   * Pushea los cambios al remoto
   */
  const handlePush = useCallback(async () => {
    if (!authState.isAuthenticated || !authState.accessToken) {
      toast.error('Debes iniciar sesión para hacer push');
      return;
    }
    
    setIsPushing(true);
    
    try {
      await push(authState.accessToken);
      toast.success('Cambios pusheados exitosamente');
    } catch (error) {
      console.error('[App] Error en push:', error);
      toast.error('Error al hacer push');
    } finally {
      setIsPushing(false);
    }
  }, [authState]);
  
  /**
   * Pullea los cambios del remoto
   */
  const handlePull = useCallback(async () => {
    if (!authState.isAuthenticated || !authState.accessToken) {
      toast.error('Debes iniciar sesión para hacer pull');
      return;
    }
    
    try {
      await pull(authState.accessToken);
      await refreshFileTree();
      toast.success('Cambios actualizados exitosamente');
    } catch (error) {
      console.error('[App] Error en pull:', error);
      toast.error('Error al hacer pull');
    }
  }, [authState, refreshFileTree]);
  
  // -------------------------------------------------------------------------
  // FUNCIONES DE AUTENTICACIÓN
  // -------------------------------------------------------------------------
  
  /**
   * Inicia el login con GitHub
   */
  const handleLogin = useCallback(async () => {
    try {
      await startOAuth();
      // La página se redirige, no hay return
    } catch (error) {
      console.error('[App] Error iniciando login:', error);
      toast.error('Error al iniciar sesión. ¿Configuraste los placeholders de OAuth?');
    }
  }, []);
  
  /**
   * Cierra sesión
   */
  const handleLogout = useCallback(() => {
    logout();
    setAuthState({
      isAuthenticated: false,
      accessToken: null,
      username: null,
      avatarUrl: null,
    });
    toast.info('Sesión cerrada');
  }, []);
  
  // -------------------------------------------------------------------------
  // FUNCIONES DE ARCHIVOS
  // -------------------------------------------------------------------------
  
  /**
   * Crea un nuevo archivo
   */
  const handleCreateFile = useCallback(async () => {
    if (!newFileName.trim()) {
      toast.error('Ingresa un nombre para el archivo');
      return;
    }
    
    try {
      const path = `${WORKSPACE_ROOT}/${newFileName}`;
      await createNewFile(path);
      await refreshFileTree();
      
      setShowNewFileDialog(false);
      setNewFileName('');
      toast.success('Archivo creado');
      
    } catch (error) {
      console.error('[App] Error creando archivo:', error);
      toast.error('Error al crear el archivo');
    }
  }, [newFileName, refreshFileTree]);
  
  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  
  const activeTab = tabs.find((t) => t.id === activeTabId) || null;
  
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
        {/* Logo y título */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <FileCode className="w-6 h-6 text-primary" />
            <span className="font-semibold text-lg hidden sm:inline">Textastic</span>
          </div>
        </div>
        
        {/* Controles del repo */}
        <div className="flex items-center gap-2">
          <Input
            placeholder="https://github.com/usuario/repo.git"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="w-64 hidden md:inline-flex"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleClone}
            disabled={isCloning}
          >
            {isCloning ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            <span className="hidden sm:inline">Clone</span>
          </Button>
          
          <Separator orientation="vertical" className="h-6 mx-2" />
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleCommit}
            disabled={isCommitting || !authState.isAuthenticated}
          >
            <Check className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Commit</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handlePush}
            disabled={isPushing || !authState.isAuthenticated}
          >
            <Upload className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Push</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handlePull}
            disabled={!authState.isAuthenticated}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Pull</span>
          </Button>
        </div>
        
        {/* Auth */}
        <div className="flex items-center gap-2">
          {authState.isAuthenticated ? (
            <div className="flex items-center gap-2">
              {authState.avatarUrl && (
                <img
                  src={authState.avatarUrl}
                  alt={authState.username || ''}
                  className="w-8 h-8 rounded-full"
                />
              )}
              <span className="text-sm hidden md:inline">{authState.username}</span>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={handleLogin}>
              <Github className="w-4 h-4 mr-2" />
              Login
            </Button>
          )}
        </div>
      </header>
      
      {/* Toolbar secundaria */}
      <div className="h-10 border-b border-border flex items-center px-4 gap-2 bg-muted/30">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowNewFileDialog(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          New File
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSave}
          disabled={!activeTab?.isDirty}
        >
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
        
        <Separator orientation="vertical" className="h-5" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </Button>
        
        <div className="flex-1" />
        
        {activeTab?.isDirty && (
          <span className="text-xs text-muted-foreground">
            {activeTab.name} has unsaved changes
          </span>
        )}
      </div>
      
      {/* Layout principal con paneles redimensionables */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File Tree */}
        {showSidebar && (
          <div className="w-64 border-r border-border bg-card flex flex-col">
            <div className="p-3 border-b border-border">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <FolderGit className="w-4 h-4" />
                Explorer
              </h2>
            </div>
            <ScrollArea className="flex-1">
              <FileTree
                nodes={files}
                selectedPath={activeTab?.path}
                onFileSelect={handleFileSelect}
              />
            </ScrollArea>
          </div>
        )}
        
        {/* Editor */}
        <div className="flex-1 flex">
          <div className="flex-1">
            <EditorPane
              tabs={tabs}
              activeTabId={activeTabId}
              onTabChange={handleTabChange}
              onTabClose={handleTabClose}
              onContentChange={handleContentChange}
            />
          </div>
          
          {/* Preview */}
          {showPreview && (
            <div className="w-80 border-l border-border bg-card">
              <PreviewPane activeTab={activeTab} allTabs={tabs} />
            </div>
          )}
        </div>
      </div>
      
      {/* Dialog: Nuevo archivo */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo archivo</DialogTitle>
            <DialogDescription>
              Ingresa la ruta y nombre del archivo
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="filename">Nombre del archivo</Label>
              <Input
                id="filename"
                placeholder="src/components/Nuevo.tsx"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewFileDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateFile}>Crear</Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Toast notifications */}
      <Toaster position="bottom-right" />
    </div>
  );
};

// ============================================================================
// COMPONENTE DE CALLBACK OAuth
// ============================================================================

/**
 * Componente que maneja el callback de OAuth de GitHub
 * Procesa el código de autorización y obtiene el access token
 */
const OAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');
  
  useEffect(() => {
    const processCallback = async () => {
      try {
        console.log('[OAuthCallback] Procesando callback...');
        
        // Manejar el callback - esto intercambia el código por el token
        await handleCallback();
        
        setStatus('success');
        
        // Redirigir a la app principal después de un momento
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
        
      } catch (error) {
        console.error('[OAuthCallback] Error:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Error desconocido');
      }
    };
    
    processCallback();
  }, [navigate]);
  
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-6">
        {status === 'processing' && (
          <>
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Completando login...</h1>
            <p className="text-muted-foreground">
              Estamos procesando tu autenticación con GitHub.
            </p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold mb-2">¡Login exitoso!</h1>
            <p className="text-muted-foreground">
              Serás redirigido a la aplicación...
            </p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-destructive rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-semibold mb-2">Error de autenticación</h1>
            <p className="text-muted-foreground mb-4">{errorMessage}</p>
            <Button onClick={() => navigate('/')}>
              Volver a la aplicación
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// APP CON ROUTING
// ============================================================================

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TextasticApp />} />
        <Route path="/callback" element={<OAuthCallback />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
