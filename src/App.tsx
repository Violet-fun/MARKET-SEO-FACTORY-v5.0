import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Layout, 
  PenTool, 
  CheckCircle2, 
  Loader2, 
  ChevronRight, 
  FileText, 
  Target, 
  Users, 
  Zap, 
  AlertCircle,
  Copy,
  Download,
  RefreshCw,
  Network,
  BookOpen,
  Settings,
  Upload,
  ArrowRight,
  BrainCircuit,
  Factory,
  Activity,
  Check,
  Square,
  Trash2,
  Table as TableIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GenerationState, Article, ArticleSection, WorkflowMode } from './types';
import { 
  expandKeywords,
  researchCompetitors,
  architectOutline,
  writeSegment,
  polishAndAIO,
  qaReview,
  editorMicrosurgery,
  researchMarketContext,
  auditArticle
} from './services/geminiService';
import { withRetry, delay } from './lib/utils';
import mammoth from 'mammoth';

export default function App() {
  const [state, setState] = useState<GenerationState>({
    mode: 'Brain',
    step: 'idle',
    seedKeyword: '',
    productToPromote: '',
    audience: '',
    persona: '',
    coreValues: '',
    articles: [],
    expandedTerms: [],
    commonStructure: '',
    contentStandard: '',
    documentStandards: '',
    error: null,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [customApiKey, setCustomApiKey] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedArticle = state.articles.find(a => a.id === selectedArticleId);

  const handleRetryFeedback = (attempt: number) => {
    setState(prev => ({ ...prev, error: `正在触发限流保护：尝试第 ${attempt} 次重连... (429 Rate Limit)` }));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.name.endsWith('.docx')) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        try {
          const result = await mammoth.extractRawText({ arrayBuffer });
          setState(prev => ({ ...prev, documentStandards: result.value }));
        } catch (err) {
          console.error("Word file parsing error:", err);
          setState(prev => ({ ...prev, error: "Word 文档解析失败，请尝试导出为文本再上传。" }));
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setState(prev => ({ ...prev, documentStandards: text }));
      };
      reader.readAsText(file);
    }
  };

  const handleWorkflowA = async () => {
    if (!state.seedKeyword) return;
    setIsGenerating(true);
    setState(prev => ({ ...prev, step: 'expanding', error: null, expandedTerms: [] }));

    try {
      const clusters = await withRetry(() => expandKeywords(state.seedKeyword, state.productToPromote, customApiKey), handleRetryFeedback);
      setState(prev => ({ ...prev, expandedTerms: clusters, step: 'completed', error: null }));
    } catch (err: any) {
      console.error(err);
      setState(prev => ({ ...prev, error: 'Brain planning failed.', step: 'idle' }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleWorkflowB = async () => {
    if (!state.seedKeyword) return;
    setIsGenerating(true);
    const keywordsList = state.seedKeyword.split('\n').map(k => k.trim()).filter(k => k);
    
    setState(prev => ({ ...prev, step: 'context', error: null }));

    try {
      const context = await withRetry(() => researchMarketContext(keywordsList[0], state.productToPromote, customApiKey), handleRetryFeedback);
      setState(prev => ({
        ...prev,
        audience: context.audience,
        persona: context.persona,
        coreValues: context.coreValues,
        error: null
      }));

      const initialArticles: Article[] = keywordsList.map((k, i) => ({
        id: `fac-${Date.now()}-${i}`,
        title: k,
        intent: state.mode === 'Template' ? 'Template Managed' : 'Bulk Content',
        keywords: [k],
        sections: [],
        finalContent: '',
        status: 'pending'
      }));

      setState(prev => ({ ...prev, articles: [...prev.articles, ...initialArticles] }));
      if (!selectedArticleId) setSelectedArticleId(initialArticles[0].id);

    } catch (err) {
      console.error(err);
      setState(prev => ({ ...prev, error: 'Context research failed.', step: 'idle' }));
    } finally {
      setIsGenerating(false);
    }
  };

  const processArticle = async (artId: string) => {
    const article = state.articles.find(a => a.id === artId);
    if (!article || article.isPaused) return;

    try {
      // Step 1: Research
      if (article.status === 'pending') {
        setState(prev => ({
          ...prev,
          articles: prev.articles.map(a => a.id === artId ? { ...a, status: 'researching' } : a)
        }));

        const research = await withRetry(() => researchCompetitors(article.title, state.productToPromote, customApiKey), handleRetryFeedback);
        
        setState(prev => ({
          ...prev,
          articles: prev.articles.map(a => a.id === artId ? { 
            ...a, 
            status: state.mode === 'Template' ? 'awaiting_research_approval' : 'outlining', // Workflow C waits, B moves to outline
            competitiveResearch: research,
            contentType: research.contentType
          } : a)
        }));

        // Trigger outline automatically for Workflow B
        if (state.mode === 'Factory') {
          setTimeout(() => processArticle(artId), 100);
        }
        return;
      }

      // Step 2: Outlining
      if (article.status === 'outlining') {
        const research = article.competitiveResearch!;
        const outline = await withRetry(() => architectOutline(
          article.title, 
          research, 
          state.productToPromote, 
          state.mode === 'Template' ? state.commonStructure : undefined,
          state.documentStandards,
          customApiKey
        ), handleRetryFeedback);

        setState(prev => ({
          ...prev,
          articles: prev.articles.map(a => a.id === artId ? { 
            ...a, 
            status: state.mode === 'Template' ? 'awaiting_outline_approval' : 'writing', 
            outline,
            h1: outline.h1,
            coreProposition: outline.coreProposition,
            faq: outline.faq,
            sections: outline.sections.map((s: { title: string; infoGain: string; subsections?: string[] }) => ({ 
              title: s.title, 
              content: '', 
              isGenerating: false,
              infoGain: s.infoGain,
              subsections: s.subsections
            }))
          } : a)
        }));
        return;
      }

      // Step 3: Write Content
      if (article.status === 'writing') {
        let accumulatedContent = `# ${article.outline?.title || article.title}\n\n`;
        const outline = article.outline!;
        const research = article.competitiveResearch!;

        for (let j = 0; j < article.sections.length; j++) {
          // Check for pause during execution
          const currentArt = state.articles.find(a => a.id === artId);
          if (currentArt?.isPaused) return;

          const section = article.sections[j];
          const sectionTitle = section.title;
          
          setState(prev => ({
            ...prev,
            articles: prev.articles.map(a => a.id === artId ? {
              ...a,
              sections: a.sections.map((s, idx) => idx === j ? { ...s, isGenerating: true } : s)
            } : a)
          }));

          let segmentRes = await withRetry(() => writeSegment(
            sectionTitle,
            outline.title,
            research.keyFacts,
            outline.coreProposition || '',
            accumulatedContent,
            state.persona,
            section.infoGain,
            section.subsections,
            state.mode === 'Template' ? state.contentStandard : undefined,
            state.documentStandards,
            customApiKey
          ), handleRetryFeedback);

          let qa = await withRetry(() => qaReview(segmentRes.content, sectionTitle, customApiKey), handleRetryFeedback);
          
          if (!qa.pass) {
            segmentRes.content = await withRetry(() => editorMicrosurgery(segmentRes.content, qa.feedback, customApiKey), handleRetryFeedback);
          }

          accumulatedContent += `## ${sectionTitle}\n\n${segmentRes.content}\n\n`;

          setState(prev => ({
            ...prev,
            articles: prev.articles.map(a => a.id === artId ? {
              ...a,
              sections: a.sections.map((s, idx) => idx === j ? { 
                ...s, 
                content: segmentRes.content, 
                isGenerating: false, 
                imageSuggestion: segmentRes.imageSuggestion,
                qaFeedback: qa.pass ? '' : qa.feedback
              } : s)
            } : a)
          }));
        }

        // Final Polishing
        const polished = await withRetry(() => polishAndAIO(
          accumulatedContent, 
          outline.anchorLinks,
          customApiKey
        ), handleRetryFeedback);

        // Final Audit
        const audit = await withRetry(() => auditArticle(
          polished.polishedContent,
          state.documentStandards,
          customApiKey
        ), handleRetryFeedback);

        setState(prev => ({
          ...prev,
          articles: prev.articles.map(a => a.id === artId ? {
            ...a,
            finalContent: polished.polishedContent,
            metaTitle: polished.metaTitle,
            metaDescription: polished.metaDescription,
            h1: polished.h1 || a.h1,
            faq: polished.faq || a.faq,
            audit: audit,
            status: 'completed'
          } : a)
        }));
      }

    } catch (err) {
      console.error(err);
      setState(prev => ({
        ...prev,
        articles: prev.articles.map(a => a.id === artId ? { ...a, status: 'error' } : a)
      }));
    }
  };

  const handleStartArticle = (id: string) => {
    setState(prev => ({
      ...prev,
      articles: prev.articles.map(a => a.id === id ? { ...a, isPaused: false } : a)
    }));
  };

  const handlePauseArticle = (id: string) => {
    setState(prev => ({
      ...prev,
      articles: prev.articles.map(a => a.id === id ? { ...a, isPaused: true } : a)
    }));
  };

  const handleDeleteArticle = (id: string) => {
    setState(prev => ({
      ...prev,
      articles: prev.articles.filter(a => a.id !== id)
    }));
    if (selectedArticleId === id) setSelectedArticleId(null);
  };

  const handleConfirmResearch = (id: string) => {
    setState(prev => ({
      ...prev,
      articles: prev.articles.map(a => a.id === id ? { ...a, status: 'outlining' } : a)
    }));
    setTimeout(() => processArticle(id), 100);
  };

  const handleConfirmStructure = (id: string) => {
    setState(prev => ({
      ...prev,
      articles: prev.articles.map(a => a.id === id ? { ...a, status: 'writing' } : a)
    }));
    setTimeout(() => processArticle(id), 100);
  };

  const handleRegenerateArticle = (id: string) => {
    setState(prev => ({
      ...prev,
      articles: prev.articles.map(a => a.id === id ? { 
        ...a, 
        status: 'pending', 
        sections: [], 
        finalContent: '',
        outline: undefined,
        competitiveResearch: undefined
      } : a)
    }));
  };

  const downloadArticle = (art: Article) => {
    const filename = `${art.title.replace(/\s+/g, '_')}.md`;
    const blob = new Blob([art.finalContent], { type: 'text/markdown;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Automated Trigger Loop for Pending Articles
  const processingRef = useRef<string | null>(null);

  useEffect(() => {
    if (state.mode === 'Brain') return;
    
    // Safety lock: if we are already actively processing something in this turn, skip
    if (processingRef.current) return;

    const nextArticle = state.articles.find(a => 
      (a.status === 'pending' || a.status === 'researching' || a.status === 'outlining' || a.status === 'writing') && !a.isPaused
    );

    if (nextArticle) {
      processingRef.current = nextArticle.id;
      processArticle(nextArticle.id).finally(() => {
        processingRef.current = null;
      });
    }
  }, [state.articles, state.mode]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (state.mode === 'Brain') handleWorkflowA();
    else handleWorkflowB();
  };

  const downloadCSV = () => {
    if (state.expandedTerms.length === 0) return;
    const headers = ["Target Keyword", "Intent", "Keywords Group", "Article Type", "Internal Link Recommendation"].join(",");
    const rows = state.expandedTerms.map(t => 
      `"${t.mainTitle}","${t.intent}","${t.keywords.join('|')}","General Article","/"`
    ).join("\n");
    const blob = new Blob([`${headers}\n${rows}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Brain_Planning_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden text-text-main">
      {/* Header */}
      <header className="h-16 bg-card border-b border-border flex justify-between items-center px-8 shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Network className="text-white w-5 h-5" />
          </div>
          <div className="font-bold text-lg tracking-tight">MARKET SEO FACTORY v5.0</div>
        </div>
        
        {/* Pipeline Tab Switcher */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setState(prev => ({ ...prev, mode: 'Brain', articles: [], expandedTerms: [], step: 'idle' }))}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${state.mode === 'Brain' ? 'bg-white text-primary shadow-sm' : 'text-text-sub hover:text-text-main'}`}
          >
            <BrainCircuit className="w-4 h-4" />
            Workflow A (规划大脑)
          </button>
          <button 
            onClick={() => setState(prev => ({ ...prev, mode: 'Factory', articles: [], expandedTerms: [], step: 'idle' }))}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${state.mode === 'Factory' ? 'bg-white text-primary shadow-sm' : 'text-text-sub hover:text-text-main'}`}
          >
            <Factory className="w-4 h-4" />
            Workflow B (内容工厂)
          </button>
          <button 
            onClick={() => setState(prev => ({ ...prev, mode: 'Template', articles: [], expandedTerms: [], step: 'idle' }))}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${state.mode === 'Template' ? 'bg-white text-primary shadow-sm' : 'text-text-sub hover:text-text-main'}`}
          >
            <Layout className="w-4 h-4" />
            Workflow C (模版工厂)
          </button>
        </div>

        <div className="flex gap-6 text-[11px] font-bold uppercase tracking-widest text-text-sub">
          {(['context', 'expanding', 'researching', 'planning', 'outlining', 'writing', 'polishing', 'qa'] as const).map((s) => (
            <span key={s} className={state.step === s ? 'text-primary' : ''}>{s}</span>
          ))}
        </div>
      </header>

      <main className="flex-1 grid grid-cols-[380px_1fr_320px] gap-6 p-6 overflow-hidden">
        {/* Left Panel: Matrix Config */}
        <div className="panel">
          <div className="panel-header flex justify-between items-center">
            <span>{state.mode === 'Brain' ? '大脑规划配置' : '工厂生产配置'}</span>
            <Settings className="w-3 h-3" />
          </div>
          <div className="content-area custom-scrollbar">
            <form onSubmit={handleStart} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-text-main uppercase tracking-wider">Gemini API Key</label>
                <input 
                  type="password" 
                  placeholder="粘贴您的 API Key"
                  className="input-field"
                  value={customApiKey}
                  onChange={e => setCustomApiKey(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-text-main uppercase tracking-wider">推广产品信息 (Core Feature)</label>
                <input 
                  type="text" 
                  placeholder="e.g. Kling AI - 高清视频生成器"
                  className="input-field"
                  value={state.productToPromote}
                  onChange={e => setState(prev => ({ ...prev, productToPromote: e.target.value }))}
                  disabled={isGenerating}
                />
              </div>

              {state.mode !== 'Brain' && (
                <div className="space-y-4 pt-2 border-t border-dashed border-border">
                  {state.mode === 'Template' && (
                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
                         <Layout className="w-3 h-3 text-primary" /> 通用文章结构
                      </label>
                      <textarea 
                        placeholder="例如: 1. 简介, 2. 功能特点, 3. 操作步骤..."
                        className="input-field h-24 text-[10px] p-2 leading-relaxed"
                        value={state.commonStructure}
                        onChange={e => setState(prev => ({ ...prev, commonStructure: e.target.value }))}
                      />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
                       <PenTool className="w-3 h-3 text-primary" /> 内容产出标准
                    </label>
                    <textarea 
                      placeholder="例如: 字数需大于1000, 插入产品下载链接..."
                      className="input-field h-24 text-[10px] p-2 leading-relaxed"
                      value={state.contentStandard}
                      onChange={e => setState(prev => ({ ...prev, contentStandard: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-3 h-3 text-primary" /> 文档型文章标准 (学习库)
                      </label>
                      <label className="cursor-pointer group flex items-center gap-1.5 px-2 py-0.5 rounded border border-primary/20 hover:bg-primary/5 transition-colors">
                        <Upload className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-bold text-primary">上传文件</span>
                        <input 
                          type="file" 
                          className="hidden" 
                          accept=".txt,.md,.docx" 
                          onChange={handleFileUpload} 
                        />
                      </label>
                    </div>
                    <textarea 
                      placeholder="粘贴您的文档型文章标准, AI 将学习其风格、术语和特定偏好..."
                      className="input-field h-32 text-[10px] p-2 leading-relaxed border-primary/20 bg-primary/5 focus:bg-white"
                      value={state.documentStandards}
                      onChange={e => setState(prev => ({ ...prev, documentStandards: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-text-main uppercase tracking-wider">
                    {state.mode === 'Brain' ? '核心种子词' : '批量关键词列表 (每行一个)'}
                  </label>
                </div>
                <textarea 
                  placeholder={state.mode === 'Brain' ? "输入核心产品词进行全自动化规划..." : "粘贴 Workflow A 生成的关键词列表，每行一个..."}
                  className="input-field h-32 font-mono text-[11px] leading-relaxed resize-none p-3"
                  value={state.seedKeyword}
                  onChange={e => setState(prev => ({ ...prev, seedKeyword: e.target.value }))}
                  disabled={isGenerating}
                />
              </div>

              {state.error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{state.error}</span>
                </div>
              )}

              <button 
                type="submit"
                disabled={isGenerating || !state.seedKeyword}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-4 shadow-lg shadow-primary/20"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {state.mode === 'Brain' ? '正在规划灵感...' : '内容批量产出中...'}
                  </>
                ) : (
                  <>
                    {state.mode === 'Brain' ? <BrainCircuit className="w-4 h-4" /> : state.mode === 'Factory' ? <Factory className="w-4 h-4" /> : <Layout className="w-4 h-4" />}
                    {state.mode === 'Brain' ? '执行 Workflow A (脑暴)' : state.mode === 'Factory' ? '起航 Workflow B (挂机)' : '执行 Workflow C (模版)'}
                  </>
                )}
              </button>
            </form>

            {/* Article List / Factory Monitor */}
            {/* Pipeline Trace for selected article */}
            {selectedArticle && (state.mode === 'Factory' || state.mode === 'Template') && (
              <div className="mb-8 p-4 bg-gray-50/50 rounded-2xl border border-border/50">
                <label className="block text-[10px] font-black text-text-main uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Activity className="w-3 h-3 text-primary" /> 执行链路透明化 (Trace)
                </label>
                <div className="space-y-4">
                  {['Context', 'Expanding', 'Researching', 'Planning', 'Outlining', 'Writing', 'Polishing', 'QA'].map((stage, idx) => {
                    const getProgress = (status: string) => {
                      switch (status) {
                        case 'pending': return 1;
                        case 'researching': return 3;
                        case 'awaiting_research_approval': return 4;
                        case 'outlining': return 5;
                        case 'awaiting_outline_approval': return 5;
                        case 'writing': return 6;
                        case 'polishing': return 7;
                        case 'qa': return 8;
                        case 'completed': return 8;
                        default: return 0;
                      }
                    };
                    const progress = getProgress(selectedArticle.status);
                    const isCompleted = idx < progress;
                    const isActive = idx === progress - 1;

                    return (
                      <div key={stage} className="flex gap-3 items-start relative group">
                        {idx !== 7 && (
                          <div className={`absolute left-[7px] top-4 w-0.5 h-6 ${isCompleted ? 'bg-primary' : 'bg-gray-200'}`} />
                        )}
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
                          isCompleted ? 'bg-primary text-white scale-110 shadow-sm' : 
                          isActive ? 'bg-white border-2 border-primary text-primary animate-pulse' : 
                          'bg-gray-200 text-transparent'
                        }`}>
                          {isCompleted ? <Check className="w-2.5 h-2.5" /> : <div className="w-1 h-1 rounded-full bg-current" />}
                        </div>
                        <div className="flex-1 -mt-0.5">
                          <div className={`text-[10px] font-bold uppercase tracking-tight ${isActive ? 'text-primary' : isCompleted ? 'text-text-main' : 'text-text-sub'}`}>
                            {stage}
                          </div>
                          {isActive && (
                            <div className="text-[8px] text-primary/70 animate-pulse font-medium">Processing...</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {state.articles.length > 0 && (state.mode === 'Factory' || state.mode === 'Template') && (
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-text-main uppercase tracking-wider">
                    排产流水线 ({state.articles.length})
                  </label>
                  {state.articles.some(a => a.status === 'completed') && (
                    <button 
                      onClick={() => {
                        const completed = state.articles.filter(a => a.status === 'completed');
                        completed.forEach(art => {
                          const blob = new Blob([art.finalContent], { type: 'text/markdown' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${art.title.replace(/\s+/g, '_')}.md`;
                          a.click();
                          URL.revokeObjectURL(url);
                        });
                      }}
                      className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline"
                    >
                      <Download className="w-3 h-3" /> 全部下载
                    </button>
                  )}
                </div>
                
                <div className="space-y-3">
                  {state.articles.map((art) => {
                    const stages = ['Context', 'Expanding', 'Researching', 'Planning', 'Outlining', 'Writing', 'Polishing', 'QA'];
                    const getProgress = (status: string) => {
                      switch (status) {
                        case 'pending': return 1;
                        case 'researching': return 3;
                        case 'awaiting_research_approval': return 4;
                        case 'outlining': return 5;
                        case 'awaiting_outline_approval': return 5;
                        case 'writing': return 6;
                        case 'polishing': return 7;
                        case 'qa': return 8;
                        case 'completed': return 8;
                        default: return 0;
                      }
                    };
                    const currentProgress = getProgress(art.status);

                    return (
                      <div key={art.id} className="relative group">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedArticleId(art.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedArticleId(art.id); } }}
                          className={`w-full text-left p-3 rounded-xl border cursor-pointer transition-all flex flex-col gap-2 ${
                            selectedArticleId === art.id 
                              ? 'border-primary bg-blue-50/50 ring-1 ring-primary/10' 
                              : 'border-border bg-white hover:border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              art.status === 'completed' ? 'bg-accent-success' : 
                              art.status === 'error' ? 'bg-red-500' :
                              art.status.includes('awaiting') ? 'bg-amber-500 animate-pulse' :
                              art.status === 'pending' || art.isPaused ? 'bg-gray-300' : 'bg-primary animate-pulse'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">{art.title}</div>
                              <div className="text-[9px] text-text-sub uppercase font-bold mt-0.5">
                                {art.isPaused ? '已暂停' : 
                                 art.status === 'pending' ? '待排队' : 
                                 art.status === 'researching' ? '调研中...' :
                                 art.status === 'awaiting_research_approval' ? '待审核情报' :
                                 art.status === 'outlining' ? '搭建大纲中...' :
                                 art.status === 'awaiting_outline_approval' ? '待审核大纲' :
                                 art.status === 'writing' ? '章节生成中' :
                                 art.status === 'polishing' ? 'SEO润色中' :
                                 art.status === 'completed' ? '已完成' : 
                                 art.status === 'awaiting_approval' ? '待确认大纲' :
                                 art.status === 'error' ? '出现错误' : art.status}
                              </div>
                            </div>
                            
                            {/* Management Buttons */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Completed Tasks: Copy, Download, Restart */}
                              {art.status === 'completed' && (
                                <>
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      navigator.clipboard.writeText(art.finalContent);
                                    }} 
                                    className="p-1 hover:bg-primary/10 rounded text-primary" 
                                    title="复制内容"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button 
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      const blob = new Blob([art.finalContent], { type: 'text/markdown' });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `${art.title.replace(/\s+/g, '_')}.md`;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    }} 
                                    className="p-1 hover:bg-primary/10 rounded text-primary" 
                                    title="下载文件"
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleRegenerateArticle(art.id); }} 
                                    className="p-1 hover:bg-amber-50 rounded text-amber-500" 
                                    title="重新开始任务"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                </>
                              )}
                              
                              {/* Error Tasks: Restart */}
                              {art.status === 'error' && (
                                <button onClick={(e) => { e.stopPropagation(); handleRegenerateArticle(art.id); }} className="p-1 hover:bg-amber-50 rounded text-amber-500" title="重新开始任务">
                                  <RefreshCw className="w-3 h-3" />
                                </button>
                              )}

                              {/* Running Tasks: Stop (Pause) */}
                              {!art.isPaused && art.status !== 'completed' && art.status !== 'error' && (
                                <button onClick={(e) => { e.stopPropagation(); handlePauseArticle(art.id); }} className="p-1 hover:bg-gray-100 rounded text-text-sub" title="停止任务">
                                  <Square className="w-3 h-3" />
                                </button>
                              )}

                              {/* Paused/Pending Tasks: Start (Resume) */}
                              {(art.isPaused || art.status === 'pending') && art.status !== 'completed' && art.status !== 'error' && (
                                <button onClick={(e) => { e.stopPropagation(); handleStartArticle(art.id); }} className="p-1 hover:bg-primary/10 rounded text-primary" title="开始任务">
                                  <Zap className="w-3 h-3" />
                                </button>
                              )}
                              
                              {/* Always Show: Delete */}
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteArticle(art.id); }} className="p-1 hover:bg-red-50 rounded text-red-500" title="删除任务">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* 流程进度条 (Progress Bar) */}
                        <div className="space-y-1">
                          <div className="flex gap-0.5 h-1 w-full">
                            {stages.map((stage, idx) => (
                              <div 
                                key={stage}
                                className={`flex-1 rounded-full transition-all duration-500 ${
                                  idx < currentProgress 
                                    ? (art.status === 'completed' ? 'bg-green-500' : 'bg-primary shadow-[0_0_8px_rgba(37,99,235,0.4)]') 
                                    : 'bg-gray-200'
                                }`}
                                title={stage}
                              />
                            ))}
                          </div>
                          <div className="flex justify-between text-[6px] text-text-sub font-mono uppercase tracking-tighter opacity-50">
                            <span>{stages[0]}</span>
                            <span>{stages[stages.length - 1]}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Middle Panel: Visualizer */}
        <div className="panel">
          <div className="panel-header flex justify-between items-center">
            <span>{state.mode === 'Brain' ? '规划蓝图 (Planning Blueprint)' : '产线监视器 (Production Monitor)'}</span>
            {state.mode === 'Brain' && state.expandedTerms.length > 0 && (
              <button 
                onClick={downloadCSV}
                className="flex items-center gap-1.5 px-3 py-1 bg-primary text-white rounded-lg text-[10px] font-bold hover:bg-primary-dark transition-all"
              >
                <Download className="w-3 h-3" />
                导出排期表 (CSV)
              </button>
            )}
          </div>
          <div className="content-area custom-scrollbar" ref={scrollRef}>
            {state.mode === 'Brain' ? (
              <div className="space-y-4">
                {state.expandedTerms.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-40">
                    <BrainCircuit className="w-16 h-16 mb-4 text-gray-200" />
                    <p className="text-sm font-bold">等待大脑启动...</p>
                  </div>
                ) : (
                  <div className="overflow-hidden border border-border rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-border">
                          <th className="px-4 py-3 text-[10px] uppercase font-bold text-text-sub">目标关键词</th>
                          <th className="px-4 py-3 text-[10px] uppercase font-bold text-text-sub">用户意图</th>
                          <th className="px-4 py-3 text-[10px] uppercase font-bold text-text-sub">关键词集群</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {state.expandedTerms.map((term, i) => (
                          <motion.tr 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            key={i} 
                            className="bg-white hover:bg-gray-50"
                          >
                            <td className="px-4 py-3">
                              <div className="text-xs font-bold flex items-center gap-2">
                                {term.mainTitle}
                                <button onClick={() => copyToClipboard(term.mainTitle)} className="p-1 hover:bg-gray-200 rounded"><Copy className="w-2.5 h-2.5 text-text-sub" /></button>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-[10px] bg-blue-50 text-primary px-2 py-0.5 rounded-full font-bold">{term.intent}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {term.keywords.map((kw: string, ki: number) => (
                                  <span key={ki} className="text-[9px] px-1.5 py-0.5 bg-gray-100 rounded text-text-sub">{kw}</span>
                                ))}
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              // Workflow B Production View
              <div className="space-y-8">
                {!selectedArticle ? (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-center opacity-40">
                    <Factory className="w-16 h-16 mb-4 text-gray-200" />
                    <p className="text-sm font-bold">请选择排产队列中的文章...</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Header Controls */}
                    <div className="flex items-center justify-between bg-gray-50 p-4 rounded-2xl border border-border">
                      <div className="flex items-center gap-4">
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          selectedArticle.status === 'completed' ? 'bg-green-100 text-green-700' : 
                          selectedArticle.status.includes('awaiting') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {selectedArticle.status}
                        </div>
                        {selectedArticle.isPaused && <span className="text-[10px] font-bold text-gray-400 uppercase">PAUSED</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleRegenerateArticle(selectedArticle.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-white text-[11px] font-bold hover:bg-gray-50">
                          <RefreshCw className="w-3.5 h-3.5" /> 重新开始
                        </button>
                        {selectedArticle.status === 'completed' && (
                          <button onClick={() => downloadArticle(selectedArticle)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-[11px] font-bold hover:bg-primary-dark">
                            <Download className="w-3.5 h-3.5" /> 下载 MD
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Error State View */}
                    {selectedArticle.status === 'error' && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="p-10 text-center space-y-6"
                      >
                        <AlertCircle className="w-16 h-16 text-red-100 mx-auto" />
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-text-main">生产线发生故障</h3>
                          <p className="text-xs text-text-sub max-w-xs mx-auto">多次尝试重连失败，可能由于 API 额度超限或网络不稳定。您可以尝试手动重启该任务。</p>
                        </div>
                        <button 
                          onClick={() => handleRegenerateArticle(selectedArticle.id)}
                          className="px-6 py-2 bg-primary text-white rounded-lg font-bold text-xs hover:bg-primary-dark transition-all flex items-center gap-2 mx-auto"
                        >
                          <RefreshCw className="w-3.5 h-3.5" /> 立即重试该任务
                        </button>
                      </motion.div>
                    )}

                    {/* Intelligence Step (Middle) */}
                    {selectedArticle.status === 'awaiting_research_approval' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-10 text-center space-y-6 bg-white border border-border rounded-2xl shadow-sm"
                      >
                        <Target className="w-16 h-16 text-primary/20 mx-auto" />
                        <div className="space-y-2">
                          <h3 className="text-xl font-bold text-text-main">Step 1: 情报搜集完成</h3>
                          <p className="text-sm text-text-sub max-w-sm mx-auto">请在右侧 <span className="font-bold text-primary">情报面板</span> 审核 Top 竞研与全域增量信息。确认无误后点击下方按钮开始搭建大纲。</p>
                        </div>
                        <button 
                          onClick={() => handleConfirmResearch(selectedArticle.id)}
                          className="btn-primary px-10 py-3 shadow-xl transition-transform hover:scale-105"
                        >
                          <CheckCircle2 className="w-5 h-5" /> 确认情报，开始搭建大纲
                        </button>
                      </motion.div>
                    )}

                    {/* Progress Detail (Middle) */}
                    {selectedArticle.status === 'awaiting_outline_approval' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-6 bg-white border-2 border-primary rounded-2xl shadow-xl space-y-6"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-primary">
                            <Layout className="w-6 h-6" />
                            <h3 className="text-lg font-bold">Step 2: 文章架构确认</h3>
                          </div>
                          <button 
                            onClick={() => handleConfirmStructure(selectedArticle.id)}
                            className="btn-primary px-6 py-2 flex items-center gap-2"
                          >
                            <PenTool className="w-4 h-4" /> 架构确认，开始全篇生成
                          </button>
                        </div>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-text-sub">识别类型 (Type)</label>
                              <div className="text-xs font-bold mt-1 text-accent-success uppercase tracking-wider">{selectedArticle.contentType || 'N/A'}</div>
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-text-sub">建议标题 (Title)</label>
                              <div className="text-xs font-bold mt-1 text-primary">{selectedArticle.outline?.title}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-2">
                            <div>
                              <label className="text-[10px] uppercase font-bold text-text-sub">核心意图 (Intent)</label>
                              <div className="text-[10px] mt-1 text-blue-600 font-medium">{selectedArticle.competitiveResearch?.userIntent}</div>
                            </div>
                            <div>
                              <label className="text-[10px] uppercase font-bold text-text-sub">建议 H1</label>
                              <div className="text-xs font-bold mt-1 text-primary">{selectedArticle.outline?.h1}</div>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-text-sub">核心命题 (Core Proposition)</label>
                            <div className="text-[11px] leading-relaxed mt-1 p-2 bg-gray-50 rounded italic">{selectedArticle.coreProposition}</div>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-bold text-text-sub">内容大纲 (基于 Top 竞研与增量信息)</label>
                            <div className="grid grid-cols-1 gap-3 mt-2">
                              {selectedArticle.sections.map((s: any, i: number) => (
                                <div key={i} className="group p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-primary/30 transition-all">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <span className="w-5 h-5 flex items-center justify-center bg-white border border-border rounded text-[10px] font-bold">H2</span>
                                    <span className="text-xs font-bold text-text-main">{s.title}</span>
                                  </div>
                                  <div className="flex items-start gap-2 bg-blue-50/50 p-2 rounded-lg border border-blue-100/50">
                                    <Zap className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                    <div className="text-[10px] text-primary font-medium leading-relaxed">
                                      <span className="font-bold uppercase tracking-tighter opacity-70 mr-1">Info Gain:</span>
                                      {s.infoGain}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          {selectedArticle.faq && selectedArticle.faq.length > 0 && (
                            <div>
                              <label className="text-[10px] uppercase font-bold text-text-sub">计划 FAQ ({selectedArticle.faq.length})</label>
                              <div className="space-y-2 mt-2">
                                {selectedArticle.faq.map((f, i) => (
                                  <div key={i} className="text-[10px] p-2 border border-border rounded bg-white">
                                    <span className="font-bold">Q: {f.question}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => handleConfirmStructure(selectedArticle.id)}
                          className="w-full py-4 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-dark transition-all transform hover:scale-[1.01]"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          确认大纲并开始撰写全文
                        </button>
                      </motion.div>
                    )}

                    {selectedArticle.status !== 'completed' && selectedArticle.status !== 'awaiting_approval' && (
                      <div className="space-y-4">
                        {selectedArticle.sections.map((section, idx) => (
                          <motion.div 
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`p-4 rounded-xl border transition-all ${
                              section.isGenerating ? 'border-primary bg-blue-50/30' : 'border-border bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-bold text-xs flex items-center gap-2">
                                {section.content ? <CheckCircle2 className="w-3.5 h-3.5 text-accent-success" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 shrink-0" />}
                                {section.title}
                              </h4>
                              {section.isGenerating && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                            </div>
                            {section.infoGain && !section.content && (
                              <div className="text-[10px] text-primary/70 font-medium mb-2 border-l-2 border-primary/20 pl-2">
                                增量内容锚点: {section.infoGain}
                              </div>
                            )}
                            {section.content && (
                              <p className="text-[11px] text-text-sub leading-relaxed italic line-clamp-2">
                                {section.content}
                              </p>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    )}
                    {selectedArticle.status === 'completed' && (
                      <div className="prose prose-sm max-w-none">
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                          <h2 className="text-lg font-bold m-0">{selectedArticle.title}</h2>
                          <div className="flex gap-2">
                            <button onClick={() => copyToClipboard(selectedArticle.finalContent)} className="p-2 hover:bg-gray-100 rounded-lg text-text-sub transition-colors"><Copy className="w-4 h-4" /></button>
                          </div>
                        </div>
                        <div className="text-sm text-text-main leading-relaxed whitespace-pre-wrap">
                          {selectedArticle.finalContent}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Market Context / Article Intel */}
        <div className="panel">
          <div className="panel-header">情报面板 (Intelligence Panel)</div>
          <div className="content-area custom-scrollbar space-y-6">
            {state.mode === 'Brain' ? (
              <div className="space-y-6">
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <h4 className="text-[10px] font-bold text-primary uppercase mb-2 flex items-center gap-1.5"><TableIcon className="w-3 h-3" /> 规划说明</h4>
                  <p className="text-xs text-text-sub leading-loose">
                    1. 输入种子词后，AI 会模拟 Top 10 搜索结果进行意图聚类。<br/>
                    2. 导出 CSV 后，请在飞书/Sheets 中人工修正 “目标关键词”。<br/>
                    3. 确定最终列表后，切换到 Workflow B 开启批量挂机生产。
                  </p>
                </div>
              </div>
            ) : (
              selectedArticle ? (
                <div className="space-y-6">
                  {/* Research Intelligence (Active for all Factory/Template steps once research is done) */}
                  {selectedArticle.competitiveResearch && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-6"
                    >
                      <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-4">
                        <label className="text-[10px] uppercase font-bold text-primary flex items-center gap-2">
                          <Target className="w-3 h-3" /> Top 竞研推荐
                        </label>
                        <div className="space-y-3">
                          <div>
                            <div className="text-[9px] text-text-sub font-bold uppercase">推荐类型</div>
                            <div className="text-xs font-bold text-primary italic">{selectedArticle.competitiveResearch.contentType}</div>
                          </div>
                          <div>
                            <div className="text-[9px] text-text-sub font-bold uppercase">推荐标题 (Title)</div>
                            <div className="space-y-1 mt-1">
                              {selectedArticle.competitiveResearch.recommendedTitles.map((t, i) => (
                                <div key={i} className="text-[10px] p-2 bg-white rounded border border-border leading-relaxed font-medium">{t}</div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="text-[9px] text-text-sub font-bold uppercase">推荐 H1</div>
                            <div className="text-xs font-bold text-text-main p-2 bg-white rounded border border-border mt-1">{selectedArticle.competitiveResearch.recommendedH1}</div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-white border border-border rounded-xl space-y-4 shadow-sm">
                        <label className="text-[10px] uppercase font-bold text-text-sub flex items-center gap-2">
                          <Network className="w-3.5 h-3.5 text-primary" /> 全域情报 (Social Signals)
                        </label>
                        <div className="space-y-3">
                          {selectedArticle.competitiveResearch.externalInsights?.map((ei: any, i: number) => (
                            <div key={i} className="space-y-1.5 border-b border-border last:border-0 pb-2 last:pb-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] font-black uppercase text-primary tracking-tighter">{ei.platform}</span>
                              </div>
                              <p className="text-[10px] text-text-sub leading-relaxed italic">"{ei.insight}"</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-gray-50 border border-border rounded-xl space-y-3">
                         <label className="text-[10px] uppercase font-bold text-text-sub flex items-center gap-2">
                           <Zap className="w-3 h-3 text-primary" /> 增量信息点
                         </label>
                         <div className="space-y-1.5">
                           {selectedArticle.competitiveResearch.keyFacts.map((f, i) => (
                             <div key={i} className="text-[10px] flex gap-2 text-text-sub">
                               <span className="text-accent-success font-bold shrink-0">✓</span>
                               <span>{f}</span>
                             </div>
                           ))}
                         </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Audit Scores (Visible when completed) */}
                  {selectedArticle.status === 'completed' && selectedArticle.audit && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 bg-gray-900 text-white rounded-2xl shadow-xl space-y-4 border border-white/10"
                    >
                      <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        <CheckCircle2 className="w-3 h-3 text-accent-success" /> 全文质量审核
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 bg-white/5 rounded-lg border border-white/5">
                          <div className="text-[10px] text-gray-400 mb-1">ON-PAGE</div>
                          <div className={`text-sm font-black ${selectedArticle.audit.onPageScore >= 80 ? 'text-accent-success' : 'text-amber-400'}`}>
                            {selectedArticle.audit.onPageScore}
                          </div>
                        </div>
                        <div className="text-center p-2 bg-white/5 rounded-lg border border-white/5">
                          <div className="text-[10px] text-gray-400 mb-1">EEAT</div>
                          <div className={`text-sm font-black ${selectedArticle.audit.eeatScore >= 80 ? 'text-accent-success' : 'text-amber-400'}`}>
                            {selectedArticle.audit.eeatScore}
                          </div>
                        </div>
                        <div className="text-center p-2 bg-white/5 rounded-lg border border-white/5">
                          <div className="text-[10px] text-gray-400 mb-1">GEO</div>
                          <div className={`text-sm font-black ${selectedArticle.audit.geoScore >= 80 ? 'text-accent-success' : 'text-amber-400'}`}>
                            {selectedArticle.audit.geoScore}
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-400 leading-relaxed p-2 bg-white/5 rounded-lg border border-white/5 italic">
                        {selectedArticle.audit.feedback}
                      </div>
                    </motion.div>
                  )}

                  {/* Intelligence - Competitive Research */}
                  {selectedArticle.competitiveResearch && (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-text-sub uppercase tracking-wider flex items-center gap-1.5">
                          <Layout className="w-3 h-3 text-primary" /> 竞研报告 (Node 2)
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-2 bg-gray-50 rounded-lg border border-border">
                            <div className="text-[9px] text-text-sub font-bold uppercase mb-1">内容类型</div>
                            <div className="text-[10px] font-black text-primary">{selectedArticle.contentType}</div>
                          </div>
                          <div className="p-2 bg-gray-50 rounded-lg border border-border">
                            <div className="text-[9px] text-text-sub font-bold uppercase mb-1">用户意图</div>
                            <div className="text-[10px] font-black text-blue-600 line-clamp-1">{selectedArticle.competitiveResearch.userIntent}</div>
                          </div>
                        </div>
                        <div className="p-2 bg-gray-50 rounded-lg border border-border">
                          <div className="text-[9px] text-text-sub font-bold uppercase mb-1">Top 洞察 (Top 10 Insights)</div>
                          <div className="text-[10px] text-text-main leading-relaxed">{selectedArticle.competitiveResearch.topInsights}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-text-sub uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-primary" /> 全域增量信息 (Reddit/X/TP)
                        </h4>
                        <div className="space-y-2">
                          {selectedArticle.competitiveResearch.externalInsights?.map((insight, i) => (
                            <div key={i} className="p-2 bg-blue-50/50 rounded-lg border border-blue-100/50 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-primary uppercase">{insight.platform}</span>
                              </div>
                              <div className="text-[10px] text-text-main leading-relaxed italic">"{insight.insight}"</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-text-sub uppercase tracking-wider flex items-center gap-1.5">
                          <Target className="w-3 h-3 text-red-500" /> 竞品痛点 & 弱点 (Weak Points)
                        </h4>
                        <div className="space-y-1.5">
                          {selectedArticle.competitiveResearch.competitorWeaknesses.map((w, i) => (
                            <div key={i} className="text-[10px] p-2 bg-red-50/50 text-red-700 rounded-lg border border-red-100/50 flex gap-2">
                              <span className="opacity-50">•</span>
                              {w}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-[10px] font-bold text-text-sub uppercase tracking-wider flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-amber-500" /> 推荐增量事实 (Node 3)
                        </h4>
                        <div className="space-y-1.5">
                          {selectedArticle.competitiveResearch.keyFacts.map((f, i) => (
                            <div key={i} className="text-[10px] p-2 bg-amber-50/50 text-amber-700 rounded-lg border border-amber-100/50">
                              {f}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Meta Specs (if completed) */}
                      {selectedArticle.status === 'completed' && (
                        <div className="space-y-3 pt-4 border-t border-border">
                          <h4 className="text-[10px] font-bold uppercase text-text-main flex items-center gap-2"><Settings className="w-3 h-3" /> SEO Meta Specs</h4>
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <label className="text-[9px] text-text-sub font-bold uppercase">Meta Title ({selectedArticle.metaTitle?.length} chars)</label>
                              <div className={`text-[11px] font-bold ${selectedArticle.metaTitle?.length && (selectedArticle.metaTitle.length < 55 || selectedArticle.metaTitle.length > 65) ? 'text-amber-600' : 'text-primary'}`}>
                                {selectedArticle.metaTitle}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] text-text-sub font-bold uppercase">Meta Desc ({selectedArticle.metaDescription?.length} chars)</label>
                              <div className={`text-[10px] leading-relaxed italic ${selectedArticle.metaDescription?.length && (selectedArticle.metaDescription.length < 120 || selectedArticle.metaDescription.length > 160) ? 'text-amber-600' : 'text-text-sub'}`}>
                                {selectedArticle.metaDescription}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Research Sources */}
                      {selectedArticle.competitiveResearch.sources && (
                        <div className="space-y-3 pt-4 border-t border-border">
                          <label className="block text-xs font-bold text-text-main uppercase tracking-wider">参考来源 (Top Sources)</label>
                          <div className="space-y-2">
                            {selectedArticle.competitiveResearch.sources.map((src, i) => (
                              <a 
                                key={i} 
                                href={src.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors group"
                              >
                                <BookOpen className="w-3 h-3 text-text-sub group-hover:text-primary" />
                                <span className="text-[10px] font-medium text-text-sub group-hover:text-primary truncate flex-1">{src.title}</span>
                                <ArrowRight className="w-2.5 h-2.5 text-gray-300" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                  <Search className="w-10 h-10 text-gray-300 mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Awaiting Fact Batch</p>
                </div>
              )
            )}
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E5E7EB;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #D1D5DB;
        }
      `}</style>
    </div>
  );
}
