import * as gemini from './geminiService';
import * as openai from './openaiService';
import { AIProvider } from '../types';

export async function researchMarketContext(seedKeyword: string, product: string, apiKey?: string, provider: AIProvider = 'Gemini', model: string = 'gemini-3.1-flash-lite-preview') {
    if (provider === 'OpenAI') return openai.researchMarketContext(seedKeyword, product, apiKey, model);
    return gemini.researchMarketContext(seedKeyword, product, apiKey, model);
}

export async function expandKeywords(seedKeyword: string, product: string, apiKey?: string, provider: AIProvider = 'Gemini', model: string = 'gemini-3.1-flash-lite-preview') {
    if (provider === 'OpenAI') return openai.expandKeywords(seedKeyword, product, apiKey, model);
    return gemini.expandKeywords(seedKeyword, product, apiKey, model);
}

export async function researchCompetitors(topic: string, product: string, apiKey?: string, provider: AIProvider = 'Gemini', model: string = 'gemini-3.1-pro-preview') {
    if (provider === 'OpenAI') return openai.researchCompetitors(topic, product, apiKey, model);
    return gemini.researchCompetitors(topic, product, apiKey, model);
}

export async function architectOutline(topic: string, research: any, product: string, commonStructure?: string, documentStandards?: string, apiKey?: string, provider: AIProvider = 'Gemini', model: string = 'gemini-3.1-pro-preview') {
    if (provider === 'OpenAI') return openai.architectOutline(topic, research, product, commonStructure, documentStandards, apiKey, model);
    return gemini.architectOutline(topic, research, product, commonStructure, documentStandards, apiKey, model);
}

export async function writeSegment(
    sectionTitle: string,
    articleTitle: string,
    keyFacts: string[],
    proposition: string,
    previousContent: string,
    persona: string,
    infoGain?: string,
    subsections?: string[],
    contentStandard?: string,
    documentStandards?: string,
    apiKey?: string,
    provider: AIProvider = 'Gemini',
    model: string = 'gemini-3.1-pro-preview'
) {
    if (provider === 'OpenAI') return openai.writeSegment(sectionTitle, articleTitle, keyFacts, proposition, previousContent, persona, infoGain, subsections, contentStandard, documentStandards, apiKey, model);
    return gemini.writeSegment(sectionTitle, articleTitle, keyFacts, proposition, previousContent, persona, infoGain, subsections, contentStandard, documentStandards, apiKey, model);
}

export async function polishAndAIO(content: string, anchorLinks: { keyword: string; url: string }[], apiKey?: string, provider: AIProvider = 'Gemini', model: string = 'gemini-3.1-flash-lite-preview') {
    if (provider === 'OpenAI') return openai.polishAndAIO(content, anchorLinks, apiKey, model);
    return gemini.polishAndAIO(content, anchorLinks, apiKey, model);
}

export async function qaReview(content: string, sectionTitle: string, apiKey?: string, provider: AIProvider = 'Gemini', model: string = 'gemini-3.1-flash-lite-preview') {
    if (provider === 'OpenAI') return openai.qaReview(content, sectionTitle, apiKey, model);
    return gemini.qaReview(content, sectionTitle, apiKey, model);
}

export async function editorMicrosurgery(content: string, feedback: string, apiKey?: string, provider: AIProvider = 'Gemini', model: string = 'gemini-3.1-flash-lite-preview') {
    if (provider === 'OpenAI') return openai.editorMicrosurgery(content, feedback, apiKey, model);
    return gemini.editorMicrosurgery(content, feedback, apiKey, model);
}

export async function auditArticle(content: string, standards?: string, apiKey?: string, provider: AIProvider = 'Gemini', model: string = 'gemini-3.1-flash-lite-preview') {
    if (provider === 'OpenAI') return openai.auditArticle(content, standards, apiKey, model);
    return gemini.auditArticle(content, standards, apiKey, model);
}
