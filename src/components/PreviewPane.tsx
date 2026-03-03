/**
 * Componente PreviewPane - Vista previa de archivos web
 * 
 * Muestra una vista previa en iframe para archivos HTML/CSS/JS.
 * Para otros tipos de archivos, muestra información del archivo.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, ExternalLink, Code, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EditorTab } from '@/types';

// ============================================================================
// PROPS
// ============================================================================

interface PreviewPaneProps {
  /** Tab activo actualmente */
  activeTab: EditorTab | null;
  /** Todos los tabs abiertos (para encontrar dependencias) */
  allTabs: EditorTab[];
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Verifica si un archivo es HTML
 */
function isHtmlFile(filename: string): boolean {
  return filename.endsWith('.html') || filename.endsWith('.htm');
}

/**
 * Verifica si un archivo es CSS
 */
function isCssFile(filename: string): boolean {
  return filename.endsWith('.css');
}

/**
 * Verifica si un archivo es JavaScript
 */
function isJsFile(filename: string): boolean {
  return filename.endsWith('.js') || filename.endsWith('.mjs') || filename.endsWith('.jsx');
}

/**
 * Verifica si el archivo activo puede tener vista previa
 */
function canPreview(tab: EditorTab | null): boolean {
  if (!tab) return false;
  return isHtmlFile(tab.name) || isCssFile(tab.name) || isJsFile(tab.name);
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

/**
 * Componente PreviewPane - Vista previa de archivos web
 * 
 * Para archivos HTML: renderiza en un iframe
 * Para CSS/JS: muestra el código con opción de ver en contexto
 * Para otros: muestra información del archivo
 */
export const PreviewPane: React.FC<PreviewPaneProps> = ({
  activeTab,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0); // Para forzar recarga del iframe
  
  /**
   * Recarga el iframe
   */
  const handleRefresh = useCallback(() => {
    setKey((k) => k + 1);
  }, []);
  
  /**
   * Abre la vista previa en una nueva pestaña
   */
  const handleOpenExternal = useCallback(() => {
    if (!activeTab) return;
    
    // Crear un blob con el contenido HTML
    const blob = new Blob([activeTab.content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }, [activeTab]);
  
  // Auto-refrescar cuando cambia el contenido del tab activo
  useEffect(() => {
    if (activeTab && isHtmlFile(activeTab.name)) {
      // Pequeño delay para evitar refrescos muy frecuentes mientras se escribe
      const timeout = setTimeout(() => {
        setKey((k) => k + 1);
      }, 500);
      
      return () => clearTimeout(timeout);
    }
  }, [activeTab?.content, activeTab?.name]);
  
  // Si no hay tab activo o no se puede previsualizar
  if (!activeTab || !canPreview(activeTab)) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-muted-foreground">
        <Code className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm font-medium text-center">
          {activeTab
            ? `No hay vista previa disponible para archivos .${activeTab.name.split('.').pop()}`
            : 'Selecciona un archivo HTML, CSS o JS para ver la vista previa'}
        </p>
        {activeTab && (
          <div className="mt-4 p-3 bg-muted rounded-md text-xs font-mono max-w-full overflow-auto">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span>Información del archivo</span>
            </div>
            <div className="space-y-1">
              <p><span className="text-muted-foreground">Nombre:</span> {activeTab.name}</p>
              <p><span className="text-muted-foreground">Ruta:</span> {activeTab.path}</p>
              <p>
                <span className="text-muted-foreground">Tamaño:</span>{' '}
                {new Blob([activeTab.content]).size} bytes
              </p>
              <p>
                <span className="text-muted-foreground">Líneas:</span>{' '}
                {activeTab.content.split('\n').length}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // Vista previa para archivos HTML
  if (isHtmlFile(activeTab.name)) {
    return (
      <div className="flex flex-col h-full">
        {/* Barra de herramientas */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {activeTab.name}
            </span>
            {activeTab.isDirty && (
              <span className="text-xs text-primary">*</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefresh}
              title="Recargar vista previa"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleOpenExternal}
              title="Abrir en nueva pestaña"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Iframe de vista previa */}
        <div className="flex-1 bg-white">
          <iframe
            key={key}
            ref={iframeRef}
            srcDoc={activeTab.content}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title={`Preview: ${activeTab.name}`}
          />
        </div>
      </div>
    );
  }
  
  // Vista para archivos CSS/JS (muestra el código)
  return (
    <div className="flex flex-col h-full">
      {/* Barra de herramientas */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {activeTab.name}
          </span>
          {activeTab.isDirty && (
            <span className="text-xs text-primary">*</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {isCssFile(activeTab.name) ? 'CSS' : 'JavaScript'}
        </span>
      </div>
      
      {/* Vista de código simplificada */}
      <div className="flex-1 overflow-auto p-4">
        <div className="text-xs text-muted-foreground mb-2">
          Este archivo se incluirá automáticamente en la vista previa de archivos HTML.
        </div>
        <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-auto max-h-[300px]">
          <code>{activeTab.content.slice(0, 2000)}</code>
        </pre>
        {activeTab.content.length > 2000 && (
          <div className="text-xs text-muted-foreground mt-2 text-center">
            ... y {activeTab.content.length - 2000} caracteres más
          </div>
        )}
      </div>
    </div>
  );
};

export default PreviewPane;
