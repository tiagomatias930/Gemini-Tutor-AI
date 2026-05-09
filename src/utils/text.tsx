import React from 'react';

export function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\$[^$\n]+\$)/g);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return <code key={i} className="bg-black/5 dark:bg-white/10 text-red-500 px-1.5 py-0.5 rounded text-[0.85em] font-mono">{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    if (part.startsWith('$') && part.endsWith('$') && part.length > 2)
      return <span key={i} className="text-blue-500 font-semibold bg-blue-500/10 px-1 rounded">{part.slice(1, -1)}</span>;
    return <span key={i}>{part}</span>;
  });
}

export function detectLanguage(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(obrigad[oa]|também|então|não|está|você|ainda|trabalho|escola|universidade|faculdade|dúvida|compreend|ficheiro|preciso de)\b/.test(lower)) return 'pt';
  if (/\b(necesito|ayuda|gracias|entiendo|también|nosotros|vosotros|ustedes|trabajo|escuela|universidad)\b/.test(lower)) return 'es';
  if (/\b(bonjour|merci|comment|pourquoi|besoin|comprend|expliquer?|question|je suis|s'il vous|c'est)\b/.test(lower)) return 'fr';
  if (/\b(como|porque|por favor|explicar?|estudar?|ajuda|problema|matemática)\b/.test(lower)) return 'pt';
  if (text.trim().length > 0) return 'en';
  return '';
}
