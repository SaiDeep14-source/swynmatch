import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  Search, 
  MessageSquare, 
  Calendar,
  Users,
  Target,
  ChevronRight,
  BrainCircuit,
  Loader2,
  Trash2,
  Zap
} from 'lucide-react';
import { Expert } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useMatching } from '../../contexts/MatchingContext';

interface MatchHistoryEntry {
  id: string;
  input: string;
  analysis: any;
  matches: Expert[];
  timestamp: number;
  chatHistory: any[];
  selectedExpertId?: string | null;
}

export const ExpertSynthesis = () => {
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { restoreSession } = useMatching();

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'matches'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MatchHistoryEntry[];
      setHistory(historyData);
      setLoading(false);
    }, (error) => {
      console.error("Match history error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRestore = (entry: MatchHistoryEntry) => {
    restoreSession(entry);
    sessionStorage.setItem('match_engine_chat', JSON.stringify(entry.chatHistory || []));
    navigate('/match');
  };

  return (
    <div className="p-10 max-w-7xl mx-auto pb-24">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-5xl font-light text-slate-800 tracking-tight">Expert Synthesis</h1>
          <p className="text-slate-400 mt-3 text-sm font-medium uppercase tracking-widest italic">Temporal Neural Memory // Match History</p>
        </div>
        <button 
          onClick={() => navigate('/match')}
          className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-primary transition-all flex items-center gap-3"
        >
          New Synthesis Protocol <Zap className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accessing Secure Records...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-8 bg-white border border-slate-100 rounded-[3rem] border-dashed">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
            <History className="w-8 h-8" />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-light text-slate-800 mb-2">No Synthesis Records</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto italic">Initiate a match protocol in the Engine to generate your first synthesis vector.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence>
            {history.map((entry, idx) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="group relative bg-white border border-slate-100 rounded-[2rem] p-8 shadow-sm hover:shadow-xl hover:border-primary-light transition-all cursor-pointer overflow-hidden"
                onClick={() => handleRestore(entry)}
              >
                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-opacity">
                   <ChevronRight className="w-6 h-6 text-primary" />
                </div>
                
                <div className="flex flex-wrap items-start gap-8">
                  <div className="flex-1 min-w-[300px]">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Synthesis Vector</div>
                        <div className="text-xs text-slate-300 font-medium">{new Date(entry.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                    
                    <p className="text-sm font-medium text-slate-700 leading-relaxed line-clamp-3 italic bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                      "{entry.input}"
                    </p>

                    <div className="flex gap-4">
                       <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                          <BrainCircuit className="w-3.5 h-3.5 text-primary" />
                          {entry.analysis?.expertiseNeeded || 'General Match'}
                       </div>
                       <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                          <Users className="w-3.5 h-3.5 text-secondary" />
                          {entry.matches.length} Experts Identified
                       </div>
                    </div>
                  </div>

                  <div className="w-full lg:w-auto flex flex-col gap-3 min-w-[200px]">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Top Candidates</div>
                    {entry.matches.slice(0, 3).map((m: any) => {
                      const isSelected = entry.selectedExpertId === m.id;
                      return (
                        <div key={m.id} className={`flex items-center gap-3 p-3 ${isSelected ? 'bg-secondary-light/20 border-secondary-light shadow-sm scale-105' : 'bg-slate-50 border-slate-100'} rounded-xl border transition-all`}>
                          <div className={`w-6 h-6 ${isSelected ? 'bg-secondary text-white' : 'bg-white text-slate-400'} rounded-full flex items-center justify-center text-[8px] font-black border border-slate-200`}>
                            {m.name?.[0]}
                          </div>
                          <span className={`text-[10px] font-bold ${isSelected ? 'text-secondary-dark' : 'text-slate-600'} truncate`}>{m.name}</span>
                          <span className={`ml-auto text-[9px] font-black ${isSelected ? 'text-secondary' : 'text-primary'}`}>{m.matchDetails?.score}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-6 border-t border-slate-50 pt-6">
                   <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                     <MessageSquare className="w-3 h-3" />
                     {entry.chatHistory?.length || 0} Refinement Interactions
                   </div>
                   <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                     Restore Session Pattern
                   </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
