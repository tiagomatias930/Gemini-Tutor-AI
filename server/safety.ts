/**
 * Ngola Tutor — Safety & LLM Validation Module
 *
 * Implements four layers of validation requested by the user:
 *   1. Alignment (Persona & Socratic Method alignment)
 *   2. Prompt Robustness (Jailbreak / System leakage / Injection defense)
 *   3. Policy Compliance (Strict safety settings & custom policy filters)
 *   4. Behavioral Safety of LLMs (Academic boundaries, therapy/finance redirection)
 */

import { HarmCategory, HarmBlockThreshold } from '@google/genai';

// ─── 1. POLICY COMPLIANCE: Strict Gemini Safety Settings ────────────────────

export const strictSafetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
  },
];

// ─── 2. PROMPT ROBUSTNESS: Jailbreak & Injection Defense ────────────────────

const JAILBREAK_PATTERNS = [
  /ignore (previous|all|instructions)/i,
  /you are now (offline|freed|jailbroken)/i,
  /\bdan mode\b/i,
  /\bmodo dan\b/i,
  /\bdan\b/i,
  /system (prompt|instruction|rules)/i,
  /reveal your (instructions|rules|prompt)/i,
  /desconsidere as (instruções|regras) anteriores/i,
  /desconsidere/i,
  /revel[ae].*prompt/i,
  /como você foi programado/i,
  /esqueça (tudo|as regras|as instruções)/i,
];

// ─── 3. BEHAVIORAL SAFETY: Non-academic Boundaries ────────────────────────

const THERAPY_MENTAL_HEALTH = [
  /\b(suicid|quero morrer|me cortar|auto flagela|auto-mutila|depressão profunda|me matar)\b/i,
  /\b(suicide|kill myself|want to die|cutting myself|self harm)\b/i
];

const ILLEGAL_WEAPONS_HACKING = [
  /como (fazer|criar).*(bomba|explosivo|droga|arma|metanfetamina|cocaína|crack)/i,
  /how to (make|create).*(bomb|explosive|meth|cocaine|gun|weapon)/i,
  /\b(hackear|invadir|fraudar|roubar senhas|carding|phishing)\b/i,
  /\b(hack into|exploit website|steal passwords|bypass security)\b/i
];

const PROFESSIONAL_ADVICE = [
  /\b(prescreve|remédio|diagnóstico médico|receita médica|estou com sintomas de|cura para|antibiótico)\b/i,
  /\b(diagnose me|medical prescription|cure for|symptoms of|antibiotics)\b/i,
  /\b(ações|bolsa de valores|investir|investimento|poupanças|criptomoedas|bitcoin|ações na bolsa)\b/i,
  /\b(financial advice|stock tips|invest all my savings|buy stocks|cryptocurrency)\b/i
];

// ─── Portuguese, English, French Persona Refusal Generators ─────────────────

function getLanguage(text: string): 'pt' | 'en' | 'fr' {
  const lower = text.toLowerCase();
  // Highly sensitive Portuguese classifier
  if (/\b(obrigad[oa]|também|então|não|está|você|ainda|compreend|ficheiro|preciso|olá|bom dia|quem|és|tu|resolve|equação|como|ações|bolsa|poupanças|fazer|criar|bomba|explosivo)\b/.test(lower) || /\b(o|a|do|da|no|na|para|com|um|uma|seu|teu|minha|minhas)\b/.test(lower)) return 'pt';
  // French classifier
  if (/\b(bonjour|merci|comment|pourquoi|besoin|comprend|expliquer?|question|je suis|s'il vous|c'est|le|la|les|en|pour|avec|un|une)\b/.test(lower)) return 'fr';
  return 'en';
}

function generateRefusal(lang: 'pt' | 'en' | 'fr', type: 'jailbreak' | 'mental_health' | 'illegal' | 'advice'): string {
  if (lang === 'pt') {
    switch (type) {
      case 'jailbreak':
        return "Olá! Como seu tutor **Ngola**, o meu propósito é guiar as suas aprendizagens e ajudar nas suas dúvidas académicas. Vamos focar-nos na lição de hoje? Que assunto gostaria de explorar?";
      case 'mental_health':
        return "Olá! Percebo que está a passar por um momento difícil, mas como o seu tutor Ngola, não tenho formação médica ou psicológica para ajudar nesta situação. **Por favor, converse com um profissional de saúde mental ou entre em contato com uma linha de apoio nacional (como a Linha SOS Voz Amiga em Portugal, ou o CVV no Brasil).** A sua segurança e bem-estar são a maior prioridade! Se quiser, posso ajudar a encontrar os contactos destas linhas.";
      case 'illegal':
        return "Como o seu tutor académico Ngola, estou comprometido com a segurança e a legalidade. Não posso fornecer instruções para atividades perigosas, ilegais ou nocivas. Que tal voltarmos para um assunto de ciências, história ou matemática?";
      case 'advice':
        return "Como seu tutor Ngola, posso ajudar a explicar conceitos de biologia, economia e finanças. Contudo, não posso fornecer diagnósticos médicos, prescrições de saúde ou conselhos de investimento financeiro personalizados. Recomendo sempre consultar um especialista qualificado (médico ou consultor financeiro) para estas decisões!";
    }
  } else if (lang === 'fr') {
    switch (type) {
      case 'jailbreak':
        return "Bonjour ! En tant que votre tuteur **Ngola**, mon but est de vous accompagner dans vos études. Concentrons-nous sur votre leçon du jour ! Quel sujet souhaitez-vous explorer ?";
      case 'mental_health':
        return "Bonjour ! Je comprends que vous traversez un moment difficile, mais en tant que tuteur Ngola, je ne suis pas qualifié pour vous apporter le soutien médical nécessaire. **Je vous conseille vivement de contacter un professionnel ou une ligne d'écoute nationale.** Votre vie est précieuse !";
      case 'illegal':
        return "En tant que votre tuteur académique Ngola, je respecte des règles de sécurité strictes. Je ne peux pas vous aider dans des activités illégales ou dangereuses. Revenons plutôt à notre leçon !";
      case 'advice':
        return "En tant que tuteur Ngola, je peux expliquer les théories médicales ou économiques, mais je ne peux pas donner de conseils médicaux ou financiers personnalisés. Veuillez consulter un spécialiste qualifié.";
    }
  } else {
    switch (type) {
      case 'jailbreak':
        return "Hello! As your academic tutor **Ngola**, my mission is to guide your learning and assist with your school subjects. Let's focus on today's lesson! What topic would you like to cover?";
      case 'mental_health':
        return "Hello! I hear that you are going through a tough time, but as your tutor Ngola, I am not equipped to provide medical or psychological therapy. **Please reach out to a professional or contact a national crisis helpline.** Your safety and well-being are paramount!";
      case 'illegal':
        return "As your academic tutor Ngola, I am fully committed to safety and legal boundaries. I cannot provide assistance with dangerous, illegal, or harmful activities. Let's return to our educational topics!";
      case 'advice':
        return "As your tutor Ngola, I can explain biology or financial concepts, but I cannot provide medical diagnoses, treatment prescriptions, or personal investment advice. Please consult a qualified professional for these matters.";
    }
  }
}

// ─── MAIN INPUT VALIDATION (Pre-flight Guardrail) ──────────────────────────

export function validateInput(message: string): { safe: boolean; response?: string } {
  const lang = getLanguage(message);

  // A. Check for Jailbreaks and System prompt injection
  for (const regex of JAILBREAK_PATTERNS) {
    if (regex.test(message)) {
      return { safe: false, response: generateRefusal(lang, 'jailbreak') };
    }
  }

  // B. Check for Mental Health & Self-harm
  for (const regex of THERAPY_MENTAL_HEALTH) {
    if (regex.test(message)) {
      return { safe: false, response: generateRefusal(lang, 'mental_health') };
    }
  }

  // C. Check for Illegal Actions / Weapons / Hacking
  for (const regex of ILLEGAL_WEAPONS_HACKING) {
    if (regex.test(message)) {
      return { safe: false, response: generateRefusal(lang, 'illegal') };
    }
  }

  // D. Check for Professional diagnoses / Financial advice
  for (const regex of PROFESSIONAL_ADVICE) {
    if (regex.test(message)) {
      return { safe: false, response: generateRefusal(lang, 'advice') };
    }
  }

  return { safe: true };
}

// ─── MAIN OUTPUT VALIDATION & ALIGNMENT (Post-flight Guardrail) ──────────────

export function validateOutput(responseText: string, originalPrompt: string): { aligned: boolean; response: string } {
  const lang = getLanguage(originalPrompt);
  let cleanedResponse = responseText;

  // A. Alignment check: Enforce Persona boundaries (Anti-System Prompt Leakage)
  if (cleanedResponse.includes("TUTOR_SYSTEM_INSTRUCTION") || cleanedResponse.includes("isDeafMode") || cleanedResponse.includes("isVisionAssist")) {
    return {
      aligned: false,
      response: generateRefusal(lang, 'jailbreak')
    };
  }

  // B. Alignment check: Mitigate Google default persona leakage
  // E.g., if the LLM states "I am a large language model trained by Google" instead of "Ngola Tutor"
  if (/google/i.test(cleanedResponse) && /(treinado|criado|modelo|language model|artificial intelligence|inteligência artificial)/i.test(cleanedResponse)) {
    if (lang === 'pt') {
      cleanedResponse = cleanedResponse.replace(/modelo de linguagem (treinado|criado) pela Google/gi, "tutor académico digital Ngola");
      cleanedResponse = cleanedResponse.replace(/large language model trained by Google/gi, "Ngola Tutor, a friendly digital academic guide");
      cleanedResponse = cleanedResponse.replace(/ia criada pela google/gi, "Ngola Tutor");
    } else {
      cleanedResponse = cleanedResponse.replace(/large language model trained by Google/gi, "Ngola Tutor, a friendly digital academic guide");
      cleanedResponse = cleanedResponse.replace(/modelo de linguagem (treinado|criado) pela Google/gi, "Ngola Tutor, a friendly digital academic guide");
    }
  }

  // C. Alignment check: Socratic Check
  // If the user's prompt was a request for solving a problem, and the LLM response contains direct solutions
  // without asking any guiding questions (no Socratic interaction), we inject a friendly pedagogical reminder.
  const isQuestionPrompt = /\b(solve|calcula|resolve|dá-me a resposta|qual é a resposta|what is the answer|give me the code)\b/i.test(originalPrompt);
  const lacksQuestions = !/[?？]/.test(cleanedResponse);
  
  if (isQuestionPrompt && lacksQuestions) {
    if (lang === 'pt') {
      cleanedResponse = `Como o seu Ngola Tutor, adoro guiar você no raciocínio em vez de apenas entregar a resposta final! \n\n${cleanedResponse}\n\n**O que acha de darmos o próximo passo juntos? Consegue explicar qual foi a lógica que utilizou até agora?**`;
    } else {
      cleanedResponse = `As your Ngola Tutor, I love helping you reason through the solution instead of just giving away the final answer! \n\n${cleanedResponse}\n\n**What do you think is our next step? Can you tell me what you've tried so far?**`;
    }
  }

  return { aligned: true, response: cleanedResponse };
}
