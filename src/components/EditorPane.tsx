/**
 * Componente EditorPane - Editor Monaco con multi-tabs
 * 
 * Integra Monaco Editor con soporte para:
 * - Múltiples tabs (cada archivo en su propio tab)
 * - Syntax highlighting automático según extensión
 * - Tema dark por defecto
 * - Indicadores de cambios sin guardar (*)
 * - Layout automático
 */

import React, { useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { X, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EditorPaneProps, EditorTab } from '@/types';

// ============================================================================
// COMPONENTE INDIVIDUAL DE TAB
// ============================================================================

interface TabProps {
  tab: EditorTab;
  isActive: boolean;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}

/**
 * Componente individual para cada tab
 * Muestra el nombre del archivo y un indicador si tiene cambios sin guardar
 */
const Tab: React.FC<TabProps> = ({ tab, isActive, onClick, onClose }) => {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 px-3 py-2 text-sm cursor-pointer',
        'border-r border-border transition-colors min-w-[120px] max-w-[200px]',
        isActive
          ? 'bg-background text-foreground border-t-2 border-t-primary'
          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
      onClick={onClick}
    >
      {/* Icono de archivo */}
      <FileCode className="w-4 h-4 flex-shrink-0" />
      
      {/* Nombre del archivo con indicador de cambios */}
      <span className="truncate flex-1">
        {tab.name}
        {tab.isDirty && (
          <span className="ml-1 text-primary">*</span>
        )}
      </span>
      
      {/* Botón de cerrar */}
      <button
        onClick={onClose}
        className={cn(
          'p-0.5 rounded opacity-0 group-hover:opacity-100',
          'hover:bg-accent hover:text-accent-foreground transition-all',
          tab.isDirty && 'opacity-100' // Siempre visible si hay cambios
        )}
        title="Cerrar tab"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL EDITOR PANE
// ============================================================================

/**
 * Componente EditorPane - Editor con múltiples tabs
 * 
 * @example
 * <EditorPane
 *   tabs={tabs}
 *   activeTabId="tab-1"
 *   onTabChange={(id) => setActiveTab(id)}
 *   onTabClose={(id) => closeTab(id)}
 *   onContentChange={(id, content) => updateContent(id, content)}
 * />
 */
export const EditorPane: React.FC<EditorPaneProps> = ({
  tabs,
  activeTabId,
  onTabChange,
  onTabClose,
  onContentChange,
}) => {
  // Encontrar el tab activo
  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId]
  );
  
  /**
   * Maneja cambios en el editor
   */
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (activeTabId && value !== undefined) {
        onContentChange(activeTabId, value);
      }
    },
    [activeTabId, onContentChange]
  );
  
  /**
   * Maneja el cierre de un tab
   */
  const handleCloseTab = useCallback(
    (tabId: string) => (e: React.MouseEvent) => {
      e.stopPropagation();
      onTabClose(tabId);
    },
    [onTabClose]
  );
  
  // Opciones de configuración de Monaco
  const editorOptions = useMemo(
    () => ({
      minimap: { enabled: false }, // Desactivar minimap como se solicitó
      automaticLayout: true, // Layout automático
      fontSize: 14,
      lineNumbers: 'on' as const,
      roundedSelection: false,
      scrollBeyondLastLine: false,
      readOnly: false,
      domReadOnly: false,
      renderLineHighlight: 'all' as const,
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on' as const,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'on' as const,
    }),
    []
  );
  
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Barra de tabs */}
      {tabs.length > 0 && (
        <div className="flex items-center border-b border-border overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onClick={() => onTabChange(tab.id)}
              onClose={handleCloseTab(tab.id)}
            />
          ))}
        </div>
      )}
      
      {/* Área del editor */}
      <div className="flex-1 relative">
        {activeTab ? (
          <Editor
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            theme="vs-dark"
            options={editorOptions}
            onChange={handleEditorChange}
            loading={
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="animate-pulse">Cargando editor...</div>
              </div>
            }
          />
        ) : (
          // Estado vacío cuando no hay tabs abiertos
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <FileCode className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">No hay archivos abiertos</p>
            <p className="text-sm mt-1">
              Selecciona un archivo del árbol para comenzar a editar
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditorPane;
