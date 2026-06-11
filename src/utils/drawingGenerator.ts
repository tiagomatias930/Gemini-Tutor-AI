/**
 * Drawing Generator - Creates Excalidraw diagram commands for common educational patterns
 * Used by AI to automatically generate visual explanations
 */

export interface WhiteboardCommand {
  id: string;
  type: 'text' | 'circle' | 'square' | 'arrow' | 'line';
  x: number;
  y: number;
  content?: string;
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  roughness?: number;
  backgroundColor?: string;
  fillStyle?: 'solid' | 'hachure' | 'cross-hatch';
  opacity?: number;
  fontFamily?: number;
  fontSize?: number;
}

// Color palette - professional corporate style
const COLORS = {
  primary: '#1a73e8',      // Blue - primary concepts
  success: '#34a853',      // Green - correct/stable
  danger: '#ea4335',       // Red - critical/attention
  warning: '#fbbc05',      // Yellow - warnings
  secondary: '#9c27b0',    // Purple - secondary structures
  light: '#e8f0fe',        // Light blue background
  text: '#202124',         // Dark text
  border: '#dadce0',       // Light border
};

// Unique ID generator
let idCounter = 0;
function generateId(prefix: string): string {
  return `${prefix}_${++idCounter}`;
}

/**
 * Generate a simple flowchart with numbered steps
 * Example: process explanation, algorithm steps
 */
export function generateFlowchart(steps: string[], title?: string): WhiteboardCommand[] {
  const commands: WhiteboardCommand[] = [];
  let yPos = 100;
  
  // Add title if provided
  if (title) {
    commands.push({
      id: generateId('title'),
      type: 'text',
      x: 150,
      y: 50,
      content: title,
      fontSize: 24,
      fontFamily: 2,
      color: COLORS.text,
    });
    yPos = 120;
  }

  // Add each step as a box with arrow
  steps.forEach((step, index) => {
    const stepId = generateId(`step_${index}`);
    
    // Step box
    commands.push({
      id: stepId,
      type: 'square',
      x: 150,
      y: yPos,
      width: 300,
      height: 60,
      backgroundColor: COLORS.light,
      color: COLORS.primary,
      roughness: 0,
      fillStyle: 'solid',
      content: `${index + 1}. ${step}`,
      fontSize: 14,
      fontFamily: 2,
    });

    // Arrow to next step (except for last)
    if (index < steps.length - 1) {
      commands.push({
        id: generateId(`arrow_${index}`),
        type: 'arrow',
        x: 300,
        y: yPos + 60,
        width: 0,
        height: 30,
        color: COLORS.primary,
        strokeWidth: 2,
      });
    }

    yPos += 100;
  });

  return commands;
}

/**
 * Generate a decision tree / conditional diagram
 * Example: if-then-else explanations, problem-solving trees
 */
export function generateDecisionTree(
  question: string,
  yesPath: string,
  noPath: string,
  yesResult: string,
  noResult: string
): WhiteboardCommand[] {
  const commands: WhiteboardCommand[] = [];

  // Main decision box
  commands.push({
    id: generateId('decision'),
    type: 'circle',
    x: 300,
    y: 100,
    width: 100,
    height: 100,
    backgroundColor: COLORS.warning,
    color: COLORS.primary,
    roughness: 0,
    content: question,
    fontSize: 12,
    fontFamily: 2,
  });

  // YES branch (left)
  commands.push({
    id: generateId('yes_arrow'),
    type: 'arrow',
    x: 250,
    y: 200,
    width: 100,
    height: 0,
    color: COLORS.success,
    strokeWidth: 2,
  });
  commands.push({
    id: generateId('yes_label'),
    type: 'text',
    x: 200,
    y: 210,
    content: 'YES',
    fontSize: 12,
    fontFamily: 2,
    color: COLORS.success,
  });
  commands.push({
    id: generateId('yes_result'),
    type: 'square',
    x: 100,
    y: 320,
    width: 200,
    height: 60,
    backgroundColor: COLORS.light,
    color: COLORS.success,
    content: yesResult,
    fontSize: 12,
    fontFamily: 2,
  });

  // NO branch (right)
  commands.push({
    id: generateId('no_arrow'),
    type: 'arrow',
    x: 450,
    y: 200,
    width: 100,
    height: 0,
    color: COLORS.danger,
    strokeWidth: 2,
  });
  commands.push({
    id: generateId('no_label'),
    type: 'text',
    x: 480,
    y: 210,
    content: 'NO',
    fontSize: 12,
    fontFamily: 2,
    color: COLORS.danger,
  });
  commands.push({
    id: generateId('no_result'),
    type: 'square',
    x: 400,
    y: 320,
    width: 200,
    height: 60,
    backgroundColor: COLORS.light,
    color: COLORS.danger,
    content: noResult,
    fontSize: 12,
    fontFamily: 2,
  });

  return commands;
}

/**
 * Generate a system/component diagram
 * Example: architecture, relationships between concepts
 */
export function generateSystemDiagram(
  components: Array<{ name: string; color?: string; description?: string }>
): WhiteboardCommand[] {
  const commands: WhiteboardCommand[] = [];
  const componentWidth = 150;
  const componentHeight = 80;
  const spacing = 200;

  components.forEach((comp, index) => {
    const xPos = 100 + index * spacing;
    const yPos = 150;

    // Component box
    commands.push({
      id: generateId(`comp_${index}`),
      type: 'square',
      x: xPos,
      y: yPos,
      width: componentWidth,
      height: componentHeight,
      backgroundColor: comp.color || COLORS.light,
      color: comp.color || COLORS.primary,
      roughness: 0,
      fillStyle: 'solid',
      content: comp.name,
      fontSize: 13,
      fontFamily: 2,
    });

    // Connection arrow to next component (except last)
    if (index < components.length - 1) {
      commands.push({
        id: generateId(`connection_${index}`),
        type: 'arrow',
        x: xPos + componentWidth,
        y: yPos + componentHeight / 2,
        width: spacing - componentWidth,
        height: 0,
        color: COLORS.border,
        strokeWidth: 2,
        strokeStyle: 'solid',
      });
    }
  });

  return commands;
}

/**
 * Generate a matrix/table diagram
 * Example: comparison tables, property matrices
 */
export function generateMatrix(
  rows: string[],
  cols: string[],
  data: string[][]
): WhiteboardCommand[] {
  const commands: WhiteboardCommand[] = [];
  const cellWidth = 120;
  const cellHeight = 50;
  const startX = 100;
  const startY = 100;

  // Header row
  cols.forEach((col, colIdx) => {
    commands.push({
      id: generateId(`header_${colIdx}`),
      type: 'square',
      x: startX + (colIdx + 1) * cellWidth,
      y: startY,
      width: cellWidth,
      height: cellHeight,
      backgroundColor: COLORS.primary,
      color: '#ffffff',
      content: col,
      fontSize: 11,
      fontFamily: 2,
      roughness: 0,
    });
  });

  // Row labels and data
  rows.forEach((row, rowIdx) => {
    // Row label
    commands.push({
      id: generateId(`row_${rowIdx}`),
      type: 'square',
      x: startX,
      y: startY + (rowIdx + 1) * cellHeight,
      width: cellWidth,
      height: cellHeight,
      backgroundColor: COLORS.secondary,
      color: '#ffffff',
      content: row,
      fontSize: 11,
      fontFamily: 2,
      roughness: 0,
    });

    // Data cells
    data[rowIdx]?.forEach((cellData, colIdx) => {
      commands.push({
        id: generateId(`cell_${rowIdx}_${colIdx}`),
        type: 'square',
        x: startX + (colIdx + 1) * cellWidth,
        y: startY + (rowIdx + 1) * cellHeight,
        width: cellWidth,
        height: cellHeight,
        backgroundColor: COLORS.light,
        color: COLORS.primary,
        content: cellData,
        fontSize: 10,
        fontFamily: 2,
        roughness: 0,
      });
    });
  });

  return commands;
}

/**
 * Generate a cycle/circular relationship diagram
 * Example: feedback loops, iterative processes, cycles
 */
export function generateCycleDiagram(steps: string[]): WhiteboardCommand[] {
  const commands: WhiteboardCommand[] = [];
  const centerX = 400;
  const centerY = 300;
  const radius = 150;
  const angleStep = (2 * Math.PI) / steps.length;

  steps.forEach((step, index) => {
    const angle = index * angleStep - Math.PI / 2; // Start from top
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);

    // Step circle
    commands.push({
      id: generateId(`cycle_${index}`),
      type: 'circle',
      x: x - 40,
      y: y - 40,
      width: 80,
      height: 80,
      backgroundColor: COLORS.light,
      color: COLORS.primary,
      roughness: 0,
      content: `${index + 1}\n${step}`,
      fontSize: 11,
      fontFamily: 2,
    });

    // Arrow to next step
    const nextAngle = ((index + 1) % steps.length) * angleStep - Math.PI / 2;
    const nextX = centerX + radius * Math.cos(nextAngle);
    const nextY = centerY + radius * Math.sin(nextAngle);

    commands.push({
      id: generateId(`cycle_arrow_${index}`),
      type: 'arrow',
      x: x + 20 + (nextX - x - 40) * 0.3,
      y: y + (nextY - y) * 0.3,
      width: (nextX - x) * 0.4,
      height: (nextY - y) * 0.4,
      color: COLORS.primary,
      strokeWidth: 2,
    });
  });

  return commands;
}

/**
 * Generate a hierarchy/tree diagram
 * Example: classification, organization structures
 */
export function generateHierarchyDiagram(
  root: string,
  children: Array<{ name: string; subChildren?: string[] }>
): WhiteboardCommand[] {
  const commands: WhiteboardCommand[] = [];

  // Root node
  commands.push({
    id: generateId('root'),
    type: 'square',
    x: 300,
    y: 50,
    width: 200,
    height: 60,
    backgroundColor: COLORS.primary,
    color: '#ffffff',
    content: root,
    fontSize: 14,
    fontFamily: 2,
    roughness: 0,
  });

  // Children
  const childSpacing = 300 / Math.max(children.length, 1);
  children.forEach((child, idx) => {
    const xPos = 100 + idx * childSpacing;
    const yPos = 200;

    // Connection from root
    commands.push({
      id: generateId(`root_arrow_${idx}`),
      type: 'line',
      x: 400,
      y: 110,
      width: xPos - 100,
      height: yPos - 110,
      color: COLORS.border,
      strokeWidth: 1,
    });

    // Child box
    commands.push({
      id: generateId(`child_${idx}`),
      type: 'square',
      x: xPos,
      y: yPos,
      width: 160,
      height: 60,
      backgroundColor: COLORS.light,
      color: COLORS.secondary,
      content: child.name,
      fontSize: 12,
      fontFamily: 2,
      roughness: 0,
    });
  });

  return commands;
}

/**
 * Format commands as inline text for AI response
 */
export function formatCommandsForAI(commands: WhiteboardCommand[]): string {
  return commands
    .map(cmd => `[GT_WHITEBOARD_COMMAND: ${JSON.stringify(cmd)}]`)
    .join('\n');
}

/**
 * Detect if a topic should trigger auto-drawing based on keywords
 */
export function shouldAutoDrawForTopic(text: string): {
  should: boolean;
  type: 'flowchart' | 'decision' | 'system' | 'cycle' | 'hierarchy' | 'matrix' | null;
} {
  const lowerText = text.toLowerCase();

  // Flowchart triggers: processes, steps, how-to
  if (/(processo|passos?|como|fluxo|etapa|passo|sequência|steps?|process|workflow|procedure)/i.test(lowerText)) {
    return { should: true, type: 'flowchart' };
  }

  // Decision tree triggers: conditions, if-then
  if (/(decisão|condição|se\.\.\.então|alternativa|opção|escolha|decision|condition|if|choose)/i.test(lowerText)) {
    return { should: true, type: 'decision' };
  }

  // System/architecture triggers
  if (/(sistema|arquitetura|componente|estrutura|relacionamento|sistema|architecture|component|structure)/i.test(lowerText)) {
    return { should: true, type: 'system' };
  }

  // Cycle triggers: loops, iteration, feedback
  if (/(ciclo|repetição|iteração|feedback|loop|circular|cycle|iterate|feedback)/i.test(lowerText)) {
    return { should: true, type: 'cycle' };
  }

  // Hierarchy triggers: classification, levels
  if (/(hierarqu|classificação|níveis?|estrutura|hierarchy|classification|level|tree)/i.test(lowerText)) {
    return { should: true, type: 'hierarchy' };
  }

  // Matrix/comparison triggers
  if (/(comparação|tabela|matriz|diferença|vs|comparison|table|matrix|versus)/i.test(lowerText)) {
    return { should: true, type: 'matrix' };
  }

  return { should: false, type: null };
}
