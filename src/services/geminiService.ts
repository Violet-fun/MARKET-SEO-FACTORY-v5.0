import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = (apiKey?: string) => new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY || "" });

const DEFAULT_PRO_MODEL = "gemini-3.1-pro-preview";
const DEFAULT_FLASH_MODEL = "gemini-3-flash-preview";

/**
 * Utility to parse JSON from AI response, handling markdown blocks if present.
 */
function parseJsonResponse(text: string) {
  try {
    const cleaned = text.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("Failed to parse JSON response:", text);
    throw new Error("Invalid JSON format from AI response");
  }
}

/**
 * Node 0: Market Context Researcher
 * Automatically generates Audience, Persona, and Selling Points based on Product + Keywords.
 */
export async function researchMarketContext(seedKeyword: string, product: string, apiKey?: string, model: string = DEFAULT_FLASH_MODEL) {
  const ai = getAiClient(apiKey);
  const prompt = `
    You are a Strategic Market Analyst. 
    Product: "${product}"
    Seed Keyword: "${seedKeyword}"
    
    Task:
    1. Define the ideal Target Audience (be specific about their role and intent).
    2. Define a high-authority Writing Persona (e.g., "Senior Tech Architect at [Company]").
    3. Extract 3-5 Core Selling Points that differentiate our product in this keyword context.
    
    Return JSON:
    {
      "audience": "...",
      "persona": "...",
      "coreValues": "..."
    }
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          audience: { type: Type.STRING },
          persona: { type: Type.STRING },
          coreValues: { type: Type.STRING }
        },
        required: ["audience", "persona", "coreValues"]
      }
    }
  });

  return parseJsonResponse(response.text);
}
export async function expandKeywords(seedKeyword: string, product: string, apiKey?: string, model: string = DEFAULT_FLASH_MODEL) {
  const ai = getAiClient(apiKey);
  const prompt = `
    You are an SEO Strategist. 
    Seed Keyword: "${seedKeyword}"
    Product to Promote: "${product}"
    
    Task:
    1. Expand the seed keyword into a topic cluster.
    2. Group keywords by intent. Keywords with the same search intent (same search results) should be grouped together for ONE article.
    3. Identify related keywords with different intents. Each should be a SEPARATE article.
    4. Focus on high-value long-tail keywords for single articles.
    
    Output a JSON object with:
    {
      "clusters": [
        {
          "id": "art-1",
          "mainTitle": "Primary Headline",
          "intent": "Intent Category (e.g., Tutorial, Comparison)",
          "keywords": ["kw1", "kw2"],
          "whyDistinct": "Reason why this intent is unique"
        }
      ]
    }
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          clusters: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                mainTitle: { type: Type.STRING },
                intent: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                whyDistinct: { type: Type.STRING }
              },
              required: ["id", "mainTitle", "intent", "keywords"]
            }
          }
        },
        required: ["clusters"]
      }
    }
  });

  const data = parseJsonResponse(response.text);
  return data.clusters;
}

/**
 * Node 2: Market & Competitor Research (Dissector)
 */
export async function researchCompetitors(topic: string, product: string, apiKey?: string, model: string = DEFAULT_PRO_MODEL) {
  const ai = getAiClient(apiKey);
  const prompt = `
    You are a Market Researcher & Competitive Dissector.
    Target Topic: "${topic}"
    Our Product: "${product}"
    
    Instructions:
    1. Scan Top 10 Google results for this topic (simulated).
    2. Identify "Content Type": Determine if the top results are "Best/Listicle", "How-to/Tutorial", "Review", "Comparison", or "Technical Narrative".
    3. Identify "User Intent Pattern": What exactly is the user looking for? (e.g., "Finding the best tool among alternatives", "Solving a specific error message").
    4. "Search for Competitor Reviews": Look for user complaints about existing solutions on specialized review sites.
    5. "External Source Crawl": Simulate gathering insights from Reddit, Trustpilot, and X (Twitter) for real-world user discussions and unique angles.
    6. Identify "Competitor Weak Points": Functions they claim but don't deliver, or outdated information (e.g., 2024 info vs 2026 reality).
    7. "3 Hidden Truths": What are 3 things only experts know that competitors are ignoring?
    8. Output a structured report.
    
    Return JSON:
    {
      "contentType": "Detected Content Type",
      "userIntent": "Core User Intent identified",
      "recommendedTitles": ["Title Option A", "Title Option B"],
      "recommendedH1": "Best recommended H1",
      "topInsights": "Synthesized view of the landscape",
      "competitorWeaknesses": ["Weakness 1", "Weakness 2"],
      "keyFacts": ["Fact with Data 1", "Fact with Data 2", "Real-world Case 1"],
      "userPainPoints": ["Pain Point 1", "Pain Point 2"],
      "externalInsights": [
        { "platform": "Reddit", "insight": "Users complain that tool X is too slow for 4K video." }
      ],
      "sources": [
        { "title": "Source Page Title", "url": "https://..." }
      ]
    }
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          contentType: { type: Type.STRING },
          userIntent: { type: Type.STRING },
          recommendedTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendedH1: { type: Type.STRING },
          topInsights: { type: Type.STRING },
          competitorWeaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          keyFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
          userPainPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          externalInsights: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                platform: { type: Type.STRING },
                insight: { type: Type.STRING }
              },
              required: ["platform", "insight"]
            }
          },
          sources: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                url: { type: Type.STRING }
              },
              required: ["title", "url"]
            }
          }
        },
        required: ["contentType", "userIntent", "recommendedTitles", "recommendedH1", "topInsights", "competitorWeaknesses", "keyFacts", "userPainPoints", "externalInsights", "sources"]
      }
    } as any
  });

  const data = parseJsonResponse(response.text);
  return data;
}

/**
 * Node 3: Core Proposition + Node 4: GEO-Optimized Deep Outline
 */
export async function architectOutline(topic: string, research: any, product: string, commonStructure?: string, documentStandards?: string, apiKey?: string, model: string = DEFAULT_PRO_MODEL) {
  const ai = getAiClient(apiKey);
  const prompt = `
    Generate a deep SEO/GEO outline for: "${topic}"
    Product: "${product}"
    Research Findings: ${JSON.stringify(research)}
    ${commonStructure ? `MANDATORY STRUCTURE TO FOLLOW: ${commonStructure}` : ''}
    ${documentStandards ? `LEARN FROM THESE DOCUMENT STANDARDS (Style & Tone): ${documentStandards}` : ''}
    
    Requirements:
    1. Role: Senior SEO content creator at HitPaw (SaaS multimedia AI brand).
    2. Content Type Strategy: Based on detected type "${research.contentType || 'N/A'}" and intent "${research.userIntent || 'N/A'}", ensure the structure perfectly addresses the user's specific problem.
    3. Start with [GEO Summary]: A highly synthesized, bolded summary of the core answer to the user's intent.
    3. Define "Core Proposition": A unique angle that offers "Information Gain" (增量信息) not found in top 10 results.
    4. Define "Structure with Info Gain": For each H2 section, clearly state what unique data or perspective (增量内容) will be added. Include sub-bullets for H3s if needed.
    5. Ensure logical flow for information gain and mention sources where applicable.
    
    Return JSON:
    {
      "title": "SEO Optimized Title",
      "h1": "Target H1 (includes main keyword)",
      "coreProposition": "...",
      "sections": [
        { 
          "title": "H2 Section Title", 
          "infoGain": "What unique info to add here",
          "subsections": ["H3 Title 1", "H3 Title 2"]
        }
      ],
      "lsi": ["Keyword 1", "Keyword 2"],
      "anchorLinks": [
        { "keyword": "Target Keyword", "url": "Placeholder URL" }
      ],
      "faq": [
        { "question": "...", "answer": "..." }
      ]
    }
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          h1: { type: Type.STRING },
          coreProposition: { type: Type.STRING },
          sections: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                infoGain: { type: Type.STRING },
                subsections: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["title", "infoGain"]
            }
          },
          lsi: { type: Type.ARRAY, items: { type: Type.STRING } },
          anchorLinks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                keyword: { type: Type.STRING },
                url: { type: Type.STRING }
              }
            }
          },
          faq: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING }
              },
              required: ["question", "answer"]
            }
          }
        },
        required: ["title", "h1", "coreProposition", "sections", "lsi", "anchorLinks", "faq"]
      }
    }
  });

  return parseJsonResponse(response.text);
}

/**
 * Node 5: Data-Rich Segmented Writer
 */
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
  model: string = DEFAULT_PRO_MODEL
) {
  const ai = getAiClient(apiKey);
  const prompt = `
    Write the section: "${sectionTitle}"
    Article: "${articleTitle}"
    Persona: Senior SEO Content Creator for HitPaw (Multimedia AI Brand).
    Core Proposition: ${proposition}
    Section Goal (Info Gain): ${infoGain || 'Expand with unique value'}
    Planned Subsections (H3s): ${subsections?.join(", ") || 'N/A'}
    ${contentStandard ? `Content Quality Standard to follow: ${contentStandard}` : ''}
    ${documentStandards ? `MANDATORY STYLE/TONE FROM DOCUMENT STANDARDS: ${documentStandards}` : ''}
    
    MANDATORY SEO & DATA INJECTION:
    1. Word Count Goal: Aim for 400-600 words for this specific section to contribute to a 1500-2500 word total.
    2. Data/Facts: Use at least 2 data points from: ${keyFacts.join(" | ")}. Cite sources if possible based on this information.
    3. Formatting: Use H2 for the section title and H3 for subsections if relevant.
    4. Product Recommendation: If recommending HitPaw tools, describe operational steps (steps <= 20 words each) and features in conjunction with the current topic.
    5. First Paragraph Rule: If this is the intro, ensure it's exactly 300-400 characters.
    6. Tone: Authoritative, tech-focused, no AI fluff. Mention "HitPaw" naturally.
    
    Return JSON:
    {
      "content": "Markdown content here...",
      "imageSuggestion": {
        "suggestion": "Description of the image needed",
        "altText": "SEO Alt-text"
      }
    }
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING },
          imageSuggestion: {
            type: Type.OBJECT,
            properties: {
              suggestion: { type: Type.STRING },
              altText: { type: Type.STRING }
            }
          }
        },
        required: ["content", "imageSuggestion"]
      }
    }
  });

  return parseJsonResponse(response.text);
}

/**
 * Node 6: Polish & AIO Connector
 */
export async function polishAndAIO(content: string, anchorLinks: { keyword: string; url: string }[], apiKey?: string, model: string = DEFAULT_FLASH_MODEL) {
  const ai = getAiClient(apiKey);
  const prompt = `
    You are an Editor & AIO Specialist for HitPaw.
    Task:
    1. Polish the content to remove "AI-isms".
    2. Ensure First Paragraph is 300-400 characters.
    3. Meta Information:
       - Meta Title: 55-65 characters (Must include H1).
       - Meta Description: 120-160 characters.
       - H1: Ensure it's clear and SEO-focused.
    4. FAQ Section: Create/refine max 4 questions based on the content.
    5. Auto-link: In the text, wrap these keywords:
       ${anchorLinks.map(l => `${l.keyword} -> ${l.url}`).join("\n")}
    
    Return JSON:
    {
      "polishedContent": "Full polished Markdown article",
      "metaTitle": "55-65 chars",
      "metaDescription": "120-160 chars",
      "h1": "Final H1",
      "faq": [
        { "question": "...", "answer": "..." }
      ]
    }
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          polishedContent: { type: Type.STRING },
          metaTitle: { type: Type.STRING },
          metaDescription: { type: Type.STRING },
          h1: { type: Type.STRING },
          faq: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING }
              },
              required: ["question", "answer"]
            }
          }
        },
        required: ["polishedContent", "metaTitle", "metaDescription", "h1", "faq"]
      }
    }
  });

  return parseJsonResponse(response.text);
}

/**
 * Node 7: QA Node (Micro-Surgery)
 */
export async function qaReview(content: string, sectionTitle: string, apiKey?: string, model: string = DEFAULT_FLASH_MODEL) {
  const ai = getAiClient(apiKey);
  const prompt = `
    You are a Content Auditor. 
    Review this section: "${sectionTitle}"
    Content:
    ${content}
    
    Checklist:
    - Does it contain at least 2 data points/key facts?
    - Is it free of AI fluff?
    - Is the tone professional and authoritative?
    
    Return JSON:
    {
      "pass": true/false,
      "score": 0-100,
      "feedback": "Specific feedback for improvement if Fail"
    }
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pass: { type: Type.BOOLEAN },
          score: { type: Type.NUMBER },
          feedback: { type: Type.STRING }
        },
        required: ["pass", "score", "feedback"]
      }
    }
  });

  return parseJsonResponse(response.text);
}

/**
 * Node 7b: Editor Micro-Surgery
 */
export async function editorMicrosurgery(content: string, feedback: string, apiKey?: string, model: string = DEFAULT_FLASH_MODEL) {
  const ai = getAiClient(apiKey);
  const prompt = `
    You are an Editor performing "Micro-Surgery". 
    Feedback from QA: ${feedback}
    Original Content:
    ${content}
    
    Task: Modify ONLY the problematic parts mentioned in the feedback. Maintain all other wording. 
    Inject missing data points if requested.
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt
  });

  return response.text;
}

/**
 * Node 8: Final Article Auditor
 * Evaluates against On-Page, EEAT, and GEO standards.
 */
export async function auditArticle(content: string, standards?: string, apiKey?: string, model: string = DEFAULT_FLASH_MODEL) {
  const ai = getAiClient(apiKey);
  const prompt = `
    You are a Content Quality Auditor. 
    Task: Evaluate the following article against 3 standards:
    1. On-Page SEO: Title, H1, internal linking space, flow, keywords.
    2. EEAT: Expertise, Experience, Authoritativeness, Trustworthiness. Check for unique data, citations, expert tone.
    3. GEO (Generative Engine Optimization): Synthesized answer, bolded key takeaways, clear information gain (增量信息).
    
    ${standards ? `Additionally, check against these Document Standards: ${standards}` : ''}
    
    Content:
    ${content}
    
    Return JSON:
    {
      "onPageScore": 0-100,
      "eeatScore": 0-100,
      "geoScore": 0-100,
      "feedback": "Detailed feedback on what was done well and what needs improvement."
    }
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          onPageScore: { type: Type.NUMBER },
          eeatScore: { type: Type.NUMBER },
          geoScore: { type: Type.NUMBER },
          feedback: { type: Type.STRING }
        },
        required: ["onPageScore", "eeatScore", "geoScore", "feedback"]
      }
    }
  });

  return parseJsonResponse(response.text);
}
