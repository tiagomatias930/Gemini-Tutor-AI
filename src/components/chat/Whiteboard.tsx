import React, { useEffect, useState, memo } from 'react';
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { useTheme } from '../../contexts/ThemeContext';

export interface WhiteboardElement {
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
  roughness?: number; // 0 = clean/professional, 1 = sketchy
  backgroundColor?: string;
  fillStyle?: 'solid' | 'hachure' | 'cross-hatch';
  opacity?: number;
  fontFamily?: number; // 1 = Virgil (sketch), 2 = Helvetica (clean/professional), 3 = Monospace
  fontSize?: number;
}

interface WhiteboardProps {
  elements: WhiteboardElement[];
  isDark: boolean;
}

export const Whiteboard: React.FC<WhiteboardProps> = memo(({ elements, isDark }) => {
  const { c } = useTheme();
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  useEffect(() => {
    if (!excalidrawAPI) return;

    if (elements.length === 0) {
      excalidrawAPI.updateScene({ elements: [] });
      return;
    }

    const exElements = elements.map((el) => {
      let color = el.color || (isDark ? '#8ab4f8' : '#1a73e8');
      if (color === '#hex' || !/^#(?:[0-9a-fA-F]{3}){1,2}$/.test(color)) {
        color = isDark ? '#8ab4f8' : '#1a73e8';
      }
      
      // Default to transparent background unless a solid fill is requested
      let bgColor = el.backgroundColor || "transparent";
      if (bgColor === "transparent" && el.fillStyle === "solid") {
        bgColor = color;
      }

      const common = {
        id: String(el.id),
        x: Number(el.x) || 100,
        y: Number(el.y) || 100,
        angle: 0,
        strokeColor: color,
        backgroundColor: bgColor,
        fillStyle: (el.fillStyle || "solid") as any, // solid is more professional than hachure by default
        strokeWidth: el.strokeWidth !== undefined ? Number(el.strokeWidth) : 2,
        strokeStyle: (el.strokeStyle || "solid") as any,
        roughness: el.roughness !== undefined ? Number(el.roughness) : 0, // Default to 0 (perfect straight professional lines)
        opacity: el.opacity !== undefined ? Number(el.opacity) : 100,
        seed: Math.floor(Math.random() * 100000),
        version: Date.now(),
        versionNonce: Date.now(),
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
      };

      switch (el.type) {
        case 'circle':
          return {
            ...common,
            type: "ellipse",
            width: Number(el.width) || 100,
            height: Number(el.width) || 100,
          };
        case 'square':
          return {
            ...common,
            type: "rectangle",
            width: Number(el.width) || 100,
            height: Number(el.height) || 100,
          };
        case 'text': {
          const fontSize = el.fontSize || 16;
          const textVal = el.content || "";
          return {
            ...common,
            type: "text",
            text: textVal,
            fontSize,
            fontFamily: el.fontFamily !== undefined ? Number(el.fontFamily) : 2, // 2 is Helvetica/Arial (clean/professional)
            textAlign: "center" as const,
            verticalAlign: "middle" as const,
            baseline: 15,
            width: Math.max(textVal.length * fontSize * 0.6, 60),
            height: fontSize * 1.4,
          };
        }
        case 'arrow':
          return {
            ...common,
            type: "arrow",
            width: Number(el.width) || 100,
            height: Number(el.height) || 100,
            points: [[0, 0], [Number(el.width) || 100, Number(el.height) || 100]],
            startArrowhead: null,
            endArrowhead: "arrow",
          };
        case 'line':
          return {
            ...common,
            type: "line",
            width: Number(el.width) || 100,
            height: Number(el.height) || 100,
            points: [[0, 0], [Number(el.width) || 100, Number(el.height) || 100]],
          };
        default:
          return null;
      }
    }).filter(Boolean);

    excalidrawAPI.updateScene({
      elements: exElements,
      appState: {
        theme: isDark ? "dark" : "light",
      }
    });
  }, [elements, excalidrawAPI, isDark]);

  return (
    <div 
      className="w-full h-full bg-white dark:bg-[#121212] rounded-3xl overflow-hidden border shadow-inner relative" 
      style={{ borderColor: c.border }}
    >
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 bg-black/5 dark:bg-white/5 rounded-full backdrop-blur-sm border" style={{ borderColor: c.border }}>
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Excalidraw Whiteboard</span>
      </div>

      <div className="w-full h-full">
        <Excalidraw
          theme={isDark ? "dark" : "light"}
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              saveToActiveFile: false,
              toggleTheme: false,
              export: false,
            }
          }}
        />
      </div>
    </div>
  );
});

Whiteboard.displayName = 'Whiteboard';
