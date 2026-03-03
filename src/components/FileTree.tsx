/**
 * Componente FileTree - Árbol de archivos recursivo
 * 
 * Muestra la estructura de archivos del workspace de forma jerárquica.
 * Permite expandir/colapsar carpetas y seleccionar archivos.
 */

import React, { useState, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileNode, FileTreeProps } from '@/types';

// ============================================================================
// COMPONENTE INDIVIDUAL DE NODO
// ============================================================================

interface FileTreeNodeProps {
  node: FileNode;
  level: number;
  selectedPath?: string;
  onFileSelect: (node: FileNode) => void;
}

/**
 * Componente individual para cada nodo del árbol
 * Maneja su propio estado de expansión si es directorio
 */
const FileTreeNode: React.FC<FileTreeNodeProps> = ({
  node,
  level,
  selectedPath,
  onFileSelect,
}) => {
  // Estado local para expandir/colapsar carpetas
  const [isExpanded, setIsExpanded] = useState(level < 2); // Expandir primeros niveles
  
  // Verificar si este nodo está seleccionado
  const isSelected = selectedPath === node.path;
  
  // Calcular padding basado en el nivel de indentación
  const paddingLeft = level * 12 + 8;
  
  /**
   * Maneja el click en el nodo
   * - Si es archivo: lo selecciona
   * - Si es carpeta: expande/colapsa
   */
  const handleClick = useCallback(() => {
    if (node.type === 'file') {
      onFileSelect(node);
    } else {
      setIsExpanded((prev) => !prev);
    }
  }, [node, onFileSelect]);
  
  /**
   * Maneja el click en el chevron (solo para carpetas)
   * Evita que se propague al click del nodo
   */
  const handleChevronClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded((prev) => !prev);
  }, []);
  
  return (
    <div className="select-none">
      {/* Fila del nodo */}
      <div
        className={cn(
          'flex items-center gap-1 py-1 pr-2 cursor-pointer text-sm transition-colors',
          'hover:bg-accent/50',
          isSelected && 'bg-accent text-accent-foreground'
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
        title={node.path}
      >
        {/* Icono de expandir/colapsar (solo carpetas) */}
        {node.type === 'directory' ? (
          <button
            onClick={handleChevronClick}
            className="p-0.5 rounded hover:bg-accent/80 transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" /> // Espaciado para alinear con carpetas
        )}
        
        {/* Icono de archivo o carpeta */}
        {node.type === 'directory' ? (
          isExpanded ? (
            <FolderOpen className="w-4 h-4 text-blue-500" />
          ) : (
            <Folder className="w-4 h-4 text-blue-500" />
          )
        ) : (
          <File className="w-4 h-4 text-muted-foreground" />
        )}
        
        {/* Nombre del archivo/carpeta */}
        <span
          className={cn(
            'truncate',
            node.type === 'directory' && 'font-medium'
          )}
        >
          {node.name}
        </span>
      </div>
      
      {/* Renderizar hijos recursivamente si es carpeta y está expandida */}
      {node.type === 'directory' && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onFileSelect={onFileSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENTE PRINCIPAL FILE TREE
// ============================================================================

/**
 * Componente FileTree - Árbol de archivos completo
 * 
 * @example
 * <FileTree
 *   nodes={fileNodes}
 *   selectedPath="/workspace/src/App.tsx"
 *   onFileSelect={(node) => console.log('Seleccionado:', node.name)}
 * />
 */
export const FileTree: React.FC<FileTreeProps> = ({
  nodes,
  selectedPath,
  onFileSelect,
}) => {
  // Si no hay nodos, mostrar mensaje vacío
  if (nodes.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        <Folder className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No hay archivos</p>
        <p className="text-xs mt-1">Clona un repositorio para empezar</p>
      </div>
    );
  }
  
  return (
    <div className="py-2">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          level={0}
          selectedPath={selectedPath}
          onFileSelect={onFileSelect}
        />
      ))}
    </div>
  );
};

export default FileTree;
