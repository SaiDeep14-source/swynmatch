import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Sparkles, 
  Loader2, 
  ArrowRight, 
  Star, 
  ShieldCheck, 
  Zap, 
  X, 
  Check, 
  Building, 
  DollarSign, 
  MapPin, 
  Briefcase, 
  Phone,
  AlertCircle,
  FileText,
  Users
} from 'lucide-react';
import SwynLogo from './SwynLogo';
import { authFetch } from '../lib/api';
interface Expert {
  id: string;
  name: string;
  expertise: string;
  summary: string;
  rating?: number;
  hourlyRate?: number;
  availability?: string;
  matchScore?: number;
  whyTheyFit?: string;
  potentialGaps?: string;
  industry?: string;
  experience?: string;
  customFields?: Record<string, string>;
}

const MatchEngine: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isMatching, setIsMatching] = useState(false);
  const [matches, setMatches] = useState<Expert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState('');

  // Match Confirmation Modal States
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientIndustry, setClientIndustry] = useState('');
  const [clientLocation, setClientLocation] = useState('');
  const [clientBudget, setClientBudget] = useState('');
  const [clientPreferredRole, setClientPreferredRole] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Profile Drawer States
  const [activeProfile, setActiveProfile] = useState<Expert | null>(null);

  const handleMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsMatching(true);
    setError(null);
    setMatches([]);
    setSearchedQuery('');

    try {
      const token = localStorage.getItem('token');
      const response = await authfetch('/api/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) throw new Error('Matching engine failed to process request.');
      const data = await response.json();
      setMatches(data);
      setSearchedQuery(query);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsMatching(false);
    }
  };

  const openConfirmation = (expert: Expert) => {
    setSelectedExpert(expert);
    setClientName('');
    setClientContact('');
    setClientIndustry('');
    setClientLocation('');
    setClientBudget('');
    setClientPreferredRole(expert.expertise || 'Consulting Advisory');
    setSaveSuccess(false);
    setError(null);
  };

  const handleSaveMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpert) return;

    setIsSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      const response = await authFetch('/api/matches/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          expertId: selectedExpert.id,
          expertName: selectedExpert.name,
          expertRole: selectedExpert.expertise,
          clientName,
          clientContact,
          clientIndustry,
          clientLocation,
          clientBudget,
          clientPreferredRole,
          clientRequirements: query || searchedQuery
        })
      });

      if (!response.ok) throw new Error('Could not record match interaction.');
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSelectedExpert(null);
        setSaveSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Central Search Card - Styled with Premium Swyn Brand Gradients & High Contrast Elements */}
      <div className="bg-gradient-to-br from-white via-white to-swyn-goldLight/20 p-12 rounded-3xl border border-swyn-orange/20 shadow-sm text-center relative overflow-hidden">
        {/* Subtle grid pattern background overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#F05A28 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="max-w-2xl mx-auto space-y-6 relative z-10">
          <div className="flex justify-center mb-1">
            <SwynLogo size={40} />
          </div>
          
          <p className="text-gray-500 text-sm font-semibold max-w-md mx-auto">
            Find the perfect expert based on your specific requirements with our high-efficacy AI match system.
          </p>

          <form onSubmit={handleMatch} className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-swyn-orange/40" />
              <input 
                type="text" 
                placeholder="CEO, CTO, Senior Vice President..."
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50/50 border border-gray-150 focus:border-swyn-orange/40 focus:bg-white rounded-xl outline-none text-sm text-gray-800 placeholder:text-gray-300 font-medium transition-all shadow-inner"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={isMatching || !query.trim()}
              className="bg-swyn-orange hover:bg-swyn-orangeHover text-white px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm"
            >
              {isMatching ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Finding...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Find Matches
                </>
              )}
            </button>
          </form>
        </div>

        {/* Backdrop highlights in real Swyn Colors */}
        <div className="absolute right-0 top-0 w-72 h-72 bg-swyn-orange rounded-full -mr-24 -mt-24 blur-3xl opacity-10 pointer-events-none"></div>
        <div className="absolute left-0 bottom-0 w-72 h-72 bg-swyn-gold rounded-full -ml-24 -mb-24 blur-3xl opacity-15 pointer-events-none"></div>
      </div>

      {/* Target Results Area - Styled exactly like Image 4 */}
      <AnimatePresence>
        {matches.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 pt-2"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 tracking-tight">
                Top matches for "{searchedQuery}"
              </h3>
              <span className="text-xs font-semibold text-gray-400 capitalize bg-gray-100 rounded-full px-3 py-1">
                {matches.length} Results
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {matches.map((expert) => {
                const initial = expert.name ? expert.name[0].toUpperCase() : 'E';
                const matchScore = expert.matchScore || 95;
                const whyTheyFit = expert.whyTheyFit || "Explicitly aligned executive with proven oversight in the requested domain.";
                const potentialGaps = expert.potentialGaps || "Expertise is primarily within established enterprises; may require adjustments to agile systems.";
                const industryText = expert.industry || expert.expertise || "Management & Strategy";
                const experienceText = expert.experience || expert.availability || "25+ years";

                return (
                  <motion.div 
                    key={expert.id}
                    className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Card Header section */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3.5">
                          <div className="w-12 h-12 rounded-full bg-swyn-goldLight border border-swyn-goldMedium/30 flex items-center justify-center text-swyn-goldDark font-bold text-base shadow-sm shrink-0">
                            {initial}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 text-lg leading-snug">{expert.name}</h4>
                            <p className="text-xs font-bold text-swyn-orange mt-0.5 uppercase tracking-wide">
                              {expert.expertise}
                            </p>
                          </div>
                        </div>
                        <span className="bg-gradient-to-r from-emerald-50 to-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-full px-3 py-1 shadow-sm shrink-0">
                          {matchScore}% Match
                        </span>
                      </div>

                      {/* Attribute Badges */}
                      <div className="flex flex-wrap gap-x-4 gap-y-2 mb-6 border-b border-gray-50 pb-4 text-xs font-semibold text-gray-500">
                        <div className="flex items-center">
                          <Building className="w-4 h-4 mr-1.5 text-gray-450" />
                          <span>{industryText}</span>
                        </div>
                        <div className="flex items-center">
                          <Briefcase className="w-4 h-4 mr-1.5 text-gray-450" />
                          <span>{experienceText}</span>
                        </div>
                      </div>

                      {/* Explanations columns */}
                      <div className="space-y-4 mb-6">
                        {/* Why they fit */}
                        <div className="space-y-1.5">
                          <div className="flex items-center text-emerald-700 text-xs font-bold uppercase tracking-wider">
                            <Check className="w-4 h-4 mr-1.5 stroke-[3] text-emerald-600" />
                            WHY THEY FIT
                          </div>
                          <div className="border-l-2 border-emerald-500/30 pl-3.5 text-xs text-gray-650 font-medium leading-relaxed">
                            {whyTheyFit}
                          </div>
                        </div>

                        {/* Potential Gaps */}
                        <div className="space-y-1.5">
                          <div className="flex items-center text-red-650 text-xs font-bold uppercase tracking-wider">
                            <AlertCircle className="w-4 h-4 mr-1.5 text-red-500" />
                            POTENTIAL GAPS
                          </div>
                          <div className="border-l-2 border-orange-500/30 pl-3.5 text-xs text-gray-650 font-medium leading-relaxed">
                            {potentialGaps}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center gap-3 border-t border-gray-50 pt-4 mt-auto">
                      <button 
                        onClick={() => setActiveProfile(expert)}
                        className="flex-1 py-2.5 px-4 text-xs font-bold text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl transition-all text-center"
                      >
                        View Full Profile
                      </button>
                      <button 
                        onClick={() => openConfirmation(expert)}
                        className="flex-grow-[1.5] py-2.5 px-4 bg-swyn-orange hover:bg-swyn-orangeHover text-white text-xs font-bold rounded-xl transition-all text-center shadow-sm"
                      >
                        Select Expert
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Match Record Modal */}
      <AnimatePresence>
        {selectedExpert && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl relative border border-gray-100 overflow-hidden"
            >
              <button 
                onClick={() => setSelectedExpert(null)}
                className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {saveSuccess ? (
                <div className="py-16 text-center space-y-4">
                  <div className="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Check className="w-10 h-10 stroke-[3]" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Match Confirmed</h3>
                  <p className="text-gray-500 text-sm max-w-xs mx-auto">This project requirement has been locked to {selectedExpert.name} and saved to your Match History.</p>
                </div>
              ) : (
                <form onSubmit={handleSaveMatch} className="space-y-6">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 leading-tight">Match Expert</h3>
                    <p className="text-xs font-semibold text-gray-450 uppercase tracking-widest mt-1">Record Match Agreement</p>
                  </div>

                  <div className="bg-gradient-to-r from-swyn-goldLight to-amber-50/50 p-4 rounded-xl flex items-center space-x-3.5 border border-swyn-goldMedium/20">
                    <div className="w-12 h-12 bg-swyn-gold border border-swyn-goldMedium/30 text-white flex items-center justify-center font-bold text-base rounded-full">
                      {selectedExpert.name[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{selectedExpert.name}</h4>
                      <p className="text-xs font-bold text-swyn-orange uppercase tracking-tight">{selectedExpert.expertise}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Client Company / Name</label>
                      <div className="relative">
                        <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Acme Corp" 
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-150 focus:outline-none focus:ring-2 focus:ring-swyn-orange focus:border-swyn-orange focus:bg-white rounded-xl text-xs font-semibold transition-all"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Primary Contact (Email/Phone)</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. contact@acme.com" 
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-150 focus:outline-none focus:ring-2 focus:ring-swyn-orange focus:border-swyn-orange focus:bg-white rounded-xl text-xs font-semibold transition-all"
                          value={clientContact}
                          onChange={(e) => setClientContact(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Client Industry</label>
                      <div className="relative">
                        <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="e.g. Fintech" 
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-150 focus:outline-none focus:ring-2 focus:ring-swyn-orange focus:border-swyn-orange focus:bg-white rounded-xl text-xs font-semibold transition-all"
                          value={clientIndustry}
                          onChange={(e) => setClientIndustry(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Budget Allocation</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="e.g. $10,000 / project" 
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-150 focus:outline-none focus:ring-2 focus:ring-swyn-orange focus:border-swyn-orange focus:bg-white rounded-xl text-xs font-semibold transition-all"
                          value={clientBudget}
                          onChange={(e) => setClientBudget(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Target Location / Mode</label>
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="e.g. New York / Remote" 
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-150 focus:outline-none focus:ring-2 focus:ring-swyn-orange focus:border-swyn-orange focus:bg-white rounded-xl text-xs font-semibold transition-all"
                          value={clientLocation}
                          onChange={(e) => setClientLocation(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Scope / Preferred Role</label>
                      <div className="relative">
                        <Zap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                          type="text" 
                          placeholder="e.g. Technology Advisory" 
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-150 focus:outline-none focus:ring-2 focus:ring-swyn-orange focus:border-swyn-orange focus:bg-white rounded-xl text-xs font-semibold transition-all"
                          value={clientPreferredRole}
                          onChange={(e) => setClientPreferredRole(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSaving}
                    className="w-full py-3 bg-swyn-orange hover:bg-swyn-orangeHover text-white font-bold text-sm rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center mt-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Confirming & Logging...
                      </>
                    ) : (
                      "Lock and Save Match"
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Profile Detail Drawer Card */}
      <AnimatePresence>
        {activeProfile && (
          <div className="fixed inset-0 bg-gray-900/65 backdrop-blur-sm flex items-center justify-end z-50">
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white h-screen max-w-md w-full p-8 shadow-2xl relative border-l border-gray-100 flex flex-col justify-between overflow-y-auto"
            >
              <div>
                <button 
                  onClick={() => setActiveProfile(null)}
                  className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="space-y-6 pt-4">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-swyn-goldLight border border-swyn-goldMedium/35 text-swyn-goldDark font-bold text-2xl rounded-full flex items-center justify-center mx-auto mb-4 italic shadow-sm">
                      {activeProfile.name ? activeProfile.name[0] : 'E'}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 leading-tight">{activeProfile.name}</h3>
                    <p className="text-xs font-bold text-swyn-orange uppercase tracking-widest mt-1">
                      {activeProfile.expertise}
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Expert Overview</span>
                    <p className="text-xs text-gray-500 leading-relaxed font-semibold">
                      {activeProfile.summary}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Availability</span>
                    <div className="p-3 bg-gray-50 rounded-xl flex items-center text-xs font-bold text-gray-600">
                      <Zap className="w-4 h-4 mr-2 text-amber-500 shrink-0" />
                      {activeProfile.availability || "Mon - Fri, Flexible Schedule"}
                    </div>
                  </div>

                  {/* Comprehensive Spreadsheet or Fallback Sheet Details */}
                  {(() => {
                    const fields = activeProfile.customFields && Object.keys(activeProfile.customFields).length > 0 
                      ? activeProfile.customFields 
                      : {
                          "Name": activeProfile.name,
                          "Expertise / Designation": activeProfile.expertise,
                          "Professional Overview": activeProfile.summary,
                          "Availability Schedule": activeProfile.availability || "Flexible Schedule",
                          "Primary Sector / Industry": activeProfile.industry || "General Consulting",
                          "Experience Level": activeProfile.experience || "20+ Years"
                        };

                    return (
                      <div className="space-y-3 pt-5 border-t border-gray-150">
                        <div className="flex items-center gap-2">
                          <span className="p-1 px-2 rounded-md bg-orange-50 text-orange-600 font-bold text-[9px] uppercase tracking-wider">Sheet Roster Details</span>
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">All Column Answers</span>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5">
                          {Object.entries(fields).map(([key, value]) => {
                            if (!value || String(value).trim() === "") return null;

                            return (
                              <div key={key} className="p-3 bg-gray-50/60 border border-gray-100 rounded-xl transition-all hover:bg-gray-50 text-left">
                                <span className="block text-[10px] text-orange-500 font-bold uppercase tracking-wide mb-1">
                                  {key}
                                </span>
                                <span className="text-xs font-semibold text-gray-800 break-words leading-relaxed block whitespace-pre-line animate-fade-in text-left">
                                  {String(value)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="border-t border-gray-50 pt-4 mt-8 flex gap-3">
                <button 
                  onClick={() => {
                    const pr = activeProfile;
                    setActiveProfile(null);
                    openConfirmation(pr);
                  }}
                  className="w-full py-3 bg-swyn-orange hover:bg-swyn-orangeHover text-white font-bold text-xs rounded-xl transition-all shadow-sm text-center"
                >
                  Record Match Agreement
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center text-red-650 text-xs font-bold"
        >
          <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
          {error}
        </motion.div>
      )}
    </div>
  );
};

export default MatchEngine;
