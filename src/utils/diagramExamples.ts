/**
 * Common Diagram Examples for AI Reference
 * These are templates the AI can use when auto-drawing
 */

// Example 1: Flowchart (Process Steps)
export const FLOWCHART_EXAMPLE = `
When explaining a process with steps, use this format:
[GT_WHITEBOARD_COMMAND: {"id":"step1","type":"square","x":150,"y":100,"width":300,"height":60,"backgroundColor":"#e8f0fe","color":"#1a73e8","roughness":0,"fillStyle":"solid","content":"1. Understand the Problem","fontSize":14,"fontFamily":2}]
[GT_WHITEBOARD_COMMAND: {"id":"arrow1","type":"arrow","x":300,"y":160,"width":0,"height":30,"color":"#1a73e8","strokeWidth":2}]
[GT_WHITEBOARD_COMMAND: {"id":"step2","type":"square","x":150,"y":200,"width":300,"height":60,"backgroundColor":"#e8f0fe","color":"#1a73e8","roughness":0,"fillStyle":"solid","content":"2. Plan Your Approach","fontSize":14,"fontFamily":2}]
`;

// Example 2: Decision Tree
export const DECISION_TREE_EXAMPLE = `
When explaining conditions or choices, use this format:
[GT_WHITEBOARD_COMMAND: {"id":"decision","type":"circle","x":300,"y":100,"width":100,"height":100,"backgroundColor":"#fbbc05","color":"#1a73e8","roughness":0,"content":"Is it\nvalid?","fontSize":12,"fontFamily":2}]
[GT_WHITEBOARD_COMMAND: {"id":"yes_arrow","type":"arrow","x":250,"y":200,"width":100,"height":0,"color":"#34a853","strokeWidth":2}]
[GT_WHITEBOARD_COMMAND: {"id":"yes_result","type":"square","x":100,"y":320,"width":200,"height":60,"backgroundColor":"#e8f0fe","color":"#34a853","roughness":0,"fillStyle":"solid","content":"Proceed","fontSize":12,"fontFamily":2}]
[GT_WHITEBOARD_COMMAND: {"id":"no_arrow","type":"arrow","x":450,"y":200,"width":100,"height":0,"color":"#ea4335","strokeWidth":2}]
[GT_WHITEBOARD_COMMAND: {"id":"no_result","type":"square","x":400,"y":320,"width":200,"height":60,"backgroundColor":"#e8f0fe","color":"#ea4335","roughness":0,"fillStyle":"solid","content":"Handle Error","fontSize":12,"fontFamily":2}]
`;

// Example 3: System/Component Diagram
export const SYSTEM_DIAGRAM_EXAMPLE = `
When explaining connected components or systems, use this format:
[GT_WHITEBOARD_COMMAND: {"id":"input","type":"square","x":100,"y":150,"width":150,"height":80,"backgroundColor":"#e8f0fe","color":"#1a73e8","roughness":0,"fillStyle":"solid","content":"Input","fontSize":12,"fontFamily":2}]
[GT_WHITEBOARD_COMMAND: {"id":"conn1","type":"arrow","x":250,"y":190,"width":100,"height":0,"color":"#dadce0","strokeWidth":2}]
[GT_WHITEBOARD_COMMAND: {"id":"process","type":"square","x":350,"y":150,"width":150,"height":80,"backgroundColor":"#e8f0fe","color":"#9c27b0","roughness":0,"fillStyle":"solid","content":"Process","fontSize":12,"fontFamily":2}]
[GT_WHITEBOARD_COMMAND: {"id":"conn2","type":"arrow","x":500,"y":190,"width":100,"height":0,"color":"#dadce0","strokeWidth":2}]
[GT_WHITEBOARD_COMMAND: {"id":"output","type":"square","x":600,"y":150,"width":150,"height":80,"backgroundColor":"#e8f0fe","color":"#34a853","roughness":0,"fillStyle":"solid","content":"Output","fontSize":12,"fontFamily":2}]
`;

// Example 4: Cycle Diagram
export const CYCLE_EXAMPLE = `
When explaining iterative or circular processes, draw boxes in a circle:
[GT_WHITEBOARD_COMMAND: {"id":"cycle1","type":"circle","x":340,"y":160,"width":80,"height":80,"backgroundColor":"#e8f0fe","color":"#1a73e8","roughness":0,"content":"1. Plan","fontSize":11,"fontFamily":2}]
[GT_WHITEBOARD_COMMAND: {"id":"arrow1","type":"arrow","x":400,"y":200,"width":70,"height":70,"color":"#1a73e8","strokeWidth":2}]
[GT_WHITEBOARD_COMMAND: {"id":"cycle2","type":"circle","x":470,"y":230,"width":80,"height":80,"backgroundColor":"#e8f0fe","color":"#1a73e8","roughness":0,"content":"2. Do","fontSize":11,"fontFamily":2}]
[GT_WHITEBOARD_COMMAND: {"id":"arrow2","type":"arrow","x":470,"y":310,"width":-70,"height":70,"color":"#1a73e8","strokeWidth":2}]
[GT_WHITEBOARD_COMMAND: {"id":"cycle3","type":"circle","x":340,"y":340,"width":80,"height":80,"backgroundColor":"#e8f0fe","color":"#1a73e8","roughness":0,"content":"3. Review","fontSize":11,"fontFamily":2}]
[GT_WHITEBOARD_COMMAND: {"id":"arrow3","type":"arrow","x":280,"y":280,"width":-70,"height":-70,"color":"#1a73e8","strokeWidth":2}]
`;

// Example 5: Comparison Matrix
export const MATRIX_EXAMPLE = `
When comparing items or properties, create a matrix:
[GT_WHITEBOARD_COMMAND: {"id":"h1","type":"square","x":220,"y":100,"width":120,"height":50,"backgroundColor":"#1a73e8","color":"#ffffff","roughness":0,"content":"Criterion A","fontSize":11,"fontFamily":2}]
[GT_WHITEBOARD_COMMAND: {"id":"h2","type":"square","x":340,"y":100,"width":120,"height":50,"backgroundColor":"#1a73e8","color":"#ffffff","roughness":0,"content":"Criterion B","fontSize":11,"fontFamily":2}]
[GT_WHITEBOARD_COMMAND: {"id":"r1","type":"square","x":100,"y":150,"width":120,"height":50,"backgroundColor":"#9c27b0","color":"#ffffff","roughness":0,"content":"Option 1","fontSize":11,"fontFamily":2}]
[GT_WHITEBOARD_COMMAND: {"id":"c1","type":"square","x":220,"y":150,"width":120,"height":50,"backgroundColor":"#e8f0fe","color":"#1a73e8","roughness":0,"content":"Value A1","fontSize":11,"fontFamily":2}]
[GT_WHITEBOARD_COMMAND: {"id":"c2","type":"square","x":340,"y":150,"width":120,"height":50,"backgroundColor":"#e8f0fe","color":"#1a73e8","roughness":0,"content":"Value B1","fontSize":11,"fontFamily":2}]
`;

/**
 * Instruction snippet for system prompt
 */
export const DIAGRAM_INSTRUCTIONS = `
## DIAGRAM GENERATION EXAMPLES

Use these examples as templates when auto-drawing educational diagrams:

### Flowchart (for processes, steps)
${FLOWCHART_EXAMPLE}

### Decision Tree (for conditions, logic)
${DECISION_TREE_EXAMPLE}

### System/Component Diagram (for relationships)
${SYSTEM_DIAGRAM_EXAMPLE}

### Cycle/Loop Diagram (for iterative concepts)
${CYCLE_EXAMPLE}

### Comparison Matrix (for comparing items)
${MATRIX_EXAMPLE}

**Important Notes:**
- Use consistent styling: roughness=0 for professional look, fontFamily=2 for clean fonts
- Use the color palette: #1a73e8 (primary), #34a853 (success), #ea4335 (danger), #fbbc05 (warning), #9c27b0 (secondary)
- Always provide meaningful content/labels in each shape
- Position elements with proper spacing and alignment
- Include multiple diagrams in sequence for complex explanations
`;
