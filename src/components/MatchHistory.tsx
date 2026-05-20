import React, { useState, useEffect } from 'react';
import { MatchRecord } from '../types';
import { History, User, Building, MapPin, Briefcase, DollarSign, Calendar, Target, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authFetch } from '../lib/api';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';

export default function MatchHistory() {
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [experts, setExperts] = useState<any[]>([]);
  const [activeProfile, setActiveProfile] = useState<any | null>(null);

  useEffect(() => {
    fetchHistory();
    fetchExperts();
  }, []);

  const fetchExperts = async () => {
    try {
      const snap = await getDocs(collection(db, "experts"));
      if (!snap.empty) {
        setExperts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        const res = await authFetch('/api/experts');
        if (res.ok) {
          const data = await res.json();
          setExperts(Array.isArray(data) ? data : (data.experts || []));
        }
      }
    } catch (e) {
      console.error(e);
      // Fallback
      try {
        const res = await authFetch('/api/experts');
        if (res.ok) {
          const data = await res.json();
          setExperts(Array.isArray(data) ? data : (data.experts || []));
        }
      } catch (err) {}
    }
  };

  const fetchHistory = async () => {
    try {
      let dbMatches: MatchRecord[] = [];
      const user = auth.currentUser;
      if (user) {
        try {
          const q = query(
            collection(db, "matches"), 
            where("userId", "==", user.uid)
          );
          const snap = await getDocs(q);
          
          if (!snap.empty) {
             const docs = snap.docs.map(d => ({id: d.id, ...d.data()} as MatchRecord));
             dbMatches = docs.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          }
        } catch (dbErr) {
          console.warn("Client side fetch history warning:", dbErr);
        }
      }
      
      const res = await authFetch('/api/matches/history');
      let apiMatches: MatchRecord[] = [];
      if (res.ok) {
        apiMatches = await res.json();
      }
      
      const mergedMap = new Map();
      apiMatches.forEach(m => mergedMap.set(m.id || m.createdAt, m));
      dbMatches.forEach(m => mergedMap.set(m.id || m.createdAt, m));
      
      const mergedList = Array.from(mergedMap.values()).sort((a: any, b: any) => {
        const dateA = new Date(a.createdAt || a.timestamp || 0).getTime();
        const dateB = new Date(b.createdAt || b.timestamp || 0).getTime();
        return dateB - dateA;
      });
      
      setHistory(mergedList);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (record: MatchRecord, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const id = record.id || `${record.expertId}-${record.createdAt || record.timestamp}`;
    
    // Always fallback for visual update FIRST for responsiveness
    setHistory(prev => prev.filter(r => {
      const rId = r.id || `${r.expertId}-${r.createdAt || r.timestamp}`;
      return rId !== id;
    }));

    if (id) {
      try {
        const user = auth.currentUser;
        if (user) {
          try {
            await deleteDoc(doc(db, "matches", id));
          } catch (fErr) {
            console.warn("Firestore delete failed", fErr);
          }
        }
        await authFetch(`/api/matches/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch (err) {
        console.error("Failed to delete match", err);
      }
    }
  };

  const handleClearAll = async () => {
    try {
      const res = await authFetch('/api/matches', { method: 'DELETE' });
      if (res.ok) {
        setHistory([]);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error("Failed to clear matches", err);
      setHistory([]);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5 pt-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <History className="h-6 w-6 mr-2 text-orange-600" />
            Match History
            <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
              {history.length} {history.length === 1 ? 'Record' : 'Records'}
            </span>
          </h2>
          <p className="text-gray-500 mt-1">Review previously matched experts and client requirements.</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear All History
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="h-8 w-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-200 border-dashed">
            <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No match history yet</h3>
            <p className="text-gray-500 mt-1 max-w-sm mx-auto">
              Matches you select in the Match Engine will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6 pb-8">
            {history.map((record) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={record.id || `${record.expertId}-${record.createdAt || record.timestamp}`}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative group"
              >
                <button
                  onClick={(e) => handleDelete(record, e)}
                  style={{ zIndex: 50 }}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-100"
                  aria-label="Delete match record"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <div className="p-6">
                  <div className="flex flex-col md:flex-row gap-8">
                    {/* Client Section */}
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center pb-3 border-b border-gray-100">
                        <Building className="h-5 w-5 text-gray-400 mr-2" />
                        <h3 className="text-lg font-bold text-gray-900">Client Info</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Name</p>
                          <p className="text-sm font-medium text-gray-900 mt-0.5">{record.clientName}</p>
                        </div>
                        {record.clientContact && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</p>
                            <p className="text-sm text-gray-900 mt-0.5">{record.clientContact}</p>
                          </div>
                        )}
                        {record.clientIndustry && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Industry</p>
                            <p className="text-sm text-gray-900 mt-0.5">{record.clientIndustry}</p>
                          </div>
                        )}
                        {record.clientLocation && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center">
                              <MapPin className="h-3 w-3 mr-1" /> Location
                            </p>
                            <p className="text-sm text-gray-900 mt-0.5">{record.clientLocation}</p>
                          </div>
                        )}
                        {record.clientBudget && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center">
                              <DollarSign className="h-3 w-3 mr-1" /> Budget
                            </p>
                            <p className="text-sm text-gray-900 mt-0.5">{record.clientBudget}</p>
                          </div>
                        )}
                        {record.clientPreferredRole && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center">
                              <Briefcase className="h-3 w-3 mr-1" /> Preferred Role
                            </p>
                            <p className="text-sm text-gray-900 mt-0.5">{record.clientPreferredRole}</p>
                          </div>
                        )}
                      </div>
                      
                      {record.clientRequirements && (
                        <div className="mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Requirements / Details</p>
                          <p className="text-sm text-gray-800 break-words">{record.clientRequirements}</p>
                        </div>
                      )}
                    </div>

                    {/* Divider */}
                    <div className="hidden md:block w-px bg-gray-200"></div>

                    {/* Matched Expert Section */}
                    <div className="md:w-1/3 space-y-4">
                      <div className="flex items-center pb-3 border-b border-gray-100">
                        <Target className="h-5 w-5 text-orange-500 mr-2" />
                        <h3 className="text-lg font-bold text-gray-900">Matched Expert</h3>
                      </div>
                      
                      <div className="flex items-start gap-3 pt-2">
                        <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold shrink-0">
                          {record.expertName ? record.expertName.charAt(0) : 'E'}
                        </div>
                        <div>
                          <p className="text-base font-bold text-gray-900">{record.expertName || 'Unknown Expert'}</p>
                          <p className="text-sm text-gray-600">{record.expertRole || 'Expert'}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const found = experts.find(e => {
                                if (e.id && record.expertId && e.id === record.expertId) return true;
                                if (e.name && record.expertName && String(e.name).toLowerCase() === String(record.expertName).toLowerCase()) return true;
                                if (e.customFields && e.customFields["Name"] && record.expertName && String(e.customFields["Name"]).toLowerCase() === String(record.expertName).toLowerCase()) return true;
                                return false;
                              });
                              if (found) {
                                setActiveProfile(found);
                              } else {
                                // Fallback: just use the record data if the expert is no longer in the roster
                                setActiveProfile({
                                  name: record.expertName || "Unknown Expert",
                                  expertise: record.expertRole || "Expert",
                                  summary: "This expert is no longer in the active directory roster. Limited details available. Try re-syncing the Google Sheet.",
                                  customFields: {
                                    "Message": "Details unavailable because the latest Sheet sync did not contain an expert matching this name."
                                  }
                                });
                              }
                            }}
                            className="mt-2 text-xs font-bold text-swyn-orange hover:text-swyn-orangeHover transition-colors border-b border-transparent hover:border-swyn-orangeHover"
                          >
                            View Full Profile
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 text-xs text-gray-500 flex items-center border-t border-gray-100 pt-4">
                        <Calendar className="h-4 w-4 mr-1.5" /> 
                        Matched on {new Date(record.createdAt).toLocaleDateString(undefined, {
                           year: 'numeric',
                           month: 'long',
                           day: 'numeric',
                           hour: '2-digit',
                           minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {activeProfile && (
          <div className="fixed inset-0 bg-gray-900/65 backdrop-blur-sm flex items-center justify-end z-50">
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="bg-white h-screen max-w-md w-full p-8 shadow-2xl relative border-l border-gray-150 flex flex-col justify-between overflow-y-auto"
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
                    <div className="w-20 h-20 bg-orange-100/70 border border-orange-200/20 text-orange-600 font-bold text-2xl rounded-full flex items-center justify-center mx-auto mb-4 italic shadow-sm">
                      {activeProfile.name ? activeProfile.name[0] : 'E'}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 leading-tight uppercase tracking-wide">{activeProfile.name}</h3>
                    <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mt-1">
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
                      <Calendar className="w-4 h-4 mr-2 text-amber-500 shrink-0" />
                      {activeProfile.availability || "Mon - Fri, Flexible"}
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

                            const strValue = String(value).trim();
                            const Linkify = ({ text }: { text: string }) => {
                              const urlRegex = /(https?:\/\/[^\s]+)/g;
                              const parts = text.split(urlRegex);
                              
                              return (
                                <span className="text-xs font-semibold text-gray-800 break-words leading-relaxed block whitespace-pre-line text-left">
                                  {parts.map((part, i) => 
                                    part.match(urlRegex) ? (
                                      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">
                                        {part}
                                      </a>
                                    ) : (
                                      <span key={i}>{part}</span>
                                    )
                                  )}
                                </span>
                              );
                            };

                            return (
                              <div key={key} className="p-3 bg-gray-50/60 border border-gray-100 rounded-xl transition-all hover:bg-gray-50 text-left">
                                <span className="block text-[10px] text-orange-500 font-bold uppercase tracking-wide mb-1">
                                  {key}
                                </span>
                                <Linkify text={strValue} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="border-t border-gray-150 pt-4 mt-8">
                <button 
                  onClick={() => setActiveProfile(null)}
                  className="w-full py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl transition-all text-center"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
