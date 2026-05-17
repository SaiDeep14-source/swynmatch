import React, { useState, useEffect } from 'react';
import { Users, History, Activity, ArrowRight, Zap, Target, Briefcase, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import { authFetch } from '../lib/api';
import SwynLogo from './SwynLogo';

interface DashboardStats {
  totalExperts: number;
  totalMatches: number;
  recentMatches: any[];
  topIndustries: { name: string; count: number }[];
}

export default function Dashboard({ 
  onNavigate 
}: { 
  onNavigate: (tab: 'find' | 'directory' | 'history') => void 
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [expertsRes, matchesRes] = await Promise.all([
          authFetch('/api/experts'),
          authFetch('/api/matches/history')
        ]);

        let totalExperts = 0;
        let totalMatches = 0;
        let recentMatches: any[] = [];
        let topIndustries: { name: string; count: number }[] = [];

        if (expertsRes.ok) {
          const data = await expertsRes.json();
          totalExperts = data.length;
          
          const industryCounts: Record<string, number> = {};
          data.forEach((expert: any) => {
            if (expert.industry) {
               industryCounts[expert.industry] = (industryCounts[expert.industry] || 0) + 1;
            }
          });
          
          topIndustries = Object.entries(industryCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([name, count]) => ({ name, count }));
        }

        if (matchesRes.ok) {
          const data = await matchesRes.json();
          totalMatches = data.length;
          // Sort by timestamp descending and take top 3
          recentMatches = data
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 3);
        }

        setStats({ totalExperts, totalMatches, recentMatches, topIndustries });
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center mb-2">
            <SwynLogo className="h-12 w-auto mr-4" />
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome to SWYNMatch</h2>
          </div>
          <p className="text-gray-600 max-w-xl text-lg">
            Manage your expert directory, match project requirements using AI, and keep track of your team's resourcing history.
          </p>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-orange-50 rounded-full -mr-20 -mt-20 blur-3xl opacity-60"></div>
        <div className="absolute right-40 bottom-0 w-40 h-40 bg-amber-50 rounded-full -mb-10 blur-2xl opacity-60"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="text-gray-500 font-medium text-sm">Total Experts</h3>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {loading ? (
                <div className="h-9 w-16 bg-gray-100 rounded animate-pulse"></div>
              ) : (
                stats?.totalExperts || 0
              )}
            </div>
          </div>
          <button 
            onClick={() => onNavigate('directory')}
            className="mt-6 text-sm font-medium text-orange-600 hover:text-orange-700 flex items-center group w-fit"
          >
            Manage Directory
            <ArrowRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
              <History className="h-6 w-6 text-emerald-600" />
            </div>
            <h3 className="text-gray-500 font-medium text-sm">Saved Matches</h3>
            <div className="mt-2 text-3xl font-bold text-gray-900">
              {loading ? (
                <div className="h-9 w-16 bg-gray-100 rounded animate-pulse"></div>
              ) : (
                stats?.totalMatches || 0
              )}
            </div>
          </div>
          <button 
            onClick={() => onNavigate('history')}
            className="mt-6 text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center group w-fit"
          >
            View History
            <ArrowRight className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-orange-600 p-6 rounded-2xl border border-orange-500 shadow-md flex flex-col justify-between relative overflow-hidden text-white"
        >
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-4 backdrop-blur-sm">
              <Target className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-orange-100 font-medium text-sm">Need to fill a role?</h3>
            <div className="mt-2 text-xl font-semibold leading-tight">
              Find the perfect expert using AI Matching
            </div>
          </div>
          <button 
            onClick={() => onNavigate('find')}
            className="mt-6 w-full py-2.5 bg-white text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors relative z-10 shadow-sm flex items-center justify-center"
          >
            <Zap className="h-4 w-4 mr-2" />
            Start Matching
          </button>
          
          {/* Decorative background elements */}
          <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-orange-500 rounded-full blur-2xl opacity-60"></div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full opacity-10 -mr-10 -mt-10 blur-xl"></div>
        </motion.div>
      </div>
      
      {/* Lower Section: Recent Matches and Industries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center">
             <h3 className="text-lg font-semibold text-gray-900 bg-white">Recent Matches</h3>
             <button onClick={() => onNavigate('history')} className="text-sm font-medium text-orange-600 hover:text-orange-700">View All</button>
          </div>
          <div className="divide-y divide-gray-100">
             {loading ? (
               <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse"></div>
                  ))}
               </div>
             ) : stats?.recentMatches && stats.recentMatches.length > 0 ? (
               stats.recentMatches.map((match: any) => (
                 <div key={match.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                       <div>
                         <p className="font-medium text-gray-900 line-clamp-1">{match.requirement}</p>
                         <div className="flex items-center text-sm text-gray-500 mt-1">
                           <Calendar className="w-4 h-4 mr-1.5" />
                           {new Date(match.timestamp).toLocaleDateString()}
                           <span className="mx-2">•</span>
                           <Users className="w-4 h-4 mr-1.5" />
                           {match.matches?.length || 0} matched
                         </div>
                       </div>
                       <button onClick={() => onNavigate('history')} className="shrink-0 ml-4 p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors">
                          <ArrowRight className="w-5 h-5" />
                       </button>
                    </div>
                 </div>
               ))
             ) : (
               <div className="p-12 text-center text-gray-500">
                  No recent matches found. Start a new match!
               </div>
             )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
             <h3 className="text-lg font-semibold text-gray-900 bg-white">Top Industries</h3>
          </div>
          <div className="p-6 space-y-4">
             {loading ? (
                // skeleton
                <div className="space-y-4">
                   {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />)}
                </div>
             ) : stats?.topIndustries && stats.topIndustries.length > 0 ? (
                stats.topIndustries.map((ind, i) => (
                   <div key={ind.name} className="flex items-center justify-between">
                     <div className="flex items-center truncate">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 font-medium text-sm mr-3 shrink-0">
                           {i + 1}
                        </div>
                        <span className="font-medium text-gray-700 truncate" title={ind.name}>{ind.name}</span>
                     </div>
                     <span className="ml-4 tabular-nums text-sm font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md">{ind.count}</span>
                   </div>
                ))
             ) : (
                <div className="text-center text-gray-500 py-6">
                   No industry data available.
                </div>
             )}
          </div>
        </div>
      </div>
      
      {/* Quick Tips */}
      <div className="bg-white rounded-2xl border border-gray-200 flex flex-col items-center justify-center py-12 px-6 text-center shadow-sm">
         <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-600">
           <Zap className="h-8 w-8" />
         </div>
         <h3 className="text-xl font-bold text-gray-900 mb-2">Did you know?</h3>
         <p className="text-gray-600 max-w-lg mb-6">
            You can sync your expert directory directly from Google Sheets. Go to your <span className="font-medium text-gray-800">Directory</span> and configure it.
         </p>
         <button 
           onClick={() => onNavigate('directory')}
           className="px-6 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
         >
           Configure Sheets Integration
         </button>
      </div>
    </div>
  );
}
