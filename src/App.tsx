import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Sparkles, 
  LayoutDashboard, 
  MessageSquare, 
  LogOut,
  Settings,
  Bell,
  Menu,
  X,
  Send,
  ShieldCheck
} from 'lucide-react';
import { collection, query, onSnapshot, getCountFromServer } from 'firebase/firestore';
import { User } from './types';
import { ExpertsList } from './components/experts/ExpertsList';
import { MatchingEngine } from './components/matching/MatchingEngine';
import { InternalChat } from './components/chat/InternalChat';
import { FirebaseProvider, useFirebase } from './contexts/FirebaseContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { ChatProvider, useChat } from './contexts/ChatContext';
import { LoginForm } from './components/auth/LoginForm';
import { UserManagement } from './components/admin/UserManagement';
import { AdminStats, AdminConfig } from './components/admin/AdminPortal';
import { ExpertManagement } from './components/admin/ExpertManagement';
import { ExpertSynthesis } from './components/matching/ExpertSynthesis';
import { MatchingProvider, useMatching } from './contexts/MatchingContext';
import { auth, db } from './lib/firebase';

const Logo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <div className={`${className} flex items-center justify-center p-1`}>
    <svg viewBox="0 0 100 100" fill="none" className="w-full h-full drop-shadow-sm">
      <circle cx="28" cy="22" r="9" className="fill-secondary-light stroke-secondary" strokeWidth="2" />
      <circle cx="50" cy="15" r="10" className="fill-primary-light stroke-primary" strokeWidth="2" />
      <circle cx="72" cy="22" r="9" className="fill-secondary-light stroke-secondary" strokeWidth="2" />
      <rect x="20" y="45" width="22" height="45" rx="11" className="stroke-secondary" strokeWidth="6" />
      <rect x="42" y="38" width="22" height="58" rx="11" className="stroke-primary" strokeWidth="6" />
      <rect x="64" y="45" width="22" height="45" rx="11" className="stroke-secondary" strokeWidth="6" />
    </svg>
  </div>
);

// --- Components ---

const Sidebar = ({ isOpen, onClose }: { isOpen?: boolean, onClose?: () => void }) => {
  const navigate = useNavigate();
  const { user, isAdmin } = useFirebase();
  const menuItems = [
    { icon: LayoutDashboard, label: 'Ops Dashboard', path: '/' },
    { icon: Search, label: 'Match Engine', path: '/match' },
    { icon: Users, label: 'Expert Pool', path: '/experts' },
    { icon: MessageSquare, label: 'Match History', path: '/chat' },
  ];

  if (isAdmin) {
    menuItems.push({ icon: ShieldCheck, label: 'Personnel Admin', path: '/admin' });
  }

  const logout = () => auth.signOut();

  const handleNavigate = (path: string) => {
    navigate(path);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:sticky lg:top-0 inset-y-0 left-0 z-[70]
        w-64 bg-white border-r border-slate-200 flex flex-col h-screen
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-8 border-b border-slate-100 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Logo className="w-10 h-10" />
            <h1 className="text-sm font-black tracking-[0.2em] text-slate-800">SWYN<span className="text-primary">MATCH</span></h1>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigate(item.path)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-500 hover:text-primary hover:bg-primary-light/30 rounded-xl transition-all group"
            >
              <item.icon className="w-4 h-4 group-hover:scale-110 transition-transform" />
              {item.label}
            </button>
          ))}
        </nav>

      <div className="p-4 border-t border-slate-100 space-y-2">
        <div className="px-4 py-2">
           <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1">Access Protocol</p>
           <p className="text-[10px] font-bold text-slate-600 truncate">{user?.email}</p>
        </div>
        <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
          <Settings className="w-4 h-4" /> Settings
        </button>
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-all"
        >
          <LogOut className="w-4 h-4" /> Sign Out Protocol
        </button>
      </div>
    </aside>
    </>
  );
};

const Header = ({ user, onOpenMenu }: { user: User, onOpenMenu: () => void }) => {
  const { unreadCount, clearNotifications } = useNotifications();
  const { toggleChat } = useChat();

  const handleChatClick = () => {
    toggleChat();
    clearNotifications();
  };

  return (
    <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <button 
          onClick={onOpenMenu}
          className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
        >
          <Menu className="w-5 h-5 text-slate-500" />
        </button>
        <h2 className="text-[10px] md:text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2 truncate">
          Platform Core / <span className="text-slate-800 hidden sm:inline">Expert Ops Hub</span>
        </h2>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex -space-x-2">
          {[
            { label: 'VET', color: 'bg-emerald-100 text-emerald-600', title: 'Vetting Engine' },
            { label: 'STR', color: 'bg-blue-100 text-blue-600', title: 'Strategy Analysis' },
            { label: 'GOV', color: 'bg-amber-100 text-amber-600', title: 'Governance Guard' },
          ].map(agent => (
            <div 
              key={agent.label} 
              title={agent.title}
              className={`w-8 h-8 rounded-full border-2 border-white ${agent.color} flex items-center justify-center text-[8px] font-black uppercase tracking-tighter cursor-help hover:scale-110 transition-transform`}
            >
              {agent.label}
            </div>
          ))}
          <div className="w-8 h-8 rounded-full border-2 border-white bg-primary flex items-center justify-center text-[8px] font-black text-white uppercase tracking-tighter shadow-lg shadow-primary/20">+4</div>
        </div>
        <div className="h-8 w-[1px] bg-slate-200" />
        <button 
          onClick={handleChatClick}
          className="relative p-2 text-slate-400 hover:text-primary transition-colors"
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-black text-white">
              {unreadCount}
            </span>
          )}
        </button>
        <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
          <div className="w-6 h-6 bg-primary-light rounded-full flex items-center justify-center text-[10px] font-bold text-primary">
            {user.email.substring(0, 2).toUpperCase()}
          </div>
          <span className="text-xs font-bold text-slate-700">{user.email.split('@')[0]}</span>
        </div>
      </div>
    </header>
  );
};

const LoginPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:32px_32px]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg flex flex-col items-center"
      >
        <div className="mb-12 text-center">
            <Logo className="w-20 h-20 mb-8 mx-auto" />
            <h1 className="text-4xl font-black tracking-tighter text-slate-900 mb-2">SWYN<span className="text-primary italic">MATCH</span></h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em]">Integrated Intelligence Engine</p>
        </div>
        <LoginForm />
      </motion.div>
    </div>
  );
};

// --- Page Components ---

const DashboardPage = () => {
  const navigate = useNavigate();
  const { tokenUsage } = useMatching();
  const [counts, setCounts] = useState({
    experts: 0,
    totalMatches: 0
  });

  useEffect(() => {
    // Sync Expert Counts
    const expertsRef = collection(db, 'experts');
    const unsubscribeExperts = onSnapshot(expertsRef, (snapshot) => {
      setCounts(prev => ({ ...prev, experts: snapshot.size }));
    }, (err) => {
      console.warn("Dashboard experts listener error:", err);
    });

    // Sync Match Counts
    const matchesRef = collection(db, 'matches');
    const unsubscribeMatches = onSnapshot(matchesRef, (snapshot) => {
      setCounts(prev => ({ ...prev, totalMatches: snapshot.size }));
    }, (err) => {
      console.warn("Dashboard matches listener error:", err);
    });

    return () => {
      unsubscribeExperts();
      unsubscribeMatches();
    };
  }, []);

  return (
    <div className="p-10 space-y-12">
      <div className="justify-between items-end flex">
        <div>
          <h1 className="text-5xl font-light text-slate-800 tracking-tight">Expert Ops Dashboard</h1>
          <p className="text-slate-400 mt-3 text-sm font-medium uppercase tracking-widest">Match Management System</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/match')}
            className="px-8 py-4 bg-primary text-white rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:bg-primary-dark transition-all"
          >
            Initiate Matching Protocol
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Experts', value: counts.experts.toString(), trend: '+0', color: 'border-l-primary' },
          { label: 'Synthesized Matches', value: counts.totalMatches.toString(), trend: 'LIVE', color: 'border-l-secondary' },
          { label: 'Neural Resolution', value: '100%', trend: 'ACTIVE', color: 'border-l-primary-dark' },
          { label: 'Success Velocity', value: '94%', trend: '+2%', color: 'border-l-secondary-dark' },
        ].map((stat) => (
          <div key={stat.label} className={`bg-white p-8 rounded-[2rem] border border-slate-100 border-l-4 ${stat.color} shadow-sm hover:shadow-xl transition-all group`}>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-slate-600 transition-colors">{stat.label}</p>
             <div className="flex items-baseline gap-3">
               <span className="text-4xl font-light text-slate-800">{stat.value}</span>
               <span className="text-[10px] font-black text-slate-300 group-hover:text-primary transition-colors">{stat.trend}</span>
             </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
         <div className="col-span-12 lg:col-span-8 bg-white border border-slate-100 rounded-[3rem] p-12 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/2 blur-[80px] -mr-48 -mt-48 saturate-150"></div>
            <div className="flex justify-between items-center mb-10">
               <h3 className="text-2xl font-light text-slate-800 tracking-tight">Intelligence Velocity</h3>
               <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Real-time Feed</span>
               </div>
            </div>
            <div className="h-72 flex items-end gap-4 px-2">
               {Array.from({ length: 12 }).map((_, i) => (
                 <div key={i} className="flex-1 group/bar relative">
                   <motion.div 
                     initial={{ height: 0 }}
                     animate={{ height: `${20 + Math.random() * 80}%` }}
                     className="bg-slate-50 group-hover/bar:bg-primary transition-all duration-500 rounded-t-xl"
                   />
                 </div>
               ))}
            </div>
            <div className="flex justify-between mt-8 text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em] px-2 italic">
               <span>Genesis // Q1</span><span>Operational // Q4</span>
            </div>
         </div>

         <div className="col-span-12 lg:col-span-4 space-y-8">
            <div className="bg-slate-900 text-white rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group">
              <Sparkles className="absolute top-8 right-8 w-10 h-10 text-primary opacity-20 group-hover:scale-150 group-hover:rotate-12 transition-all duration-700" />
              <h4 className="text-2xl font-light mb-8 tracking-tight">System Status</h4>
              <p className="text-sm text-slate-400 leading-relaxed italic border-l-2 border-primary pl-8 py-4 bg-white/5 rounded-r-2xl">
                Ready to analyze expert suitability. Current core: Gemini 2.5 Flash.
              </p>
            </div>
            
            <div className="bg-white border border-slate-100 rounded-[3rem] p-10 shadow-sm">
               <div className="flex items-center gap-3 mb-8">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Active Subroutines</h4>
               </div>
               <div className="space-y-6">
                 {[
                  { label: 'Gemini 2.5 Flash', value: 'Active Core Agent' },
                   { label: 'Token Utilization', value: tokenUsage > 0 ? `${tokenUsage.toLocaleString()} tokens` : 'Awaiting requests' },
                   { label: 'Sheet Synchronization', value: 'Synced' }
                 ].map(item => (
                   <div key={item.label} className="group cursor-default">
                      <div className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mb-1 group-hover:text-primary transition-colors">{item.label}</div>
                      <div className="text-xs font-bold text-slate-600">{item.value}</div>
                   </div>
                 ))}
               </div>
            </div>
         </div>
      </div>
    </div>
  )
};

const MatchingPage = () => (
  <div className="h-[calc(100vh-4rem)]">
    <MatchingEngine />
  </div>
);

const ExpertsPage = () => (
  <ExpertsList />
);

const AdminPage = () => (
  <div className="p-10 space-y-10 max-w-7xl mx-auto pb-24">
    <div>
      <h1 className="text-5xl font-light text-slate-800 tracking-tight">Personnel Admin</h1>
      <p className="text-slate-400 mt-3 text-sm font-medium uppercase tracking-widest">Internal User Management & Access Control</p>
    </div>
    <AdminStats />
    <AdminConfig />
    <UserManagement />
    <ExpertManagement />
  </div>
);

const ChatPage = () => (
  <ExpertSynthesis />
);

// App Shell for persistent navigation
const AppShell = ({ user, children }: { user: User, children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header user={user} onOpenMenu={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <InternalChat currentUser={user} />
    </div>
  );
};

// Main Router Content
const AppContent = () => {
  const { user, loading, isAdmin } = useFirebase();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Logo className="w-16 h-16 animate-pulse" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">Initializing Core...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/login" 
        element={!user ? <LoginPage /> : <Navigate to="/" />} 
      />
      <Route 
        path="/*" 
        element={
          user ? (
            <AppShell user={user}>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/match" element={<MatchingPage />} />
                <Route path="/experts" element={<ExpertsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                {isAdmin && <Route path="/admin" element={<AdminPage />} />}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AppShell>
          ) : (
            <Navigate to="/login" />
          )
        } 
      />
    </Routes>
  );
};

// Root Component
export default function App() {
  return (
    <FirebaseProvider>
      <NotificationProvider>
        <ChatProvider>
          <MatchingProvider>
            <BrowserRouter>
              <AppContent />
            </BrowserRouter>
          </MatchingProvider>
        </ChatProvider>
      </NotificationProvider>
    </FirebaseProvider>
  );
}
