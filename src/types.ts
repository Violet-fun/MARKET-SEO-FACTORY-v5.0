export type WorkflowMode = 'Brain' | 'Factory' | 'Template';
export type GenerationStep = 'idle' | 'context' | 'expanding' | 'researching' | 'planning' | 'outlining' | 'writing' | 'polishing' | 'qa' | 'completed';

export interface ArticleSection {
  title: string;
  infoGain?: string;
  subsections?: string[];
  content: string;
  isGenerating: boolean;
  imageSuggestion?: { suggestion: string; altText: string };
  qaFeedback?: string;
}

export interface Article {
  id: string;
  title: string;
  intent: string;
  keywords: string[]; // Grouped same-intent keywords
  researchData?: string;
  competitiveResearch?: {
    topInsights: string;
    competitorWeaknesses: string[];
    keyFacts: string[];
    userPainPoints: string[];
    externalInsights?: { platform: string; insight: string }[];
    sources?: { title: string; url: string }[];
  };
  contentType?: string;
  coreProposition?: string;
  outline?: { 
    title: string; 
    h1?: string;
    sections: { title: string; infoGain: string; subsections?: string[] }[]; 
    lsi: string[]; 
    anchorLinks: { keyword: string; url: string }[];
    faq?: { question: string; answer: string }[];
  };
  sections: ArticleSection[];
  finalContent: string;
  metaTitle?: string;
  metaDescription?: string;
  h1?: string;
  faq?: { question: string; answer: string }[];
  tldr?: string;
  internalLinks?: string[]; 
  status: 'pending' | 'researching' | 'awaiting_research_approval' | 'outlining' | 'awaiting_outline_approval' | 'writing' | 'polishing' | 'qa' | 'completed' | 'error';
  isPaused?: boolean;
  qaPass?: boolean;
  audit?: {
    onPageScore: number;
    eeatScore: number;
    geoScore: number;
    feedback: string;
  };
}

export interface GenerationState {
  mode: WorkflowMode;
  step: GenerationStep;
  seedKeyword: string; // Used as Seed in Brain mode, as Keywords List in Factory mode
  productToPromote: string;
  audience: string;
  persona: string;
  coreValues: string;
  articles: Article[];
  commonStructure: string;
  contentStandard: string;
  documentStandards: string;
  expandedTerms: any[]; // For Brain mode output
  error: string | null;
}
