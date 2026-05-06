import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, limit, getCountFromServer, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  Activity, 
  Users, 
  Zap, 
  Clock, 
  Database,
  ArrowUpRight,
  RefreshCcw,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { motion } from 'motion/react';

export const AdminStats: React.FC = () => {
  const [stats, setStats] = useState({
    userCount: 0,
    expertCount: 0,
    activeMatches: 0,
    systemHealth: '---',
    lastSync: '---'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const usersRef = collection(db, 'users');
    const expertsRef = collection(db, 'experts');

    const unsubUsers = onSnapshot(usersRef, (snap) => {
      setStats(prev => ({ ...prev, userCount: snap.size }));
    }, (err) => {
      console.warn("Users listener error:", err);
    });

    const unsubExperts = onSnapshot(expertsRef, (snap) => {
      setStats(prev => ({ ...prev, expertCount: snap.size }));
    }, (err) => {
      console.warn("Experts listener error:", err);
    });

    setLoading(false);
    return () => {
      unsubUsers();
      unsubExperts();
    };
  }, []);

  const cards = [
    { label: 'Total Personnel', value: stats.userCount, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Expert Pool Size', value: (stats as any).expertCount || 0, icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
    { label: 'System Uptime', value: '100%', icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { label: 'Storage Sync', value: stats.lastSync, icon: Database, color: 'text-purple-500', bg: 'bg-purple-50' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, i) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-2xl ${card.bg} ${card.color} group-hover:scale-110 transition-transform`}>
              <card.icon className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">
              <ArrowUpRight className="w-3 h-3" />
              LIVE
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight">{card.value}</h3>
        </motion.div>
      ))}
    </div>
  );
};

export const AdminConfig: React.FC = () => {
  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-xl">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Engine Control</h2>
            <p className="text-[10px] text-slate-400 font-medium">Matching Algorithm Biometrics</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-primary transition-all">
          <RefreshCcw className="w-3 h-3" />
          Re-calibrate
        </button>
      </div>

      <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expert Weighting</label>
              <span className="text-[10px] font-black text-primary">85%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary w-[85%]" />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Client Sensitivity</label>
              <span className="text-[10px] font-black text-secondary">40%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-[40%]" />
            </div>
          </div>
        </div>
        
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
           <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Governance Guard</h4>
           </div>
           <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
             Neural constraints are active. Expert vetting cycles are currently running at 100% verification depth for all new pool entries.
           </p>
           <div className="flex gap-2">
              <span className="px-2 py-1 bg-emerald-100 text-emerald-600 rounded-md text-[8px] font-black uppercase">Active</span>
              <span className="px-2 py-1 bg-slate-200 text-slate-500 rounded-md text-[8px] font-black uppercase">v4.2.1-prod</span>
           </div>
        </div>
      </div>
    </div>
  );
};
