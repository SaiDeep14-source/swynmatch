import React, { useState } from 'react';
import { Expert } from '../types';
import { Search, Brain, AlertCircle, RefreshCw, X, User, ExternalLink, Activity, Target, Briefcase, Building } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authFetch } from '../lib/api';
import SwynLogo from './SwynLogo';

interface Match extends Expert {
  matchPercentage?: number;
  matchReason?: string;
  gaps?: string;
}

export default function MatchEngine({ onMatchSaved }: { onMatchSaved?: () => void }) {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [selectedExpert, setSelectedExpert] = useState<Match | null>(null);
  const [expertToSelect, setExpertToSelect] = useState<Match | null>(null);
  const [searchedQuery, setSearchedQuery] = useState('');
  
  // Client Form State
  const [clientForm, setClientForm] = useState({
    name: '',
    industry: '',
    location: '',
    requirements: '',
    budget: '',
    preferredRole: '',
    contact: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const query = inputValue.trim();
    setSearchedQuery(query);
    setIsLoading(true);
    setError(null);
    setMatches(null);

    try {
      const res = await authFetch('/api/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        let msg = 'Failed to find matches.';
        try {
          const errData = await res.json();
          if (errData.error) msg = errData.error;
        } catch(e) {}
        throw new Error(msg);
      }

      const data = await res.json();
      setMatches(data.matches);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while finding matches. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const openClientForm = (expert: Match) => {
    setExpertToSelect(expert);
    setClientForm(prev => ({ ...prev, requirements: searchedQuery }));
  };

  const handleSaveMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expertToSelect) return;

    setIsSaving(true);
    try {
      const res = await authFetch('/api/matches/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expertId: expertToSelect.id,
          expertName: expertToSelect.name,
          expertRole: expertToSelect.role,
          expertIndustry: expertToSelect.industry,
          clientName: clientForm.name,
          clientIndustry: clientForm.industry,
          clientLocation: clientForm.location,
          clientRequirements: clientForm.requirements,
          clientBudget: clientForm.budget,
          clientPreferredRole: clientForm.preferredRole,
          clientContact: clientForm.contact
        })
      });

      if (res.ok) {
        setExpertToSelect(null);
        if (onMatchSaved) {
          onMatchSaved();
        }
      } else {
        throw new Error('Failed to save match');
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to save match record.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <div className="flex items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
               <SwynLogo className="h-7 w-auto mr-3" />
               SWYNMatch
            </h2>
            <p className="text-gray-500 mt-1">Find the perfect expert based on your specific requirements.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-shadow text-gray-900"
              placeholder="Describe your ideal expert (e.g. Healthcare consultant with supply-chain expertise...)"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="px-6 py-3.5 shrink-0 bg-orange-600 text-white rounded-xl font-medium flex items-center justify-center hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isLoading ? <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> : <Search className="h-5 w-5 mr-2" />}
            {isLoading ? 'Searching...' : 'Find Matches'}
          </button>
        </form>

        {error && (
           <div className="mt-4 text-sm text-red-600 flex items-center px-4 bg-red-50 py-3 rounded-xl border border-red-100">
             <AlertCircle className="h-5 w-5 mr-2" />
             {error}
           </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
             <div className="relative">
                <div className="h-16 w-16 bg-orange-100 rounded-full flex items-center justify-center">
                  <SwynLogo className="h-8 w-auto animate-pulse" />
                </div>
                <div className="absolute -inset-2 rounded-full border-2 border-orange-200 border-t-orange-600 animate-spin"></div>
             </div>
             <p className="text-gray-500 font-medium">Analyzing directory & mapping requirements...</p>
          </div>
        )}

        {!isLoading && matches && (
          <div className="space-y-6 pb-6">
            <h3 className="text-lg font-semibold text-gray-900 px-1">
               {matches.length > 0 ? `Top matches for "${searchedQuery}"` : `No matches found for "${searchedQuery}"`}
            </h3>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {matches.map((match) => (
                <div key={match.id} className="bg-white border text-left border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col group">
                  <div className="p-6 border-b border-gray-100 relative">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-4">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-r from-orange-100 to-amber-100 flex items-center justify-center text-orange-700 font-bold text-xl shrink-0">
                           {match.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-gray-900 group-hover:text-orange-600 transition-colors">{match.name}</h4>
                          <p className="text-gray-500 font-medium text-sm mt-0.5">{match.role || 'Expert'}</p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end">
                         <div className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${match.matchPercentage && match.matchPercentage >= 80 ? 'bg-green-100 text-green-700' : match.matchPercentage && match.matchPercentage >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'}`}>
                           <Target className="h-4 w-4" />
                           {match.matchPercentage}% Match
                         </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 mt-2">
                       {match.industry && (
                         <div className="flex items-center text-sm text-gray-600">
                           <Activity className="h-4 w-4 mr-1.5 text-gray-400" />
                           {match.industry}
                         </div>
                       )}
                       {match.experience && (
                         <div className="flex items-center text-sm text-gray-600">
                           <Briefcase className="h-4 w-4 mr-1.5 text-gray-400" />
                           {match.experience}
                         </div>
                       )}
                    </div>
                  </div>

                  <div className="p-6 bg-gray-50/50 flex-1 space-y-5">
                    <div>
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-green-700 flex items-center mb-2">
                        <Brain className="h-3.5 w-3.5 mr-1.5" /> Why they fit
                      </h5>
                      <p className="text-gray-700 text-sm leading-relaxed">{match.matchReason}</p>
                    </div>
                    
                    {match.gaps && (
                       <div>
                         <h5 className="text-xs font-semibold uppercase tracking-wider text-orange-600 flex items-center mb-2">
                           <AlertCircle className="h-3.5 w-3.5 mr-1.5" /> Potential Gaps
                         </h5>
                         <p className="text-gray-600 text-sm leading-relaxed border-l-2 border-orange-200 pl-3 italic">{match.gaps}</p>
                       </div>
                    )}
                  </div>
                  
                  <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3">
                     <button
                       onClick={() => setSelectedExpert(match)}
                       className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors flex items-center focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1"
                     >
                        View Full Profile
                     </button>
                     <button
                       onClick={() => openClientForm(match)}
                       className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium text-sm transition-colors flex items-center shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1"
                     >
                        Select Expert
                     </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Select Expert / Client Details Form Modal */}
      <AnimatePresence>
        {expertToSelect && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setExpertToSelect(null)} 
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm" 
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-xl border border-gray-100"
              >
                <div className="bg-white px-6 py-6 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center">
                    <Building className="h-5 w-5 mr-2 text-orange-600" /> Client Details
                  </h3>
                  <button 
                    onClick={() => setExpertToSelect(null)}
                    className="text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 p-1 rounded-full"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                
                <form onSubmit={handleSaveMatch}>
                  <div className="px-6 py-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                      <input 
                        required
                        type="text" 
                        value={clientForm.name}
                        onChange={(e) => setClientForm({...clientForm, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm"
                        placeholder="e.g. Acme Corp"
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contact Details</label>
                        <input 
                          type="text" 
                          value={clientForm.contact}
                          onChange={(e) => setClientForm({...clientForm, contact: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm"
                          placeholder="Email or Phone"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                        <input 
                          type="text" 
                          value={clientForm.location}
                          onChange={(e) => setClientForm({...clientForm, location: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm"
                          placeholder="e.g. New York, NY"
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                        <input 
                          type="text" 
                          value={clientForm.industry}
                          onChange={(e) => setClientForm({...clientForm, industry: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm"
                          placeholder="e.g. Healthcare"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Role</label>
                        <input 
                          type="text" 
                          value={clientForm.preferredRole}
                          onChange={(e) => setClientForm({...clientForm, preferredRole: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm"
                          placeholder="e.g. Advisor"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                      <input 
                        type="text" 
                        value={clientForm.budget}
                        onChange={(e) => setClientForm({...clientForm, budget: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm"
                        placeholder="e.g. $5,000/mo"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Requirements</label>
                      <textarea 
                        rows={3}
                        value={clientForm.requirements}
                        onChange={(e) => setClientForm({...clientForm, requirements: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm"
                        placeholder="Enter full requirements..."
                      />
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row-reverse border-t border-gray-200 gap-3">
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="inline-flex w-full justify-center rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 sm:w-auto focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save Match'}
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => setExpertToSelect(null)}
                      className="inline-flex w-full justify-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedExpert && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedExpert(null)} 
                className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity backdrop-blur-sm" 
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-3xl border border-gray-100"
              >
                <div className="bg-gradient-to-r from-orange-600 to-amber-600 px-6 py-8 sm:px-10 relative">
                  <button 
                    onClick={() => setSelectedExpert(null)}
                    className="absolute top-4 right-4 text-white hover:text-gray-200 bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="flex items-center">
                    <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center text-orange-600 text-3xl font-bold shadow-md shrink-0">
                       {selectedExpert.name.charAt(0)}
                    </div>
                    <div className="ml-6">
                      <h2 className="text-3xl font-bold text-white">{selectedExpert.name}</h2>
                      <p className="text-orange-100 mt-2 text-lg font-medium">{selectedExpert.role || 'No Role Specified'}</p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-6 sm:px-10 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-8">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-xl border border-gray-100">
                       <div>
                         <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Industry</span>
                         <span className="text-gray-900 font-medium">{selectedExpert.industry || 'Not specified'}</span>
                       </div>
                       <div>
                         <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Experience</span>
                         <span className="text-gray-900 font-medium">{selectedExpert.experience || 'Not specified'}</span>
                       </div>
                       <div className="sm:col-span-2">
                         <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Contact</span>
                         {selectedExpert.email ? (
                           <a href={`mailto:${selectedExpert.email}`} className="text-orange-600 hover:text-orange-800 font-medium">{selectedExpert.email}</a>
                         ) : (
                           <span className="text-gray-500">Not specified</span>
                         )}
                       </div>
                    </div>

                    {/* Bio/Notes */}
                    {selectedExpert.notes && (
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center"><User className="h-5 w-5 mr-2 text-orange-600" /> Professional Summary</h3>
                        <div className="prose prose-sm max-w-none text-gray-600 bg-white border border-gray-100 p-6 rounded-xl leading-relaxed whitespace-pre-wrap">
                          {selectedExpert.notes}
                        </div>
                      </div>
                    )}
                    
                    {/* Metadata */}
                    {selectedExpert.metadata && Object.keys(selectedExpert.metadata).length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center bg-gray-50 px-4 py-2 rounded-lg"><Activity className="h-5 w-5 mr-2 text-orange-600" /> Additional Details</h3>
                        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 px-2">
                          {Object.entries(selectedExpert.metadata).map(([key, value]) => {
                            if (!value) return null;
                            const isUrl = typeof value === 'string' && value.startsWith('http');
                            return (
                              <div key={key} className="border-b border-gray-100 pb-3">
                                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">{key}</dt>
                                <dd className="mt-1 text-sm text-gray-900">
                                  {isUrl ? (
                                    <a href={value as string} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline flex items-center inline-flex">
                                      View Link <ExternalLink className="h-3 w-3 ml-1" />
                                    </a>
                                  ) : (
                                    String(value)
                                  )}
                                </dd>
                              </div>
                            );
                          })}
                        </dl>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 sm:flex sm:flex-row-reverse sm:px-10 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setSelectedExpert(null)}
                    className="mt-3 inline-flex w-full justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
