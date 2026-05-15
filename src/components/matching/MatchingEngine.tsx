import React, { useState, useRef, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Loader2, 
  BrainCircuit, 
  Users, 
  Search,
  BarChart3, 
  Dna, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  Upload,
  MessageSquare,
  Send,
  Bot,
  User as UserIcon,
  X,
  FileText,
  History,
  ArrowLeft
} from 'lucide-react';
import { Expert, MatchResponse, ChatMessage, MatchAnalysis } from '../../types';
import { generateGeminiContent as generateContent } from '../../lib/gemini';
import { useNavigate } from 'react-router-dom';

interface MatchCardProps {
  expert: Expert;
  index: number;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
  key?: React.Key;
}

const MatchCard = ({ expert, index, onSelect, isSelected }: MatchCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.1 }}
    className={`bg-white border-l-4 ${isSelected ? 'border-l-secondary' : 'border-l-primary'} rounded-xl shadow-sm p-6 hover:shadow-md transition-all group`}
  >
    <div className="flex justify-between items-start mb-6">
      <div className="flex gap-4 items-center">
        <div className={`w-12 h-12 ${isSelected ? 'bg-secondary-light/30' : 'bg-slate-100'} rounded-full border border-slate-200 flex items-center justify-center text-slate-400 font-bold uppercase transition-colors group-hover:bg-primary-light group-hover:text-primary-dark text-sm`}>
          {(expert.name || 'Unknown').split(' ').map(n => n[0]).join('')}
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-800 group-hover:text-primary transition-colors">{expert.name}</h3>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">{expert.role}</p>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-3xl font-light ${isSelected ? 'text-secondary' : 'text-primary'} leading-none`}>{expert.matchDetails?.score}%</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Semantic Fit</div>
      </div>
    </div>
    
    <div className="space-y-4">
      <div className={`p-4 ${isSelected ? 'bg-secondary-light/20 border-secondary-light' : 'bg-primary-light/30 border-primary-light'} rounded-xl border relative overflow-hidden group/box`}>
        <Sparkles className="absolute -right-2 -top-2 w-12 h-12 text-primary/10 group-hover/box:scale-110 transition-transform" />
        <span className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${isSelected ? 'text-secondary' : 'text-primary'} mb-2`}>
          <CheckCircle2 className="w-3 h-3" /> Match Reasoning
        </span>
        <p className="text-sm text-slate-600 leading-relaxed relative z-10">{expert.matchDetails?.reason}</p>
      </div>
      
      {expert.matchDetails?.gap && (
        <div className="text-sm text-slate-500 flex items-start gap-3 p-3 bg-amber-50/30 rounded-lg border border-amber-100/50">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed"><span className="font-bold text-amber-700 uppercase tracking-wide mr-2">Potential Gap:</span> {expert.matchDetails?.gap}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        {expert.tags?.slice(0, 5).map(tag => (
          <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded border border-slate-200 group-hover:bg-primary-light group-hover:border-primary-light group-hover:text-primary transition-colors">
            {tag}
          </span>
        ))}
      </div>

      {expert.metadata && Object.entries(expert.metadata).filter(([_, val]) => typeof val === 'string' && val.startsWith('http')).length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
          {Object.entries(expert.metadata)
            .filter(([_, val]) => typeof val === 'string' && val.startsWith('http'))
            .map(([key, val]) => (
              <a 
                key={key} 
                href={val as string} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-wide rounded-lg border border-primary/10 hover:bg-primary hover:text-white transition-colors"
                title={`Open ${key} Document`}
              >
                <FileText className="w-3 h-3" />
                {key}
              </a>
          ))}
        </div>
      )}
      
      <div className="grid grid-cols-2 gap-4 mt-6">
        <button className="flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-900 text-[8px] font-bold uppercase tracking-[0.2em] rounded-xl border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all">
          Blueprint <ArrowRight className="w-3 h-3" />
        </button>
        {onSelect && (
          <button 
            disabled={isSelected}
            onClick={() => onSelect(expert.id)}
            className={`flex items-center justify-center gap-2 py-3 ${isSelected ? 'bg-secondary text-white' : 'bg-primary text-white'} text-[8px] font-bold uppercase tracking-[0.2em] rounded-xl shadow-lg hover:scale-[1.02] transition-all`}
          >
            {isSelected ? <><CheckCircle2 className="w-3 h-3" /> Selected</> : 'Select Expert'}
          </button>
        )}
      </div>
    </div>
  </motion.div>
);

import { useMatching } from '../../contexts/MatchingContext';

export const MatchingEngine = () => {
  const navigate = useNavigate();
  const { 
    input, setInput, loading, result, error, handleMatch, selectExpert, resetMatching
  } = useMatching();

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = sessionStorage.getItem('match_engine_chat');
    return saved ? JSON.parse(saved) : [];
  });
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('match_engine_chat', JSON.stringify(chatMessages));
  }, [chatMessages]);

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: Date.now()
    };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const chatPrompt = newMessages.map((m: any) => `${m.role}: ${m.content}`).join('\n');
      const response = await generateContent({
        model: "gemini-2.5-flash",
        contents: `
          You are the SWYN Match Expert Synthesis Assistant. Help the user define their requirements for searching a fractional expert pool.
          Recent Conversation: ${chatPrompt}
          Keep it professional, brief, and highly strategic. Aim to extract "Problem Statement", "Stage", and "Expertise".
        `
      });
      
      setChatMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || "I'm sorry, I'm having trouble processing that right now.",
        timestamp: Date.now()
      }]);
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  const handleApplyChatToInput = () => {
    const lastAssistantMsg = [...chatMessages].reverse().find(m => m.role === 'assistant');
    if (lastAssistantMsg) {
      setInput(prev => prev + (prev ? '\n\n' : '') + lastAssistantMsg.content);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-slate-50">
      {/* Configuration Sidebar */}
      <aside className="lg:w-[450px] w-full bg-white border-r border-slate-200 flex flex-col p-4 md:p-8 gap-8 overflow-y-auto max-h-[40vh] lg:max-h-full">
        <section>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-light text-slate-800 tracking-tight">Requirement Logic</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Input Client Constraints // Operational Analysis</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                title="View History"
                onClick={() => navigate('/chat')}
                className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"
              >
                <History className="w-4 h-4" />
              </button>
              <button 
                onClick={() => { setInput(''); resetMatching(); }}
                className="p-2 hover:bg-slate-50 rounded-lg text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="relative group">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ex: I need a fractional CTO for an AI startup..."
                className="w-full min-h-[160px] p-5 bg-slate-50 border border-slate-200 rounded-2xl text-sm leading-relaxed text-slate-600 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all resize-none shadow-inner"
              />
            </div>

            <button
              onClick={() => handleMatch()}
              disabled={loading || !input.trim()}
              className="w-full bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-primary transition-all disabled:opacity-50 shadow-xl shadow-slate-200"
            >
              {loading ? (
                <>Synthesizing <Loader2 className="w-4 h-4 animate-spin" /></>
              ) : (
                <>Initiate Core Engine <Zap className="w-4 h-4" /></>
              )}
            </button>
          </div>
        </section>

        {/* AI Analysis View */}
        <AnimatePresence>
          {result && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-6 pt-6 border-t border-slate-100"
            >
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <BrainCircuit className="w-3 h-3 text-primary" /> AI Semantic Decomposition
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Role', value: result.analysis.expertiseNeeded, icon: Users },
                  { label: 'Industry', value: result.analysis.industry, icon: BarChart3 },
                  { label: 'Stage', value: result.analysis.stage, icon: Dna }
                ].map((item) => (
                  <div key={item.label} className="p-3 bg-slate-50 rounded-xl border border-slate-100 group transition-colors hover:border-primary-light">
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon className="w-3 h-3 text-slate-300 group-hover:text-primary transition-colors" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{item.label}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-700 truncate">{item.value || 'N/A'}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {result.analysis.problemStatement?.map(p => (
                  <span key={p} className="px-3 py-1 bg-primary-light/30 text-primary rounded-lg text-[10px] font-bold uppercase tracking-tight border border-primary-light">
                    {p}
                  </span>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Chatbot Interface */}
        <section className="mt-auto flex flex-col min-h-[350px] border-t border-slate-100 pt-8">
           <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <MessageSquare className="w-3 h-3 text-primary" /> Synthesis Assistant
             </div>
             {chatMessages.length > 0 && (
               <button 
                 onClick={handleApplyChatToInput}
                 className="text-[10px] font-bold text-primary uppercase tracking-wider hover:underline"
               >
                 Apply to Requirements
               </button>
             )}
           </div>
           
           <div className="flex-1 bg-slate-50/50 rounded-2xl p-4 overflow-y-auto space-y-4 mb-4 border border-slate-100/50 max-h-[300px] scrollbar-hide">
              {chatMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-3 opacity-40">
                  <Bot className="w-8 h-8 text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">Discuss requirements with AI to refine the search parameters.</p>
                </div>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                   <div className="bg-white border border-slate-100 p-3 rounded-2xl flex items-center gap-2">
                     <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                     <span className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                     <span className="w-1 h-1 bg-primary rounded-full animate-bounce"></span>
                   </div>
                </div>
              )}
           </div>

           <div className="relative">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                placeholder="Ask me anything about this search..."
                className="w-full px-5 py-4 bg-white border border-slate-200 rounded-2xl text-xs focus:ring-4 focus:ring-primary/10 outline-none pr-12 shadow-sm transition-all"
              />
              <button 
                onClick={handleChat}
                disabled={chatLoading || !chatInput.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                <Send className="w-4 h-4" />
              </button>
           </div>
        </section>
      </aside>

      {/* Results Main Area */}
      <section className="flex-1 p-6 md:p-12 overflow-y-auto bg-[radial-gradient(#f1f5f9_1px,transparent_1px)] [background-size:24px_24px]">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 bg-red-50 border border-red-100 rounded-3xl mb-8 flex items-start gap-4"
            >
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-sm font-bold text-red-800 uppercase tracking-widest mb-1">Synthesis Halted</h3>
                <p className="text-xs text-red-600 leading-relaxed font-medium">{error}</p>
                <button 
                  onClick={() => handleMatch()}
                  className="mt-3 text-[10px] font-black text-red-700 uppercase tracking-widest hover:underline"
                >
                  Retry Protocol
                </button>
              </div>
            </motion.div>
          )}

          {!result && !loading && !error && (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto"
            >
              <div className="w-16 h-16 md:w-24 md:h-24 bg-white shadow-2xl shadow-slate-200 rounded-[2rem] md:rounded-[2.5rem] flex items-center justify-center mb-10 rotate-6 border border-slate-50 relative">
                <div className="absolute inset-0 bg-primary/5 blur-xl rounded-full scale-150 animate-pulse"></div>
                <Search className="w-6 h-6 md:w-10 md:h-10 text-slate-200 -rotate-6 relative z-10" />
              </div>
              <h2 className="text-2xl md:text-3xl font-light text-slate-800 mb-4 tracking-tight">Expert Synthesis</h2>
              <p className="text-slate-500 leading-relaxed text-xs md:text-sm font-medium">Input your business constraints to initiate the semantic reranking engine.</p>
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              {[1, 2, 3].map(i => (
                <div key={i} className="h-48 md:h-64 bg-white rounded-3xl border border-slate-100 animate-pulse shadow-sm flex flex-col p-6 md:p-8 gap-4">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 rounded-full" />
                      <div className="w-24 md:w-32 h-4 bg-slate-50 rounded" />
                   </div>
                   <div className="w-full h-16 md:h-24 bg-slate-50 rounded-xl" />
                </div>
              ))}
            </motion.div>
          )}

          {result && !loading && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 md:space-y-12"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                  <h2 className="text-3xl md:text-4xl font-light text-slate-800 tracking-tight">Match Vectors</h2>
                  <p className="text-slate-400 mt-2 font-bold tracking-[0.15em] text-[10px] uppercase">Discovered {result.matches.length} candidates meeting internal threshold</p>
                </div>
                <div className="flex gap-2 md:gap-4 w-full md:w-auto">
                   <button 
                    onClick={() => navigate('/chat')}
                    className="flex-1 md:flex-none px-4 md:px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-sm hover:ring-4 hover:ring-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-3 h-3" /> History
                  </button>
                  <button className="flex-1 md:flex-none px-4 md:px-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-sm hover:ring-4 hover:ring-slate-50 transition-all">
                    Export
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-8 max-w-4xl">
                {result.matches.map((expert: Expert, idx: number) => (
                  <MatchCard 
                    key={expert.id} 
                    expert={expert} 
                    index={idx} 
                    onSelect={selectExpert}
                    isSelected={result.selectedExpertId === expert.id}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
};
