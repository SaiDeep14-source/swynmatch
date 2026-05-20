import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Star,
  CheckCircle,
  Loader2,
  Sparkles,
  Save,
  UserCheck,
  AlertCircle,
  History,
  X,
  ChevronRight
} from 'lucide-react';
import { authFetch } from '../lib/api';

interface MatchResult {
  id: string;
  name: string;
  expertise: string;
  summary: string;
  hourlyRate?: number;
  rating?: number;
  availability?: string;
  industry?: string;
  experience?: string;
  matchScore?: number;
  whyTheyFit?: string;
  potentialGaps?: string;
}

interface SavedMatch {
  id: string;
  expertId: string;
  expertName: string;
  expertRole: string;
  clientName: string;
  clientIndustry: string;
  clientLocation: string;
  clientRequirements: string;
  clientBudget: string;
  clientPreferredRole: string;
  clientContact: string;
  createdAt?: string;
  timestamp?: string;
}

const MatchEngine: React.FC = () => {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [clientName, setClientName] = useState('');
  const [clientIndustry, setClientIndustry] = useState('');
  const [clientLocation, setClientLocation] = useState('');
  const [clientBudget, setClientBudget] = useState('');
  const [clientPreferredRole, setClientPreferredRole] = useState('');
  const [clientContact, setClientContact] = useState('');

  const [history, setHistory] = useState<SavedMatch[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const loadHistory = async () => {
    try {
      const res = await authFetch('/api/matches/history');
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Could not load match history:', err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFindMatches = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!query.trim()) {
      setError('Please enter a requirement before finding matches.');
      return;
    }

    setLoading(true);
    setError('');
    setMatches([]);

    try {
      const res = await authFetch('/api/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to find matches.');
      }

      setMatches(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to find matches.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMatch = async (match: MatchResult) => {
    setSavingId(match.id);

    try {
      const res = await authFetch('/api/matches/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expertId: match.id,
          expertName: match.name,
          expertRole: match.expertise,
          clientName: clientName || 'General Client',
          clientIndustry: clientIndustry || match.industry || 'General',
          clientLocation: clientLocation || 'Remote',
          clientRequirements: query,
          clientBudget: clientBudget || 'Flexible',
          clientPreferredRole: clientPreferredRole || match.expertise,
          clientContact: clientContact || ''
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to save match.');
      }

      setSavedIds(prev => [...prev, match.id]);
      await loadHistory();
    } catch (err: any) {
      setError(err.message || 'Failed to save match.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-20 font-sans">
      <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">AI Match Engine</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1 font-medium">
              Describe the client requirement and get the best expert matches.
            </p>
          </div>

          <button
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl text-xs font-bold text-gray-600 transition-all shadow-sm"
          >
            <History className="w-4 h-4" />
            Match History
          </button>
        </div>

        <form onSubmit={handleFindMatches} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
              className="px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/10"
            />
            <input
              value={clientIndustry}
              onChange={(e) => setClientIndustry(e.target.value)}
              placeholder="Client industry"
              className="px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/10"
            />
            <input
              value={clientLocation}
              onChange={(e) => setClientLocation(e.target.value)}
              placeholder="Client location"
              className="px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/10"
            />
            <input
              value={clientBudget}
              onChange={(e) => setClientBudget(e.target.value)}
              placeholder="Budget"
              className="px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/10"
            />
            <input
              value={clientPreferredRole}
              onChange={(e) => setClientPreferredRole(e.target.value)}
              placeholder="Preferred role"
              className="px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/10"
            />
            <input
              value={clientContact}
              onChange={(e) => setClientContact(e.target.value)}
              placeholder="Client contact"
              className="px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/10"
            />
          </div>

          <div>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={5}
              placeholder="Example: Need a senior retail operations expert for scaling D2C stores across India..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-150 rounded-xl text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-orange-500/10 resize-none"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full md:w-auto px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {loading ? 'Finding Matches...' : 'Find Best Matches'}
          </button>
        </form>
      </div>

      {matches.length > 0 && (
        <div className="space-y-4">
          {matches.map((match, index) => (
            <motion.div
              key={match.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-gray-150 shadow-sm p-5"
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-lg shrink-0">
                    {match.name?.[0] || 'E'}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-gray-900 uppercase tracking-wide">{match.name}</h3>
                      <span className="px-2.5 py-1 bg-green-50 text-green-700 border border-green-100 rounded-full text-[10px] font-bold">
                        {match.matchScore || 90}% Match
                      </span>
                    </div>

                    <p className="text-xs font-bold text-orange-500 uppercase tracking-wider mt-1">
                      {match.expertise}
                    </p>

                    <p className="text-xs text-gray-500 leading-relaxed mt-3 font-medium">
                      {match.summary}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Why they fit
                        </p>
                        <p className="text-xs font-semibold text-gray-700 leading-relaxed">
                          {match.whyTheyFit || 'Strong alignment with the client requirement.'}
                        </p>
                      </div>

                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                          Potential gaps
                        </p>
                        <p className="text-xs font-semibold text-gray-700 leading-relaxed">
                          {match.potentialGaps || 'No major gaps identified.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4 text-[10px] font-bold text-gray-500">
                      {match.industry && (
                        <span className="px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-full">
                          {match.industry}
                        </span>
                      )}
                      {match.experience && (
                        <span className="px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-full">
                          {match.experience}
                        </span>
                      )}
                      {match.availability && (
                        <span className="px-2.5 py-1 bg-gray-50 border border-gray-100 rounded-full">
                          {match.availability}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSaveMatch(match)}
                  disabled={savingId === match.id || savedIds.includes(match.id)}
                  className="px-4 py-2 bg-gray-900 hover:bg-black disabled:bg-green-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0"
                >
                  {savingId === match.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : savedIds.includes(match.id) ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {savedIds.includes(match.id) ? 'Saved' : 'Save Match'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 bg-gray-900/65 backdrop-blur-sm flex items-center justify-end z-50">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white h-screen max-w-lg w-full p-6 shadow-2xl border-l border-gray-150 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Saved Match History</h3>
                  <p className="text-xs text-gray-400 font-medium mt-1">
                    Previously saved expert-client matches.
                  </p>
                </div>
                <button
                  onClick={() => setShowHistory(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {history.length === 0 ? (
                <div className="py-16 text-center">
                  <UserCheck className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                    No saved matches yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <div key={item.id} className="p-4 border border-gray-150 rounded-2xl bg-gray-50/50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-gray-900 text-sm uppercase tracking-wide">
                            {item.expertName}
                          </p>
                          <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider mt-1">
                            {item.expertRole}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                      </div>

                      <div className="mt-3 space-y-1 text-xs font-semibold text-gray-600">
                        <p><span className="text-gray-400">Client:</span> {item.clientName}</p>
                        <p><span className="text-gray-400">Industry:</span> {item.clientIndustry}</p>
                        <p><span className="text-gray-400">Location:</span> {item.clientLocation}</p>
                        <p><span className="text-gray-400">Budget:</span> {item.clientBudget}</p>
                      </div>

                      {item.clientRequirements && (
                        <p className="mt-3 text-xs text-gray-500 leading-relaxed">
                          {item.clientRequirements}
                        </p>
                      )}

                      <p className="mt-3 text-[10px] text-gray-400 font-bold">
                        {new Date(item.createdAt || item.timestamp || Date.now()).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MatchEngine;
