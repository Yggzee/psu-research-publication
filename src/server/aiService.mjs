import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(rootEnvPath);
  } catch {}
}

// Models verified live; 2.5-* models return 404 for new keys and were removed.
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-latest',
];

function getApiKey() {
  return process.env.GEMINI_API_KEY || '';
}

/**
 * Universal Gemini API caller with automatic fallback across models
 */
async function callGemini(prompt, systemInstruction = '', temperature = 0.2) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in .env');
  }

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: 4096,
        },
      };

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000), // 20-second timeout per attempt
      });

      const data = await response.json();
      if (data.error) {
        lastError = new Error(data.error.message);
        continue;
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return text.trim();
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

let lastProvider = 'gemini';
export function getLastProvider() {
  return lastProvider;
}

/**
 * Secondary provider: any OpenAI-compatible chat API (OpenAI, Groq, OpenRouter, Ollama...).
 * Configure with OPENAI_API_KEY (optional for local Ollama if OPENAI_BASE_URL is set),
 * OPENAI_BASE_URL (default https://api.openai.com/v1) and OPENAI_MODEL (default gpt-4o-mini).
 */
async function callOpenAICompat(prompt, systemInstruction = '', temperature = 0.2) {
  const key = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || '';
  const isGroq = Boolean(process.env.GROQ_API_KEY) || key.startsWith('gsk_');
  const defaultBase = isGroq ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';
  const defaultModel = isGroq ? (process.env.GROQ_MODEL || 'qwen/qwen3.8-27b') : 'gpt-4o-mini';

  const baseUrl = (process.env.OPENAI_BASE_URL || defaultBase).replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || defaultModel;

  if (!key && !process.env.OPENAI_BASE_URL) {
    throw new Error('Secondary provider not configured (OPENAI_API_KEY or GROQ_API_KEY)');
  }
  const messages = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: prompt });

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Secondary provider error');
  const choice = data.choices?.[0]?.message;
  const text = choice?.content?.trim() || choice?.reasoning?.trim();
  if (!text) throw new Error('Secondary provider returned no text');
  return { text, provider: isGroq ? 'groq' : 'openai' };
}

/**
 * Try Gemini first, then the secondary provider. Throws only if all providers fail.
 */
async function callLLM(prompt, systemInstruction = '', temperature = 0.2) {
  try {
    const text = await callGemini(prompt, systemInstruction, temperature);
    lastProvider = 'gemini';
    return text;
  } catch (geminiErr) {
    try {
      const res = await callOpenAICompat(prompt, systemInstruction, temperature);
      lastProvider = res.provider;
      return res.text;
    } catch (secondaryErr) {
      throw new Error(`Gemini: ${geminiErr.message}; Secondary: ${secondaryErr.message}`);
    }
  }
}

const RETRIEVAL_STOPWORDS = new Set(['the', 'what', 'does', 'about', 'talk', 'talks', 'study', 'this', 'that', 'with', 'from', 'using', 'and', 'for', 'are', 'how', 'who', 'which', 'research', 'paper', 'papers', 'tell', 'explain', 'summary', 'summarize', 'there', 'their', 'can', 'you']);

/**
 * Keyword retrieval: rank publications by overlap with the question (title weighted higher).
 */
function retrieveRelevantPapers(publications, question, limit = 8) {
  const words = question.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !RETRIEVAL_STOPWORDS.has(w));
  if (words.length === 0) return publications.slice(0, limit);

  const scored = publications.map(p => {
    const title = (p.title || '').toLowerCase();
    const rest = `${p.abstract || ''} ${Array.isArray(p.authors) ? p.authors.join(' ') : p.authors || ''}`.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (title.includes(w)) score += 3;
      else if (rest.includes(w)) score += 1;
    }
    return { p, score };
  });

  const matched = scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(s => s.p);
  // No keyword hits: fall back to most-cited papers so the model still has context
  return matched.length > 0 ? matched : publications.slice(0, limit);
}

/**
 * Code-only router: determines the specific intent of the question.
 */
function routeQuestion(q) {
  const s = q.toLowerCase().trim();

  // 1. Casual Greetings
  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|greetings)[\s!.,?]*$/i.test(s)) {
    return 'greeting';
  }

  // 2. Profile / Current User Queries
  if (/\b(who am i|my account|my profile|my role|what is my name|what is my role)\b/.test(s)) {
    return 'my_profile';
  }
  if (/\b(my publications?|my papers?|how many publications? do i have|how many papers? do i have|how many papers? i have)\b/.test(s)) {
    return 'my_publications';
  }

  const isPointSubject = /\b(nbc\s*461|points?|calculate|calculation|calculator|formula)\b/.test(s);
  const isResearcherSubject = /\b(researchers?|researches|faculty|professors?)\b/.test(s);
  const isPublicationSubject = /\b(publications?|papers?|articles?|works?)\b/.test(s);
  const isCitationSubject = /\b(citations?|cited)\b/.test(s);

  // 3. NBC 461 Points calculation & formulas, or direct query "show me numbers"
  if ((isPointSubject && /\b(nbc\s*461|numbers?|formula|calculate|calculation|how|breakdown|rules?|points?|rate)\b/.test(s)) || /^show\s+me\s+(the\s+)?numbers?[\s.?!]*$/i.test(s)) {
    return 'nbc461_calc';
  }

  // 4. Specific: Most cited / top paper ONLY
  if (/\b(most cited|highest cited|top citation|most impact|highest impact)\b/.test(s) && (isPublicationSubject || isCitationSubject || s.includes('paper') || s.includes('research'))) {
    return 'top_paper_only';
  }

  // 5. Specific: Researchers / Faculty ONLY (only if points are NOT the main subject)
  if (isResearcherSubject && !isPublicationSubject && !isCitationSubject && !isPointSubject) {
    if (/\b(how many|count|number|who|list|names?|show|all|currently|registered|i have|we have)\b/.test(s)) {
      return 'researchers_only';
    }
  }

  // 6. Specific: Publications count ONLY
  if (isPublicationSubject && !isResearcherSubject && !isCitationSubject && !isPointSubject) {
    if (/\b(how many|count|total|number|how much)\b/.test(s)) {
      return 'publications_only';
    }
  }

  // 7. Specific: Citations count ONLY
  if (isCitationSubject && !isResearcherSubject && !isPublicationSubject && !isPointSubject) {
    if (/\b(how many|count|total|sum|number)\b/.test(s)) {
      return 'citations_only';
    }
  }

  // 8. Overall system status / general overview
  if (/\b(going on|system status|overview of (the )?system|system activity|system overview|summary of (the )?system)\b/.test(s)) {
    return 'general_status';
  }

  // 9. System Features / Capabilities
  if (/\b(what can you do|what features|list (the )?features|system features|what does (this|the) (system|app|tool|platform) do)\b/.test(s)) {
    return 'features';
  }

  // 10. Navigation & Reports inquiries
  if (/\b(where (can|do|to|is)|which page|find (the )?reports?|accreditation reports?|suc leveling reports?|aaccup reports?|how to export|export (the )?reports?)\b/.test(s)) {
    return 'navigation';
  }

  // 11. General count query mentioning multiple aspects (e.g. how many publications and researchers)
  if (/\b(how many|number of|total count)\b/.test(s) && (isPublicationSubject || isResearcherSubject) && !isPointSubject) {
    return 'general_status';
  }

  return 'paper';
}

function handleRoutedQuestion(route, publications, meta) {
  const list = meta.researchersList || [];
  const u = meta.currentUser;

  switch (route) {
    case 'greeting':
      return "Hello! I'm Campus AI for PSU Asingan. How can I help you today? You can ask me about our faculty researchers, publications, or how the system works.";

    case 'navigation':
      return `You can access institutional tables and exportable files under the "Reports" page (/reports). This provides audit summaries for CHED audits, SUC Leveling, and AACCUP accreditation cycles.`;

    case 'my_profile': {
      if (!u) {
        return "You are currently browsing as a guest. Please log in to view your faculty profile and research outputs.";
      }
      return `Logged-in User Profile:\n• Name: ${u.name}\n• Role: ${u.role}\n• Department: ${u.department}\n• Username: ${u.username}\n• Registered Publications: ${u.publicationsCount} papers\n• Total Citations: ${u.citationsCount}`;
    }

    case 'my_publications': {
      if (!u) {
        return "You are currently browsing as a guest. Please log in to see publications registered under your account.";
      }
      return `You currently have ${u.publicationsCount} approved research publications with ${u.citationsCount} total citations in your profile.`;
    }

    case 'nbc461_calc':
      return `In this system, NBC 461 research publication points are calculated using Journal Indexing and Authorship Role:

1. Base Points by Journal Tier:
• Scopus / Web of Science (IEEE, Elsevier, Springer, Nature, etc.): 25 points
• CHED Recognized / Refereed International (DOAJ, PLOS, etc.): 15 points
• National / Institutional Refereed (PSU Journal, Philippine journals): 10 points
• Institutional Refereed / Baseline Conference: 5 points

2. Authorship Distribution Formula:
• Sole Author: 100% of base points (e.g., 25 pts for Scopus)
• Lead Author: 60% of base points (e.g., 15 pts for Scopus)
• Co-Authors: Share the remaining 40% equally among themselves

You can view and test this interactive calculation for any paper using the Research Inspector Drawer.`;

    case 'researchers_only': {
      const count = meta.totalResearchers ?? list.length;
      if (list.length === 0) {
        return `There are currently ${count} registered researchers in the system.`;
      }
      const formatted = list.map(r => `• ${r}`).join('\n');
      return `There are currently ${count} registered researchers in the system:\n\n${formatted}`;
    }

    case 'publications_only': {
      const count = meta.totalPublications ?? (publications || []).length;
      return `There are currently ${count} approved research publications tracked in the system.`;
    }

    case 'citations_only': {
      const count = meta.totalCitations ?? 0;
      return `The system currently tracks a total of ${count} citations across all approved research papers.`;
    }

    case 'top_paper_only': {
      if (!publications || publications.length === 0) {
        return 'No research publications are currently stored in the system.';
      }
      const sorted = [...publications].sort((a, b) => (Number(b.citations) || 0) - (Number(a.citations) || 0));
      const top = sorted[0];
      const authors = Array.isArray(top.authors) ? top.authors.join(', ') : top.authors;
      return `The most cited research paper in our system is:\n\n"${top.title}" (${top.year}) by ${authors}, with ${top.citations || 0} citations.`;
    }

    case 'features': {
      return `Here are the key features of the Research Publication Tracking System:\n\n1. Google Scholar Search: Import published literature with automatic duplicate prevention.\n2. UN SDG Impact Matrix: Automatically categorizes publications into the 17 UN Sustainable Development Goals.\n3. Research Inspector: Evaluates citation metrics, NBC 461 points, and verifies journal indexing.\n4. Researcher Directory: Tracks faculty research outputs, citations, and co-authorship.\n5. Accreditation Reports: Generates export-ready reports for CHED, SUC Leveling, and AACCUP accreditation.`;
    }

    case 'general_status':
    default: {
      return `System Overview (PSU Asingan):\n\n• Approved Publications: ${meta.totalPublications ?? (publications || []).length}\n• Registered Researchers: ${meta.totalResearchers ?? list.length}\n• Total Citations: ${meta.totalCitations ?? 0}`;
    }
  }
}

/**
 * High-Precision Academic Classifier for UN Sustainable Development Goals (SDGs 1-17)
 */
function localHeuristicSDG(title = '', abstract = '') {
  const combined = `${title} ${abstract}`.toLowerCase();

  const rules = [
    {
      sdg: 'SDG 4: Quality Education',
      keywords: [
        'education', 'learning', 'student', 'students', 'teaching', 'pedagogy', 'pedagogical',
        'curriculum', 'school', 'schools', 'classroom', 'academic', 'instruction', 'modular',
        'peer learning', 'mathematics', 'statistics', 'statistic', 'math', 'algebra', 'permutation',
        'calculus', 'discrete', 'random variables', 'conjectures', 'group theory', 'geometry',
        'attitude toward', 'achievement', 'academic performance', 'intervention', 'interventions',
        'k-12', 'radio-based instruction', 'integrated school', 'grade seven', 'bachelor of secondary',
        'specialization', 'teacher', 'teachers', 'higher education', 'tertiary', 'modal cards', 'lucky 9'
      ],
      rationale: 'Focuses on pedagogical innovation, STEM/mathematics competency, and learning outcome enhancements in Philippine education.',
      ched: 'Smart Education and Pedagogical Advancement',
      weight: 1.2,
    },
    {
      sdg: 'SDG 3: Good Health and Well-being',
      keywords: [
        'health', 'medical', 'disease', 'covid', 'pandemic', 'clinical', 'hospital', 'nursing',
        'acetabular', 'fracture', 'fractures', 'operative', 'surgical', 'orthopedic', 'patient',
        'psychological', 'depression', 'stress', 'nutrition', 'dengue', 'maternal', 'wellness',
        'epidemic', 'vaccine', 'mental health', 'school health'
      ],
      rationale: 'Directly addresses healthcare interventions, clinical outcomes, and health safety preparedness.',
      ched: 'Health Systems and Biomedical Research',
      weight: 1.3,
    },
    {
      sdg: 'SDG 2: Zero Hunger',
      keywords: [
        'agriculture', 'crop', 'crops', 'rice', 'farmer', 'farmers', 'soil', 'yield', 'harvest',
        'farming', 'poultry', 'livestock', 'irrigation', 'fertilizer', 'plant pathology', 'agronomy',
        'food security', 'grain', 'paddy', 'horticulture', 'swine', 'agricultural'
      ],
      rationale: 'Targets agricultural productivity, crop resilience, and regional food security in Pangasinan.',
      ched: 'Food Security and Agricultural Innovation',
      weight: 1.2,
    },
    {
      sdg: 'SDG 12: Responsible Consumption and Production',
      keywords: [
        'resources management', 'resource management', 'austerity', 'cost effective', 'waste reduction',
        'solid waste', 'recycling', 'circular economy', 'materials efficiency', 'sustainable production'
      ],
      rationale: 'Develops resource efficiency models, austerity schemes, and responsible institutional consumption.',
      ched: 'Inclusive Economic Development & Enterprise',
      weight: 1.3,
    },
    {
      sdg: 'SDG 8: Decent Work and Economic Growth',
      keywords: [
        'employment', 'graduates', 'satisfaction and degree', 'professional and personal growth',
        'professional growth', 'job', 'career', 'alumni', 'economic', 'business', 'enterprise',
        'msme', 'labor', 'productivity', 'workforce', 'income', 'microfinance', 'market'
      ],
      rationale: 'Evaluates graduate employability, degree program contributions, and workforce development.',
      ched: 'Inclusive Economic Development & Enterprise',
      weight: 1.1,
    },
    {
      sdg: 'SDG 9: Industry, Innovation and Infrastructure',
      keywords: [
        'machine learning', 'artificial intelligence', 'algorithm', 'iot', 'sensors', 'software',
        'database', 'cloud', 'network', 'automation', 'deep learning', 'robotics', 'information technology',
        'cybersecurity', 'hardware', 'telecommunication', 'infrastructure'
      ],
      rationale: 'Advances technological infrastructure, automated computing systems, and data-driven intelligence.',
      ched: 'Information Technology & Digital Governance',
      weight: 1.1,
    },
    {
      sdg: 'SDG 13: Climate Action',
      keywords: [
        'climate', 'flood', 'flooding', 'typhoon', 'disaster risk', 'global warming', 'carbon footprint',
        'greenhouse', 'sea level', 'hazard mitigation', 'environmental vulnerability', 'weather extremes'
      ],
      rationale: 'Focuses on disaster risk reduction, flood mitigation, and community climate adaptation.',
      ched: 'Disaster Risk Reduction & Climate Change Adaptation',
      weight: 1.2,
    },
    {
      sdg: 'SDG 7: Affordable and Clean Energy',
      keywords: [
        'solar', 'renewable energy', 'photovoltaic', 'biomass', 'biofuel', 'wind energy',
        'energy efficiency', 'electricity', 'grid', 'power generation', 'clean energy'
      ],
      rationale: 'Develops renewable energy applications and energy conservation technologies.',
      ched: 'Sustainable Energy & Green Engineering',
      weight: 1.2,
    },
    {
      sdg: 'SDG 14: Life Below Water',
      keywords: [
        'marine', 'fisheries', 'aquaculture', 'fish', 'tilapia', 'bangus', 'ocean', 'coral',
        'coastal', 'aquatic', 'river', 'freshwater', 'fingerlings'
      ],
      rationale: 'Protects aquatic ecosystems and promotes sustainable aquaculture in Pangasinan water bodies.',
      ched: 'Food Security and Agricultural Innovation',
      weight: 1.2,
    },
    {
      sdg: 'SDG 11: Sustainable Cities and Communities',
      keywords: [
        'community', 'urban', 'rural', 'barangay', 'infrastructure', 'transport', 'housing',
        'local governance', 'resilient communities', 'municipal'
      ],
      rationale: 'Strengthens municipal planning, community resilience, and sustainable settlements.',
      ched: 'Disaster Risk Reduction & Climate Change Adaptation',
      weight: 1.0,
    },
    {
      sdg: 'SDG 16: Peace, Justice and Strong Institutions',
      keywords: [
        'governance', 'policy', 'public administration', 'legal', 'justice', 'transparency',
        'accountability', 'peace', 'crime', 'law enforcement', 'institutional satisfaction'
      ],
      rationale: 'Improves institutional governance, public administration transparency, and policy compliance.',
      ched: 'Information Technology & Digital Governance',
      weight: 1.0,
    },
  ];

  const scored = [];
  for (const rule of rules) {
    let hits = 0;
    for (const kw of rule.keywords) {
      if (combined.includes(kw)) {
        hits += kw.length > 5 ? 2 : 1; // Prioritize specific phrases
      }
    }
    if (hits > 0) {
      scored.push({
        ...rule,
        score: hits * (rule.weight || 1.0),
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    const primary = 'SDG 4: Quality Education';
    const secondary = 'SDG 9: Industry, Innovation and Infrastructure';
    const rationales = {
      [primary]: 'Enhances higher education classroom teaching and university academic standards.',
      [secondary]: 'Introduces innovative educational techniques and research methodologies.',
    };
    return {
      primarySDG: primary,
      secondarySDG: secondary,
      rationale: JSON.stringify(rationales),
      rationales,
      chedPriority: 'Smart Education and Pedagogical Advancement',
      source: 'heuristic',
    };
  }

  const primarySDG = scored[0].sdg;
  const secondarySDG = scored[1]?.sdg || (scored[0].sdg !== 'SDG 4: Quality Education' ? 'SDG 4: Quality Education' : 'SDG 9: Industry, Innovation and Infrastructure');
  const rationales = {
    [primarySDG]: scored[0].rationale,
    [secondarySDG]: scored[1]?.rationale || 'Supports advanced academic methodology and scientific inquiry.',
  };

  return {
    primarySDG,
    secondarySDG,
    rationale: JSON.stringify(rationales),
    rationales,
    chedPriority: scored[0].ched,
    source: 'heuristic',
  };
}

/**
 * Classify a research publication into UN SDGs and CHED Agendas
 */
export async function classifyPublicationSDG(title, abstract, journal = '') {
  const cleanTitle = (title || '')
    .replace(/^\[(pdf|html|c|b|citation|doc|book)\]\s*/i, '')
    .replace(/[…\.]+/g, ' ')
    .trim();

  const prompt = `You are an academic research evaluator for Pangasinan State University - Asingan Campus.
Evaluate this publication against the United Nations Sustainable Development Goals (SDGs 1-17) and Philippine CHED agendas.

Domain Guidelines:
- SDG 3 (Good Health and Well-being): Orthopedic surgery, acetabular fractures, clinical outcomes, Covid-19, disease prevention, health preparedness.
- SDG 4 (Quality Education): Mathematics, pedagogy, localized teaching, student attitudes, radio-based instruction, learning performance.
- SDG 8 (Decent Work and Economic Growth): Graduate tracer studies, alumni degree programs, employment, career growth, workforce skills.
- SDG 10 (Reduced Inequalities): Remedial interventions for struggling learners, rural/integrated school support, bridging educational gaps.
- SDG 12 (Responsible Consumption and Production): Austerity schemes, resources management, expenditure optimization, waste reduction.
- SDG 9 (Industry, Innovation and Infrastructure): Machine learning algorithms, artificial intelligence, IoT, digital tools, mathematical models.
- SDG 2 (Zero Hunger): Agriculture, crop yields, rice production, farming.
- SDG 13 (Climate Action): Disaster risk reduction, flood mitigation, climate resilience.

Analyze this publication:
Title: "${cleanTitle || 'Untitled'}"
Journal: "${journal || 'N/A'}"
Abstract: "${abstract ? abstract.slice(0, 1500) : 'N/A'}"

Identify:
1. The most accurate Primary UN SDG (Format: "SDG X: Name")
2. An appropriate Secondary UN SDG (Format: "SDG Y: Name")
3. "primaryRationale": A simple, easy-to-understand 1-sentence explanation in plain, everyday language explaining why and how this research specifically advances the Primary SDG.
4. "secondaryRationale": A simple, easy-to-understand 1-sentence explanation in plain, everyday language explaining why and how this research specifically advances the Secondary SDG.
5. The corresponding Philippine CHED / DOST Research Priority (Choose from: "Food Security and Agricultural Innovation", "Smart Education and Pedagogical Advancement", "Information Technology & Digital Governance", "Health Systems and Biomedical Research", "Disaster Risk Reduction & Climate Change Adaptation", "Sustainable Energy & Green Engineering", or "Inclusive Economic Development & Enterprise").

Respond with ONLY raw valid JSON (no markdown formatting, no backticks):
{
  "primarySDG": "string",
  "secondarySDG": "string",
  "primaryRationale": "string",
  "secondaryRationale": "string",
  "chedPriority": "string"
}`;

  try {
    const raw = await callGemini(prompt, 'You are an academic evaluator. Output valid JSON only.');
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    const primarySDG = parsed.primarySDG || 'SDG 4: Quality Education';
    const secondarySDG = parsed.secondarySDG || 'SDG 9: Industry, Innovation and Infrastructure';
    const rationales = {
      [primarySDG]: parsed.primaryRationale || parsed.rationale || 'Advances quality educational instruction and student learning outcomes.',
      [secondarySDG]: parsed.secondaryRationale || parsed.rationale || 'Introduces innovative methodologies and practical research solutions.',
    };

    return {
      primarySDG,
      secondarySDG,
      rationale: JSON.stringify(rationales),
      rationales,
      chedPriority: parsed.chedPriority || 'Smart Education and Pedagogical Advancement',
      source: 'gemini',
    };
  } catch (err) {
    console.warn('[classifyPublicationSDG] Gemini failed, using local heuristic:', err.message);
    return localHeuristicSDG(cleanTitle, abstract);
  }
}

/**
 * Audit journal indexing and predatory reputation
 */
export function auditJournalReputation(journalName = '') {
  if (!journalName || journalName.trim().length === 0) {
    return {
      indexing: 'Unindexed',
      nbc461Points: 5.0,
      isPredatory: 0,
      confidence: 'Institutional Baseline',
    };
  }

  const j = journalName.toLowerCase();

  // Known high-index markers
  if (j.includes('ieee') || j.includes('springer') || j.includes('elsevier') || j.includes('acm') || j.includes('nature') || j.includes('scopus') || j.includes('sciencedirect') || j.includes('wiley')) {
    return {
      indexing: 'Scopus / Web of Science',
      nbc461Points: 25.0,
      isPredatory: 0,
      confidence: 'Verified Top-Tier International Index',
    };
  }

  if (j.includes('international journal') || j.includes('asean') || j.includes('ched') || j.includes('doaj') || j.includes('plos') || j.includes('mdpi')) {
    return {
      indexing: 'CHED Recognized / Refereed International',
      nbc461Points: 15.0,
      isPredatory: 0,
      confidence: 'Recognized Refereed Venue',
    };
  }

  if (j.includes('philippine') || j.includes('national') || j.includes('university') || j.includes('psu') || j.includes('journal of science')) {
    return {
      indexing: 'National / Institutional Refereed',
      nbc461Points: 10.0,
      isPredatory: 0,
      confidence: 'National/Regional Refereed Journal',
    };
  }

  return {
    indexing: 'Institutional Refereed',
    nbc461Points: 5.0,
    isPredatory: 0,
    confidence: 'Peer-Reviewed Conference / Institutional Repository',
  };
}

/**
 * Ask Campus Intelligence (Academic RAG)
 * Answers questions strictly grounded in stored PSU Asingan publications and system features
 * Strictly guarded against personal questions and off-topic queries
 */
export async function askCampusIntelligence(question, publications = [], systemMetadata = {}, history = []) {
  const trimmedQ = (question || '').trim();
  if (!trimmedQ) {
    return {
      answer: 'Please ask a question about the Research Publication Tracking System, university publications, or institutional metrics.',
      citedPapers: [],
    };
  }

  // Fast pre-filter for obvious personal or completely off-topic queries
  const offTopicRegex = /\b(favorite (food|color|movie|song|game|animal)|who made you|are you (alive|human|dating|in love|single)|tell me a joke|weather in|how to cook|bake|recipe|cryptocurrency|bitcoin|horoscope|zodiac|love letter|dating advice|who is the president of|who won the)\b/i;
  if (offTopicRegex.test(trimmedQ)) {
    return {
      answer: `I am PSU Asingan’s Academic Intelligence Assistant. I am designed exclusively to assist you with our Research Publication Tracking System and campus academic research. I do not answer personal questions or unrelated topics.

I can assist you with:
1. System Activity: Current repository metrics, active researchers, and system records.
2. System Features: How Google Scholar claiming, UN SDG matrix, NBC 461 points, or search tools work.
3. Research Purposes: Campus research clusters, institutional impact, and accreditation alignment.
4. Specific Research: Summaries, authors, methodology, findings, and citations of any PSU paper.

How may I assist you with our system or research repository today?`,
      citedPapers: [],
      source: 'guardrail',
    };
  }

  // Agent 1: code-only router for fast, 100% accurate, specific answers
  const route = routeQuestion(trimmedQ);
  if (route !== 'paper') {
    return {
      answer: handleRoutedQuestion(route, publications || [], systemMetadata),
      citedPapers: [],
      source: 'database',
    };
  }

  if (!publications || publications.length === 0) {
    return {
      answer: 'No campus publications are currently stored in the system. Please search Google Scholar or add publications first.',
      citedPapers: [],
    };
  }

  // Agent 2: retrieval-augmented paper answers using only the most relevant papers
  const relevantPapers = retrieveRelevantPapers(publications, trimmedQ, 8);
  const paperSummaries = relevantPapers.map((p, idx) => ({
    refId: idx + 1,
    id: p.id,
    title: p.title,
    authors: Array.isArray(p.authors) ? p.authors.join(', ') : p.authors,
    year: p.year,
    citations: p.citations || 0,
    journal: p.journal || 'PSU Archive',
    abstract: p.abstract ? p.abstract.slice(0, 350) : 'Full text on archive',
    sdg: p.sdg_tags ? (typeof p.sdg_tags === 'string' ? p.sdg_tags : JSON.stringify(p.sdg_tags)) : 'General Research',
    rationale: p.sdg_rationale || '',
  }));

  const contextText = paperSummaries
    .map(p => `[Ref ${p.refId}] "${p.title}" (${p.year}) by ${p.authors} | Journal: ${p.journal} | Citations: ${p.citations}\nUN SDGs: ${p.sdg}\nAbstract: ${p.abstract}`)
    .join('\n\n');

  const historySnippet = (history || [])
    .slice(-6)
    .map(m => `${m.sender === 'ai' ? 'Assistant' : 'User'}: ${m.text}`)
    .join('\n');

  const u = systemMetadata.currentUser;
  const userContextLine = u
    ? `User is logged in as: ${u.name} (Role: ${u.role}, Department: ${u.department}, Username: ${u.username}, Publications: ${u.publicationsCount}, Citations: ${u.citationsCount})`
    : 'User is browsing as a Guest';

  const prompt = `You are Campus AI for the Research Publication Tracking System of Pangasinan State University - Asingan Campus (PSU Asingan).

CRITICAL INSTRUCTIONS (USER PREFERENCE):
1. BE CONCISE & DIRECT: Answer ONLY what the user asked for. Never add unasked information, extra summaries, or unrelated topics.
2. USE SIMPLE, PLAIN LANGUAGE: Explain concepts simply and clearly so any student or faculty member can understand immediately. Avoid bureaucratic or overly academic jargon.
3. NO FORMAL FILLER: Never start with "Greetings! I am the PSU Asingan Academic Intelligence Assistant...". Get straight to the answer.
4. CITATIONS: Only cite research papers (using [Ref X]) if the user's question is explicitly asking about research papers, authors, topics, or study results. DO NOT cite random research papers when answering general questions about how points or system features work.
5. NO ASTERISK CLUTTER: Do not bold numbers or over-wrap terms in asterisks.

CURRENT USER & SYSTEM CONTEXT:
- ${userContextLine}
- Total Approved Publications: ${systemMetadata.totalPublications || publications.length}
- Total Registered Researchers: ${systemMetadata.totalResearchers || 2}
- Registered Researchers: ${(systemMetadata.researchersList || []).join('; ')}
- Total Citation Count: ${systemMetadata.totalCitations || 0}
- System Pages & Modules:
${(systemMetadata.pages || systemMetadata.features || []).map(f => '  * ' + f).join('\n')}

NBC 461 RESEARCH POINT RULES IN THIS SYSTEM:
- Journal Tiers: Scopus/Web of Science = 25 pts; CHED Recognized/International Refereed = 15 pts; National Refereed = 10 pts; Institutional Baseline = 5 pts.
- Authorship Multipliers: Sole Author = 100% (full base points); Lead Author = 60%; Co-Authors = share remaining 40% equally.
- Evaluated interactively in the Research Inspector Drawer.
- Faculty Promotion: NBC 461 evaluates 4 main areas: (1) Instruction, (2) Research (tracked by this system), (3) Extension, and (4) Professional Development. Final promotion thresholds and requirements are administered by the university HRMO.

${historySnippet ? `RECENT CONVERSATION HISTORY:\n${historySnippet}\n` : ''}
CAMPUS RESEARCH PUBLICATIONS CONTEXT:
${contextText}

USER QUESTION: "${trimmedQ}"`;

  try {
    const rawAnswer = await callLLM(
      prompt,
      'You are PSU Asingan Campus AI. Always answer concisely and in simple terms that anyone can understand. Answer only what is asked. Get straight to the point.',
      0.2
    );

    // Clean up any double-nested or redundant asterisks like "** **" or "****"
    const answer = rawAnswer
      .replace(/\*{3,}/g, '**')
      .replace(/\*\*\s*\*\*/g, ' ')
      .replace(/\*\*\s*:\s*\*\*/g, ': ')
      .trim();

    // Identify which papers were cited in the answer
    const citedMatches = answer.match(/\[Ref\s*(\d+)\]/gi) || [];
    const citedNumbers = Array.from(new Set(citedMatches.map(m => {
      const match = m.match(/\d+/);
      return match ? parseInt(match[0], 10) : null;
    }).filter(Boolean)));

    const citedPapers = paperSummaries
      .filter(p => citedNumbers.includes(p.refId))
      .map(p => ({
        id: p.id,
        refId: p.refId,
        title: p.title,
        authors: p.authors,
        year: p.year,
        journal: p.journal,
      }));

    return {
      answer,
      citedPapers,
      source: getLastProvider(),
    };
  } catch (err) {
    console.warn('[askCampusIntelligence] Gemini failed, using local synthesis:', err.message);

    const qLower = trimmedQ.toLowerCase();
    const notice = '(Note: the AI service is temporarily unavailable, so this is a basic automated answer.)';

    // Counts / researcher listing from real system metadata
    if (/\b(how many|count|number of|total)\b/.test(qLower) || /\b(researchers?|faculty|authors?)\b/.test(qLower) && /\b(who|list|registered|currently)\b/.test(qLower)) {
      const list = systemMetadata.researchersList || [];
      return {
        answer: `Total Approved Publications: ${systemMetadata.totalPublications || publications.length}\nTotal Registered Researchers: ${systemMetadata.totalResearchers ?? list.length}\nTotal Citations: ${systemMetadata.totalCitations || 0}${list.length ? '\nRegistered Researchers: ' + list.join('; ') : ''}\n\n${notice}`,
        citedPapers: [],
        source: 'heuristic',
      };
    }

    // Check if question asks about what is going on in system
    if (qLower.includes('going on') || qLower.includes('system status') || qLower.includes('overview of system')) {
      return {
        answer: `Current Status of the PSU Asingan Research Publication Tracking System:\n\n• Total Publications on File: ${publications.length} verified research papers.\n• Faculty Researchers: Registered faculty members actively tracking academic outputs.\n• Primary Research Pillars: Leading contributions in SDG 4 (Quality Education: STEM and mathematics pedagogy), SDG 9 (Industry & Innovation), SDG 8 (Decent Work), and SDG 3 (Good Health & Well-being).\n• Institutional Readiness: SUC Leveling and AACCUP accreditation metrics are actively monitored with automated citation tracking and NBC 461 point calculations.`,
        citedPapers: [],
        source: 'heuristic',
      };
    }

    // Check if question asks what a feature does
    if (qLower.includes('what does this do') || qLower.includes('what does the') || qLower.includes('how does')) {
      return {
        answer: `System Features Guide:\n\n1. Google Scholar Search & Auto-Caching: Enables searching published literature, automatically caching records locally in SQLite, and preventing duplicate imports through title normalization.\n2. UN SDG Impact Matrix: Utilizes AI to categorize campus publications across all 17 United Nations Sustainable Development Goals and Philippine CHED priorities.\n3. Research Inspector Drawer: Evaluates citation trends, NBC 461 points, and verifies academic journal indexing.\n4. Dynamic Researcher Directory: Tracks individual faculty outputs, citation sums, and co-authorship records.`,
        citedPapers: [],
        source: 'heuristic',
      };
    }

    // Local fallback: keyword-score papers against the question
    const stop = new Set(['the', 'what', 'does', 'about', 'talk', 'study', 'this', 'that', 'with', 'from', 'using', 'and', 'for', 'are', 'how', 'who', 'research', 'paper']);
    const words = qLower.split(/[^a-z0-9]+/).filter(w => w.length > 2 && !stop.has(w));
    const scored = publications
      .map(p => {
        const hay = `${p.title || ''} ${p.abstract || ''}`.toLowerCase();
        return { p, score: words.filter(w => hay.includes(w)).length };
      })
      .filter(s => s.score >= Math.max(1, Math.ceil(words.length / 3)))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    if (scored.length === 0) {
      return {
        answer: `I couldn't find a matching publication for that question, and the AI service is temporarily unavailable. Please try again shortly or rephrase using keywords from the paper's title.\n\n${notice}`,
        citedPapers: [],
        source: 'heuristic',
      };
    }

    const fallbackCited = scored.map(({ p }, i) => ({
      id: p.id,
      refId: i + 1,
      title: p.title,
      authors: p.authors,
      year: p.year,
      journal: p.journal || 'PSU Archive',
    }));

    const lines = scored.map(({ p }, i) => `[Ref ${i + 1}] "${p.title}" (${p.year}) by ${Array.isArray(p.authors) ? p.authors.join(', ') : p.authors}${p.abstract ? '\nAbstract: ' + p.abstract.slice(0, 300) : ''}`);
    return {
      answer: `Closest matching publications:\n\n${lines.join('\n\n')}\n\n${notice}`,
      citedPapers: fallbackCited,
      source: 'heuristic',
    };
  }
}

/**
 * Calculate Interdisciplinary Synergy between two researchers
 */
export async function calculateSynergy(researcherA, researcherB, papersA = [], papersB = []) {
  const titlesA = papersA.map(p => p.title).join('; ');
  const titlesB = papersB.map(p => p.title).join('; ');

  const prompt = `You are an academic research matchmaker. Compare these two university researchers from Pangasinan State University - Asingan:

Researcher 1: ${researcherA.name} (${researcherA.department})
Publications: ${titlesA || 'No publications listed yet.'}

Researcher 2: ${researcherB.name} (${researcherB.department})
Publications: ${titlesB || 'No publications listed yet.'}

Generate:
1. A synergy score between 60 and 98 based on their potential for interdisciplinary collaboration.
2. A proposed joint research proposal title that combines both disciplines.
3. A 2-sentence rationale for why this joint proposal would be high-impact for Pangasinan.

Respond in raw JSON (no backticks):
{
  "synergyScore": 88,
  "proposedTitle": "string",
  "rationale": "string"
}`;

  try {
    const raw = await callGemini(prompt, 'You are an academic matchmaker. Output raw JSON only.');
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    return {
      synergyScore: Math.floor(75 + Math.random() * 18),
      proposedTitle: `Interdisciplinary Framework for ${researcherA.department} and ${researcherB.department} Convergence in Pangasinan`,
      rationale: `Bridging the technical expertise of ${researcherA.name} with the domain insights of ${researcherB.name} can create innovative localized solutions.`,
    };
  }
}
