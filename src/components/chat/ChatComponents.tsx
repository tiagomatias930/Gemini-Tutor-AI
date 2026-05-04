import React, { useState } from 'react';
import { Palette, ZoomIn, X } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function MarkdownContent({ text, isUser, renderInline }: { text: string; isUser: boolean, renderInline: (t: string) => React.ReactNode[] }) {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      nodes.push(<pre key={`cb-${i}`} className="bg-[#1e1e2e] text-[#cdd6f4] rounded-xl p-4 my-2 overflow-x-auto text-xs font-mono leading-relaxed border border-[#313244]"><code>{codeLines.join('\n')}</code></pre>);
      i++; continue;
    }
    if (line.startsWith('### ')) { nodes.push(<h3 key={i} className="text-sm font-semibold mt-3 mb-1">{renderInline(line.slice(4))}</h3>); i++; continue; }
    if (line.startsWith('## ')) { nodes.push(<h2 key={i} className="text-base font-bold mt-3 mb-1">{renderInline(line.slice(3))}</h2>); i++; continue; }
    if (line.startsWith('# ')) { nodes.push(<h1 key={i} className="text-lg font-bold mt-4 mb-2">{renderInline(line.slice(2))}</h1>); i++; continue; }
    if (line.match(/^[-*•]\s/)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*•]\s/)) {
        items.push(<li key={i} className="flex gap-2"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-50 shrink-0" /><span>{renderInline(lines[i].replace(/^[-*•]\s/, ''))}</span></li>);
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className="space-y-1 my-2">{items}</ul>); continue;
    }
    if (line.trim() === '') { if (nodes.length > 0) nodes.push(<div key={`sp-${i}`} className="h-1.5" />); i++; continue; }
    nodes.push(<p key={i} className={`leading-relaxed`}>{renderInline(line)}</p>);
    i++;
  }
  return <div className="space-y-px">{nodes}</div>;
}

export function GeneratedImageCard({
  imageBase64, mimeType, caption,
  onRegenerate, isRegenerating,
}: {
  imageBase64: string; mimeType: string; caption?: string;
  onRegenerate?: () => void; isRegenerating?: boolean;
}) {
  const [lightbox, setLightbox] = useState(false);
  const { c } = useTheme();
  const src = `data:${mimeType};base64,${imageBase64}`;

  return (
    <>
      <div className="mt-3 rounded-xl overflow-hidden border bg-black/5 dark:bg-white/5" style={{ borderColor: c.border }}>
        <div className="relative group cursor-zoom-in" onClick={() => setLightbox(true)}>
          <img src={src} alt="AI-generated illustration" className="w-full object-contain max-h-72" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <ZoomIn size={20} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
          </div>
        </div>
        <div className="px-3 py-2 flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <Palette size={11} className="text-purple-500" />
              <span className="text-[10px] font-bold text-purple-500 uppercase tracking-tight">AI Illustration</span>
            </div>
            {caption && <p className="text-[11px] leading-relaxed opacity-70">{caption}</p>}
          </div>
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightbox(false)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white bg-white/10 p-2 rounded-full" onClick={() => setLightbox(false)}>
            <X size={24} />
          </button>
          <img src={src} alt="AI-generated illustration" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

export function ImageGeneratingSkeleton() {
  const { c } = useTheme();
  return (
    <div className="mt-3 rounded-xl border overflow-hidden bg-black/5 dark:bg-white/5" style={{ borderColor: c.border }}>
      <div className="h-40 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 animate-pulse" />
      <div className="px-3 py-2 flex items-center gap-2">
        <Palette size={11} className="text-purple-400" />
        <span className="text-[10px] text-gray-400">Gemini is creating an illustration...</span>
      </div>
    </div>
  );
}
