/**
 * Practical Drawing Hook
 * Monitors AI responses and suggests drawing when explaining practical concepts
 */

import { useRef, useCallback } from 'react';
import { shouldAutoDrawForTopic } from './drawingGenerator';

export interface DrawingHint {
  shouldDraw: boolean;
  type: 'flowchart' | 'decision' | 'system' | 'cycle' | 'hierarchy' | 'matrix' | null;
  suggestion: string;
}

/**
 * Custom hook to detect when AI should draw
 * Returns hints about whether content should be visualized
 */
export function usePracticalDrawingDetection() {
  const lastAnalyzedRef = useRef<string>('');

  const analyzeContent = useCallback((text: string): DrawingHint => {
    // Avoid re-analyzing the same text
    if (text === lastAnalyzedRef.current) {
      return { shouldDraw: false, type: null, suggestion: '' };
    }
    lastAnalyzedRef.current = text;

    const { should, type } = shouldAutoDrawForTopic(text);

    let suggestion = '';
    switch (type) {
      case 'flowchart':
        suggestion = '💡 The AI explained a process. A flowchart would help visualize the steps.';
        break;
      case 'decision':
        suggestion = '💡 Logic and conditions detected. A decision tree diagram would clarify the options.';
        break;
      case 'system':
        suggestion = '💡 System components explained. A component diagram would show relationships.';
        break;
      case 'cycle':
        suggestion = '💡 Cyclical process detected. A cycle diagram would illustrate the flow.';
        break;
      case 'hierarchy':
        suggestion = '💡 Classification explained. A hierarchy diagram would organize the concepts.';
        break;
      case 'matrix':
        suggestion = '💡 Comparison shown. A matrix diagram would highlight the differences.';
        break;
    }

    return { shouldDraw: should, type, suggestion };
  }, []);

  /**
   * Check if text contains actual drawings already
   */
  const hasDrawings = useCallback((text: string): boolean => {
    return text.includes('[GT_WHITEBOARD_COMMAND:');
  }, []);

  /**
   * Extract only drawings from text
   */
  const extractDrawings = useCallback((text: string): string[] => {
    const matches = text.match(/\[GT_WHITEBOARD_COMMAND:[^\]]*\]/g) || [];
    return matches;
  }, []);

  return {
    analyzeContent,
    hasDrawings,
    extractDrawings,
  };
}

/**
 * Suggestions for common practical topics
 * Maps keywords to diagram types that would help explain them
 */
export const PRACTICAL_TOPIC_MAPPING: Record<string, 'flowchart' | 'decision' | 'system' | 'cycle' | 'hierarchy' | 'matrix'> = {
  // Flowchart triggers
  'algoritmo': 'flowchart',
  'passo a passo': 'flowchart',
  'como funciona': 'flowchart',
  'procedimento': 'flowchart',
  'sequência': 'flowchart',
  'etapas': 'flowchart',
  'workflow': 'flowchart',
  'process': 'flowchart',

  // Decision tree triggers
  'se': 'decision',
  'então': 'decision',
  'condição': 'decision',
  'opção': 'decision',
  'escolher': 'decision',
  'alternativa': 'decision',
  'if': 'decision',
  'else': 'decision',

  // System diagram triggers
  'sistema': 'system',
  'componente': 'system',
  'parte': 'system',
  'relacionamento': 'system',
  'arquitetura': 'system',
  'estrutura': 'system',
  'integração': 'system',

  // Cycle triggers
  'ciclo': 'cycle',
  'repetição': 'cycle',
  'iteração': 'cycle',
  'feedback': 'cycle',
  'loop': 'cycle',
  'circular': 'cycle',
  'volta': 'cycle',

  // Hierarchy triggers
  'hierarquia': 'hierarchy',
  'classificação': 'hierarchy',
  'categorias': 'hierarchy',
  'níveis': 'hierarchy',
  'tipo': 'hierarchy',
  'ordem': 'hierarchy',

  // Matrix triggers
  'comparação': 'matrix',
  'tabela': 'matrix',
  'diferença': 'matrix',
  'vs': 'matrix',
  'versus': 'matrix',
  'propriedade': 'matrix',
  'característica': 'matrix',
};

/**
 * Format a hint message for the UI
 */
export function formatDrawingHint(hint: DrawingHint): string {
  if (!hint.shouldDraw) return '';
  return hint.suggestion;
}
