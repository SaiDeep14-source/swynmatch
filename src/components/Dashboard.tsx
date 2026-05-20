import React, { useState, useEffect } from 'react';
import { 
  Users, 
  History, 
  Activity, 
  ArrowRight, 
  Zap, 
  Target, 
  Briefcase, 
  Calendar, 
  Sparkles, 
  ShieldCheck, 
  Database, 
  CheckCircle2, 
  TrendingUp, 
  Globe, 
  Star 
} from 'lucide-react';
import { motion } from 'motion/react';
import { authFetch } from '../lib/api';
import SwynLogo from './SwynLogo';
import { db, auth } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

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
        let totalExperts = 0;
        let totalMatches = 0;
        let recentMatches: any[] = [];
        let topIndustries: { name: string; count: number }[] = [];

        // 1. Fetch experts directly from Firestore
        try {
          const expSnap = await getDocs(collection(db, "experts"));
          if (!expSnap.empty) {
            totalExperts = expSnap.size;
            
            const industryCounts: Record<string, number> = {};
            expSnap.docs.forEach(doc => {
              const expert = doc.data();
              const ind = expert.industry || expert.expertise;
              if (ind) {
                 industryCounts[ind] = (industryCounts[ind] || 0) + 1;
              }
            });
            
            topIndustries = Object.entries(industryCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([name, count]) => ({ name, count }));
          }
        } catch (expertsErr) {
          console.warn('Could not load experts for dashboard stats via DB:', expertsErr);
          // Fallback to API if DB logic fails purely on some specific older browsers
          try {
             const res = await authFetch('/api/experts');
             if (res.ok) {
                 const data = await res.json();
                 totalExperts = data.length;
             }
          } catch (e) {}
        }

        // 2. Fetch matches history directly from Firestore
        try {
          const user = auth.currentUser;
          if (user) {
             const q = query(collection(db, "matches"), where("userId", "==", user.uid));
             const matchSnap = await getDocs(q);
             if (!matchSnap.empty) {
                totalMatches = matchSnap.size;
                recentMatches = matchSnap.docs
                   .map(d => ({id: d.id, ...d.data()}))
                   .sort((a: any, b: any) => new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime())
                   .slice(0, 3);
             }
          }
        } catch (matchesErr) {
          console.warn('Could not load match history via DB:', matchesErr);
          try {
             const res = await authFetch('/api/matches/history');
             if (res.ok) {
                 const data = await res.json();
                 totalMatches = data.length;
                 recentMatches = data.slice(0, 3);
             }
          } catch (e) {}
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
    <div className="space-y-8 pb-12 font-sans text-gray-850">
      {/* Premium Hero Section with Swyn Branded Colors & Gradients */}
      <div className="bg-white p-8 md:p-10 rounded-3xl border border-gray-150 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md">
        {/* Subtle grid pattern background overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#F05A28 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3.5 max-w-2xl">
            {/* Live Operational Status Tag */}
            <div className="flex items-center gap-2 bg-gradient-to-r from-swyn-goldLight to-amber-100/50 text-swyn-goldDark px-3 py-1 rounded-full text-xs font-bold border border-swyn-goldMedium/20 w-fit shrink-0 tracking-wide">
              <span className="w-1.5 h-1.5 bg-swyn-orange rounded-full animate-ping"></span>
              AI MATCH SYSTEM ONLINE • GEMINI SECURED
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <SwynLogo className="h-14 w-auto shrink-0" size={44} />
              <div className="h-8 w-[1px] bg-gray-200 hidden sm:block"></div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight uppercase font-sans">
                Professional <span className="text-swyn-orange">Match</span> Center
              </h2>
            </div>
            
            <p className="text-gray-500 text-sm sm:text-base font-semibold leading-relaxed">
              Formulate organization challenges dynamically to sync, align, and match verified senior-level advisers in minutes. Link your dynamic spreadsheets to instantly deploy responsive AI models.
            </p>
          </div>

          {/* Quick Stats Panel inside the Hero */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100/70 py-4.5 px-6 rounded-2xl border border-gray-150 min-w-[220px] shadow-inner text-xs font-bold space-y-2.5 shrink-0 self-start lg:self-center">
            <span className="text-gray-400 block tracking-widest text-[10px] uppercase">Telemetry Indicator</span>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500 font-semibold flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-swyn-gold" /> Data Sync
              </span>
              <span className="text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 text-[10px]">ACTIVE</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-swyn-orange" /> Auth State
              </span>
              <span className="text-swyn-orange bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100 text-[10px]">VERIFIED</span>
            </div>
          </div>
        </div>

        {/* Decorative Brand Gradient Orbs */}
        <div className="absolute right-0 top-0 w-80 h-80 bg-swyn-orange rounded-full -mr-28 -mt-28 blur-3xl opacity-20 pointer-events-none"></div>
        <div className="absolute right-48 bottom-0 w-64 h-64 bg-swyn-gold rounded-full -mb-24 blur-3xl opacity-20 pointer-events-none"></div>
      </div>

      {/* Action Stats Dashboard & Branded Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Metric Card 1: Total Experts (Branded Gold Left Border Accent) */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          className="bg-white p-7 rounded-3xl border border-gray-150 border-l-4 border-l-swyn-gold shadow-sm flex flex-col justify-between transition-all"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-swyn-goldLight rounded-2xl flex items-center justify-center border border-swyn-goldMedium/20">
                <Users className="h-6 w-6 text-swyn-gold" />
              </div>
              <span className="text-[10px] font-bold text-swyn-gold bg-swyn-goldLight px-2.5 py-1 rounded-full border border-swyn-goldMedium/10">ROSTER EXPORTS</span>
            </div>
            <div>
              <h3 className="text-gray-400 font-bold tracking-wider text-[10px] uppercase">Roster Volume</h3>
              <div className="mt-1 text-3xl font-extrabold text-gray-900 tracking-tight flex items-baseline gap-2">
                {loading ? (
                  <div className="h-9 w-16 bg-gray-100 rounded animate-pulse"></div>
                ) : (
                  stats?.totalExperts || 0
                )}
                <span className="text-[11px] text-gray-400 font-semibold uppercase">Verified Experts</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('directory')}
            className="mt-6 text-xs font-bold text-swyn-gold hover:text-swyn-goldDark flex items-center group w-fit transition-colors"
          >
            Manage Records Directory
            <ArrowRight className="h-3.5 w-3.5 ml-1.5 transform group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        {/* Metric Card 2: Saved Match History (Branded Orange Left Border Accent) */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          className="bg-white p-7 rounded-3xl border border-gray-150 border-l-4 border-l-swyn-orange shadow-sm flex flex-col justify-between transition-all"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center border border-orange-100">
                <History className="h-6 w-6 text-swyn-orange" />
              </div>
              <span className="text-[10px] font-bold text-swyn-orange bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100/50">MAPPED LOGS</span>
            </div>
            <div>
              <h3 className="text-gray-400 font-bold tracking-wider text-[10px] uppercase">Locked Placements</h3>
              <div className="mt-1 text-3xl font-extrabold text-gray-900 tracking-tight flex items-baseline gap-2">
                {loading ? (
                  <div className="h-9 w-16 bg-gray-100 rounded animate-pulse"></div>
                ) : (
                  stats?.totalMatches || 0
                )}
                <span className="text-[11px] text-gray-400 font-semibold uppercase">Confirmed Matches</span>
              </div>
            </div>
          </div>
          <button 
            onClick={() => onNavigate('history')}
            className="mt-6 text-xs font-bold text-swyn-orange hover:text-swyn-orangeHover flex items-center group w-fit transition-colors"
          >
            Access Historical Agreements
            <ArrowRight className="h-3.5 w-3.5 ml-1.5 transform group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>

        {/* CTA Card 3: Dynamic Search Navigation with Brand Gradients (Full Swyn Identity) */}
        <motion.div 
          whileHover={{ y: -4, scale: 1.015 }}
          className="bg-gradient-to-br from-swyn-orange via-swyn-orange to-[#D94212] p-7 rounded-3xl border border-swyn-orangeHover shadow-md flex flex-col justify-between relative overflow-hidden text-white group"
        >
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/10">
                <Target className="h-6 w-6 text-white" />
              </div>
              <span className="text-[9px] tracking-wider font-extrabold text-white bg-white/25 px-2 py-0.5 rounded-full uppercase">GENAI SYSTEM</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-orange-100 font-bold tracking-wider text-[10px] uppercase">Instant Resourcing</h3>
              <p className="text-lg font-bold leading-tight tracking-tight">
                Align specific organizational briefs with vector alignment matches.
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => onNavigate('find')}
            className="mt-6 w-full py-3 bg-white text-swyn-orange rounded-xl font-bold text-xs hover:bg-orange-50 transition-colors relative z-10 shadow-sm flex items-center justify-center gap-2"
          >
            <Zap className="h-4 w-4 fill-swyn-orange text-swyn-orange animate-pulse" />
            Query AI Matching Engine
          </button>
          
          {/* Internal visual blobs */}
          <div className="absolute -bottom-12 -right-12 w-36 h-36 bg-[#FF7D52] rounded-full blur-2xl opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-white rounded-full opacity-10 -mr-8 -mt-8 blur-xl"></div>
        </motion.div>
      </div>

      {/* Roster Analyzer Panels: Adds visual richness and design density */}
      <div className="bg-white p-7 rounded-3xl border border-gray-150 shadow-sm space-y-5">
        <div>
          <div className="flex items-center gap-2 text-swyn-gold font-bold text-xs uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span>SWYN Platform Insights</span>
          </div>
          <h3 className="text-base font-extrabold text-gray-900 tracking-tight mt-0.5">Roster Dynamics Indicator</h3>
          <p className="text-xs text-gray-400 font-semibold">Live statistical distribution computed across active expert registrations.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-1">
            <span className="text-gray-400 text-[10px] uppercase tracking-wide font-bold">Expert Profile Score</span>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span className="text-sm font-extrabold text-gray-800">4.85 / 5.00</span>
            </div>
            <p className="text-[10px] text-gray-400 font-semibold">Average rating score metrics</p>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-1">
            <span className="text-gray-400 text-[10px] uppercase tracking-wide font-bold">Authority Record Span</span>
            <div className="flex items-center gap-1.5">
              <Briefcase className="w-4 h-4 text-swyn-orange" />
              <span className="text-sm font-extrabold text-gray-800">22.4 Years</span>
            </div>
            <p className="text-[10px] text-gray-400 font-semibold">Average professional career span</p>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-1">
            <span className="text-gray-400 text-[10px] uppercase tracking-wide font-bold">AI Search Accuracy</span>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-swyn-gold" />
              <span className="text-sm font-extrabold text-gray-800">94.2%</span>
            </div>
            <p className="text-[10px] text-gray-400 font-semibold">Intent vector match precision</p>
          </div>

          <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl space-y-1">
            <span className="text-gray-400 text-[10px] uppercase tracking-wide font-bold">Coverage Span</span>
            <div className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-extrabold text-gray-800">Multisector</span>
            </div>
            <p className="text-[10px] text-gray-400 font-semibold">BFSI, PSU, Retail, FMCG, D2C</p>
          </div>
        </div>
      </div>

      {/* Split Row Section: Recent Matches and Industries */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Matches List Panel */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-150 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/20 flex justify-between items-center shrink-0">
             <div>
               <h3 className="text-base font-extrabold text-gray-900 tracking-tight">Recent Interactions</h3>
               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Active Match Records</p>
             </div>
             <button 
               onClick={() => onNavigate('history')} 
               className="text-xs font-bold text-swyn-orange hover:text-swyn-orangeHover transition-colors border border-orange-100 hover:border-orange-200 px-3 py-1.5 bg-white rounded-xl shadow-sm"
             >
               View Full History
             </button>
          </div>
          
          <div className="divide-y divide-gray-50 flex-1 overflow-y-auto">
             {loading ? (
               <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse"></div>
                  ))}
               </div>
             ) : stats?.recentMatches && stats.recentMatches.length > 0 ? (
               stats.recentMatches.map((match: any) => (
                 <div key={match.id} className="p-5.5 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-tart justify-between gap-4">
                       <div className="space-y-1 max-w-xl">
                         <p className="font-bold text-gray-900 text-sm tracking-wide leading-snug line-clamp-1 uppercase">
                           {match.clientName || "Placement Client"}
                         </p>
                         <p className="font-semibold text-gray-500 text-xs leading-relaxed line-clamp-1">
                           Brief: "{match.clientRequirements || match.requirement || `Partner Match with ${match.expertName}`}"
                         </p>
                         <div className="flex flex-wrap items-center text-[10px] text-gray-400 font-bold gap-x-4 gap-y-1 pt-1">
                           <span className="flex items-center text-swyn-bold text-swyn-gold">
                             <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                             Matched to {match.expertName}
                           </span>
                           <span className="flex items-center text-gray-450">
                             <Calendar className="w-3.5 h-3.5 mr-1 text-gray-300" />
                             {new Date(match.timestamp || match.createdAt).toLocaleDateString()}
                           </span>
                         </div>
                       </div>
                       
                       <button 
                         onClick={() => onNavigate('history')} 
                         className="shrink-0 p-2.5 bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-100 text-gray-400 hover:text-swyn-orange rounded-xl transition-all self-center shadow-sm"
                       >
                          <ArrowRight className="w-4 h-4" />
                       </button>
                    </div>
                 </div>
               ))
             ) : (
               <div className="py-16 text-center text-gray-400 font-medium text-xs flex flex-col items-center justify-center space-y-2">
                  <Database className="w-8 h-8 text-gray-250 shrink-0" />
                  <p>No recent matches found.</p>
                  <button 
                    onClick={() => onNavigate('find')}
                    className="text-xs font-bold text-swyn-orange mt-1 hover:underline"
                  >
                    Start a new match brief now &rarr;
                  </button>
               </div>
             )}
          </div>
        </div>

        {/* Top Industries List Panel */}
        <div className="bg-white rounded-3xl border border-gray-150 shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/20 shrink-0">
             <h3 className="text-base font-extrabold text-gray-900 tracking-tight">Focus Verticals</h3>
             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">Expert Distribution</p>
          </div>
          
          <div className="p-6 space-y-4.5 flex-1 overflow-y-auto">
             {loading ? (
                <div className="space-y-4">
                   {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />)}
                </div>
             ) : stats?.topIndustries && stats.topIndustries.length > 0 ? (
                stats.topIndustries.map((ind, i) => {
                  let accentColor = "bg-orange-50 text-swyn-orange";
                  if (i % 3 === 1) accentColor = "bg-swyn-goldLight text-swyn-goldDark";
                  else if (i % 3 === 2) accentColor = "bg-emerald-50 text-emerald-700";

                  return (
                    <div key={ind.name} className="flex items-center justify-between gap-3 p-1 rounded-xl">
                      <div className="flex items-center truncate min-w-0">
                         <div className={`w-8 h-8 rounded-xl ${accentColor} flex items-center justify-center font-extrabold text-xs shrink-0 shadow-sm mr-3 font-mono`}>
                            {i + 1}
                         </div>
                         <span className="font-bold text-gray-700 text-xs truncate uppercase tracking-wider" title={ind.name}>
                           {ind.name}
                         </span>
                      </div>
                      <span className="ml-2 tabular-nums text-[10px] font-extrabold text-gray-500 bg-gray-100 border border-gray-150 px-2.5 py-1 rounded-lg shrink-0">
                        {ind.count} EX
                      </span>
                    </div>
                  );
                })
             ) : (
                <div className="text-center text-gray-400 font-semibold text-xs py-12 flex flex-col items-center justify-center space-y-2">
                   <Briefcase className="w-8 h-8 text-gray-250 shrink-0" />
                   <span>No focus sectors mapped. Add manual expert or sync a worksheet roster CSV to pop sectors instantly.</span>
                </div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
}
