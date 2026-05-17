import React, { useState, useEffect } from 'react';
import { MatchRecord } from '../types';
import { History, User, Building, MapPin, Briefcase, DollarSign, Calendar, Target } from 'lucide-react';
import { motion } from 'motion/react';
import { authFetch } from '../lib/api';

export default function MatchHistory() {
  const [history, setHistory] = useState<MatchRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await authFetch('/api/matches/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setIsLoading(false);
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
                key={record.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
              >
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
                          {record.expertName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-base font-bold text-gray-900">{record.expertName}</p>
                          <p className="text-sm text-gray-600">{record.expertRole || 'Expert'}</p>
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
    </div>
  );
}
