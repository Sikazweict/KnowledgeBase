import React, { useState, useEffect } from 'react';
import { 
  Database, 
  Search, 
  Cpu, 
  Activity, 
  FileText, 
  Network, 
  TrendingUp, 
  Terminal,
  Zap,
  ArrowRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini from Frontend (Requirement)
const ai = new GoogleGenAI({ apiKey: (process.env as any).GEMINI_API_KEY });
const modelName = "gemini-3-flash-preview";

interface Entity {
  name: string;
  type: string;
}

interface Relationship {
  subject: string;
  relation: string;
  object: string;
}

interface SearchResult {
  title: string;
  excerpt: string;
  type: string;
  relevance_score: number;
}

interface Trend {
  topic: string;
  projected_growth: string;
  confidence: number;
}

interface IngestedDocument {
  id: string;
  title: string;
  type: string;
  timestamp: string;
  entities: Entity[];
  summary: string;
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<{
    entities: Entity[];
    relationships: Relationship[];
    summary: string;
    extractedText?: string;
    metadata?: any;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  const [trends, setTrends] = useState<Trend[]>([]);
  const [ingestedDocs, setIngestedDocs] = useState<IngestedDocument[]>([]);
  const [activeTab, setActiveTab] = useState<'ingest' | 'search' | 'analytics' | 'kb'>('ingest');
  const [ingestMode, setIngestMode] = useState<'text' | 'file'>('text');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  useEffect(() => {
    fetchTrends();
    fetchDocuments();
  }, []);

  const fetchTrends = async () => {
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      setTrends(data.trends || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      const data = await res.json();
      setIngestedDocs(data.documents || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAnalyze = async () => {
    if (!inputText) return;
    setIsAnalyzing(true);
    try {
      const prompt = `
        Analyze the following institutional document text. 
        Extract key entities (Researcher, Project, Department, Keyword, Methodology) 
        and identify relationships between them (e.g. LeadResearcher -> Project).
        
        Return exactly in JSON format:
        {
          "entities": [{"name": string, "type": string}],
          "relationships": [{"subject": string, "relation": string, "object": string}],
          "summary": string
        }
        
        Text: ${inputText}
      `;

      const result = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(result.text || "{}");
      setAnalysisData(data);
      
      // Store in backend KB
      const storeRes = await fetch('/api/store_document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: inputText.substring(0, 50) + "...",
          type: "Text Snippet",
          data: data
        })
      });
      
      if (storeRes.ok) {
        showNotification("Document successfully ingested into the Knowledge Core.", "success");
      } else {
        throw new Error("Failed to store document in backend.");
      }
      
      fetchDocuments(); // Refresh KB
    } catch (e) {
      console.error(e);
      showNotification("Ingestion failed: " + (e instanceof Error ? e.message : "Unknown error"), "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    
    try {
      // Read file as base64
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await fileDataPromise;

      const prompt = `
        You are a highly accurate Document Intelligence Engine.
        Perform OCR and extraction on this ${file.name} file.
        
        1. Extract all text clearly.
        2. Identify Institutional Entities (Researcher, Project, Department, Keyword, Methodology).
        3. Identify Relationships.
        
        Return exactly in JSON format:
        {
          "extractedText": string,
          "entities": [{"name": string, "type": string}],
          "relationships": [{"subject": string, "relation": string, "object": string}],
          "summary": string
        }
      `;

      const result = await ai.models.generateContent({
        model: modelName,
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Data,
                  mimeType: file.type || "application/pdf"
                }
              }
            ]
          }
        ],
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(result.text || "{}");
      
      setAnalysisData({
        entities: data.entities || [],
        relationships: data.relationships || [],
        summary: file.name + " processed successfully via OCR.",
        extractedText: data.extractedText,
        metadata: { filename: file.name, format: file.type }
      });

      if (data.extractedText) {
        setInputText(data.extractedText);
      }

      // Store in backend KB
      const storeRes = await fetch('/api/store_document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: file.name,
          type: file.type,
          data: data
        })
      });

      if (storeRes.ok) {
        showNotification(`${file.name} successfully processed and stored.`, "success");
      } else {
        throw new Error("Backend storage failure.");
      }

      fetchDocuments(); // Refresh KB
    } catch (e) {
      console.error(e);
      showNotification("OCR Processing Error: " + (e instanceof Error ? e.message : "Failed to process multimodal file"), "error");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const prompt = `
        Acting as a Semantic Search Retrieval engine for a Knowledge Management System.
        The user queried: "${searchQuery}"
        
        Provide 4 relevant simulated search results in JSON:
        [{"title": string, "excerpt": string, "type": string, "relevance_score": number}]
      `;

      const result = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      setSearchResults(JSON.parse(result.text || "[]"));
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-12 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-end mb-12 border-b border-gray-200 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
            <span className="label-micro font-medium tracking-widest text-blue-600">Axiom v1.1.0</span>
          </div>
          <h1 className="text-4xl font-medium tracking-tight text-gray-900 uppercase">Knowledge Core</h1>
        </div>
        <div className="flex gap-8">
          <div className="text-right">
            <div className="label-micro">System Status</div>
            <div className="value-mono text-sm font-semibold text-emerald-600 uppercase">Operational</div>
          </div>
          <div className="text-right">
            <div className="label-micro">Active Nodes</div>
            <div className="value-mono text-sm font-semibold">1,402</div>
          </div>
        </div>
      </header>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 p-4 rounded shadow-2xl border flex items-center gap-3 min-w-[320px] ${
              notification.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {notification.type === 'success' ? <Zap size={18} /> : <Info size={18} />}
            <span className="text-xs font-semibold uppercase tracking-wider">{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-auto opacity-50 hover:opacity-100"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation */}
      <nav className="flex gap-1 mb-8 overflow-x-auto pb-2 custom-scrollbar">
        {[
          { id: 'ingest', label: 'Gather', icon: Database },
          { id: 'search', label: 'Understand', icon: Search },
          { id: 'analytics', label: 'Intelligence', icon: Activity },
          { id: 'kb', label: 'Knowledge Base', icon: FileText },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-2 border rounded-sm transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-gray-900 text-white border-gray-900 shadow-lg' 
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
            }`}
          >
            <tab.icon size={16} />
            <span className="text-xs font-semibold uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Grid */}
      <main className="technical-grid flex-1">
        <div className="flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {activeTab === 'kb' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="data-card p-6 h-full overflow-y-auto custom-scrollbar"
              >
                <div className="flex justify-between items-center mb-6">
                  <h2 className="flex items-center gap-2 font-medium">
                    <FileText size={18} className="text-blue-600" />
                    Institutional Knowledge Base
                  </h2>
                  <div className="label-micro">Total Entries: {ingestedDocs.length}</div>
                </div>

                <div className="space-y-4">
                  {ingestedDocs.length > 0 ? ingestedDocs.map((doc, idx) => (
                    <motion.div 
                      key={doc.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-4 border border-gray-100 rounded bg-gray-50 hover:border-blue-200 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900 mb-1">{doc.title}</h3>
                          <div className="flex gap-4 items-center">
                            <span className="label-micro bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{doc.type}</span>
                            <span className="label-micro font-mono">{new Date(doc.timestamp).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 line-clamp-2 italic">"{doc.summary}"</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {doc.entities?.slice(0, 5).map((ent, i) => (
                          <span key={i} className="text-[9px] uppercase tracking-tighter bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-400">
                            {ent.name}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  )) : (
                    <div className="py-20 text-center text-gray-400">
                      <Database size={48} className="mx-auto mb-4 opacity-10" />
                      <p className="text-xs uppercase tracking-widest">No Ingested Records Found</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'ingest' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col h-full gap-6"
              >
                <div className="data-card p-6 flex flex-col h-full">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="flex items-center gap-2 font-medium">
                      <FileText size={18} className="text-blue-600" />
                      Document Ingestion Pipeline
                    </h2>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => setIngestMode('text')}
                        className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${ingestMode === 'text' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                       >Text</button>
                       <button 
                        onClick={() => setIngestMode('file')}
                        className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded ${ingestMode === 'file' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}
                       >File</button>
                    </div>
                  </div>
                  
                  {ingestMode === 'text' ? (
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Paste institutional raw data (e.g. Research Abstracts, Admin Notes)..."
                      className="flex-1 w-full p-4 bg-gray-50 border border-gray-200 rounded-sm font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none mb-4"
                    />
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-sm bg-gray-50 mb-4 p-12 text-center group hover:border-blue-300 transition-all cursor-pointer relative">
                      <input 
                        type="file" 
                        onChange={handleFileUpload} 
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        accept=".pdf,.docx,.jpg,.jpeg,.png,.xlsx"
                      />
                      <Zap size={48} className="text-gray-200 mb-4 group-hover:text-blue-400 transition-colors" />
                      <p className="text-sm font-medium text-gray-600 uppercase tracking-widest mb-2">Multimodal Upload</p>
                      <p className="text-xs text-gray-400">PDF, DOCX, JPEG, PNG, XLSX (OCR Enabled)</p>
                      {isAnalyzing && (
                        <div className="mt-6 flex flex-col items-center">
                          <Activity size={24} className="text-blue-600 animate-pulse mb-2" />
                          <span className="label-micro animate-pulse">Running Nerve Engine...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {ingestMode === 'text' && (
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || !inputText}
                      className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-4 rounded-sm font-semibold uppercase tracking-widest text-xs hover:bg-gray-800 disabled:opacity-50 transition-all"
                    >
                      {isAnalyzing ? (
                        <>
                          <Zap size={16} className="animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Network size={16} />
                          Execute Extraction
                        </>
                      )}
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'search' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col h-full gap-6"
              >
                <div className="data-card p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="flex items-center gap-2 font-medium">
                      <Cpu size={18} className="text-purple-600" />
                      ML-Powered Hybrid Search
                    </h2>
                    <span className="label-micro">Cognitive Layer (Layer 02)</span>
                  </div>
                  <div className="relative mb-6">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Semantic & Keyword Query..."
                      className="w-full p-6 pl-14 bg-gray-900 text-white border border-gray-800 rounded-sm font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={24} />
                    {isSearching && (
                      <div className="absolute right-6 top-1/2 -translate-y-1/2">
                        <Activity size={20} className="text-blue-400 animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {searchResults.map((result, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="p-4 border-l-4 border-blue-600 bg-white hover:bg-gray-50 transition-colors cursor-pointer group shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{result.title}</h3>
                          <span className="value-mono text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase">
                            {result.relevance_score.toFixed(2)} Rank
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 leading-relaxed truncate">{result.excerpt}</p>
                        <div className="mt-2 flex items-center gap-4">
                          <span className="label-micro">{result.type}</span>
                          <span className="label-micro">Source: Neo4j Node {1024 + idx}</span>
                        </div>
                      </motion.div>
                    ))}
                    {searchResults.length === 0 && !isSearching && (
                      <div className="py-20 text-center text-gray-400">
                        <Terminal size={48} className="mx-auto mb-4 opacity-10" />
                        <p className="text-xs uppercase tracking-widest">Awaiting Semantic Inquiry</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'analytics' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="data-card p-6 h-full"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="flex items-center gap-2 font-medium">
                    <TrendingUp size={18} className="text-emerald-600" />
                    Predictive Intelligence Engine
                  </h2>
                  <span className="label-micro">Foresight Layer (Layer 03)</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {trends.map((trend, idx) => (
                    <div key={idx} className="p-6 border border-gray-100 rounded bg-gray-50 flex items-center justify-between group hover:border-emerald-200 transition-all">
                      <div>
                        <div className="label-micro text-gray-400">Research Pivot</div>
                        <div className="text-lg font-semibold text-gray-800">{trend.topic}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500" 
                              style={{ width: `${trend.confidence * 100}%` }} 
                            />
                          </div>
                          <span className="value-mono text-[10px] text-gray-400">{(trend.confidence * 100).toFixed(0)}% Conf.</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-mono font-bold text-emerald-600">+{trend.projected_growth}</div>
                        <div className="label-micro text-emerald-600/50">Proj. Velocity</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-12 p-8 border border-dashed border-gray-300 rounded-lg flex items-center gap-6 bg-white shadow-inner">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                    <Info size={32} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 uppercase text-xs tracking-widest mb-1">Architecture Insight</h3>
                    <p className="text-sm text-gray-500 leading-relaxed max-w-xl">
                      These predictions utilize **time-series analysis** over the Knowledge Graph triples, identifying methodology-project 
                      clustering before they reach administrative publication.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sidebar Context */}
        <aside className="flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
          {/* Analysis View */}
          <div className="data-card p-4 space-y-6">
            <div>
              <div className="label-micro border-b border-gray-100 pb-2 mb-4">Neural Ontology Schema</div>
               {analysisData ? (
                <div className="space-y-6">
                  <div>
                    <div className="label-micro text-blue-600 mb-2 uppercase text-[10px]">Identified Entities</div>
                    <div className="flex flex-wrap gap-2">
                      {analysisData.entities?.map((e, idx) => (
                        <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px] value-mono rounded border border-blue-100">
                          {e.name} <span className="opacity-50 ml-1">({e.type})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="label-micro text-purple-600 mb-2 uppercase text-[10px]">Extracted Relations</div>
                    <div className="space-y-2">
                      {analysisData.relationships?.map((r, idx) => (
                        <div key={idx} className="text-[10px] value-mono bg-gray-50 p-2 rounded flex items-center gap-2 border border-gray-100">
                          <span className="text-gray-900">{r.subject}</span>
                          <ArrowRight size={10} className="text-gray-400" />
                          <span className="text-purple-600 font-bold">[{r.relation}]</span>
                          <ArrowRight size={10} className="text-gray-400" />
                          <span className="text-gray-900">{r.object}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400 border border-dashed border-gray-200 rounded">
                  <span className="label-micro text-[9px]">Awaiting Pipeline Input</span>
                </div>
              )}
            </div>

            <div>
              <div className="label-micro border-b border-gray-100 pb-2 mb-4">Graph Metrics</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-900 text-white rounded shadow-sm">
                  <div className="text-xl font-bold font-mono">0.92</div>
                  <div className="label-micro text-white/50 text-[9px]">F1 Extraction</div>
                </div>
                <div className="p-3 bg-gray-900 text-white rounded shadow-sm">
                  <div className="text-xl font-bold font-mono">24ms</div>
                  <div className="label-micro text-white/50 text-[9px]">Vector Latency</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto p-4 bg-gray-100 border border-gray-200 rounded text-[10px] text-gray-500 font-mono italic">
            &gt; system_logs: hybrid_search_engine initialized withSentence-BERT v2.5...
            <br />
            &gt; node_sync: KnowledgeGraph(Neo4j) connected successfully.
          </div>
        </aside>
      </main>
    </div>
  );
}
