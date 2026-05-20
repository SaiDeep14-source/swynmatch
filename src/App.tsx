import React, { useState, useEffect } from 'react';
import { 
  Search, 
  History, 
  LogOut, 
  Home, 
  MessageSquare, 
  ShieldCheck, 
  Server, 
  User, 
  Loader2, 
  Briefcase, 
  ChevronRight,
  Sparkles,
  Target,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdminDashboard } from './components/AdminDashboard';
import { Auth } from './components/Auth';
import ExpertsDirectory from './components/ExpertsDirectory';
import MatchEngine from './components/MatchEngine';
import Chat from './components/Chat';
import SwynLogo from './components/SwynLogo';
import Dashboard from './components/Dashboard';
import MatchHistory from './components/MatchHistory';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

type TabType = 'dashboard' | 'find' | 'directory' | 'history' | 'chat' | 'admin';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const token = await user.getIdToken();
        localStorage.setItem('token', token);
        setUser(user);
      } else {
        localStorage.removeItem('token');
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    window.location.reload();
  };

  const handleLogin = (token: string, email: string) => {
    localStorage.setItem('token', token);
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-swyn-orange animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Auth onLogin={handleLogin} />;
  }

  const userEmail = user.email || "";
  
  // Calculate initials like "SA" for the profile icon
  const getInitials = (email: string) => {
    if (!email) return "SA";
    const prefix = email.split('@')[0];
    if (prefix.length >= 2) {
      return prefix.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };
  const initials = getInitials(userEmail);

  return (
    <div className="flex h-screen bg-[#FDFCFB]">
      {/* Sidebar - Desktop */}
      <aside className="w-72 bg-white border-r border-gray-100 p-8 flex flex-col z-20">
        <div className="mb-12">
          <SwynLogo size={32} />
        </div>

        {/* Sections Header */}
        <div className="px-4 mb-3">
          <span className="text-[10px] font-bold text-swyn-orange/90 uppercase tracking-widest block font-sans">
            Sections
          </span>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto pr-2 custom-scrollbar">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
            icon={<Home className="w-5 h-5" />} 
            label="Dashboard" 
          />
          <NavItem 
            active={activeTab === 'find'} 
            onClick={() => setActiveTab('find')} 
            icon={<Search className="w-5 h-5" />} 
            label="Find Experts" 
          />
          <NavItem 
            active={activeTab === 'directory'} 
            onClick={() => setActiveTab('directory')} 
            icon={<Briefcase className="w-5 h-5" />} 
            label="Expert Directory" 
          />
          <NavItem 
            active={activeTab === 'history'} 
            onClick={() => setActiveTab('history')} 
            icon={<History className="w-5 h-5" />} 
            label="Match History" 
          />
          <NavItem 
            active={activeTab === 'chat'} 
            onClick={() => setActiveTab('chat')} 
            icon={<MessageSquare className="w-5 h-5" />} 
            label="Messages" 
          />
          
          {userEmail === 'info@swyn.in' && (
            <NavItem 
              active={activeTab === 'admin'} 
              onClick={() => setActiveTab('admin')} 
              icon={<ShieldCheck className="w-5 h-5" />} 
              label="Admin Console" 
            />
          )}
        </nav>

        <div className="mt-8 pt-6 border-t border-gray-100">
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center px-4 py-3 text-sm font-semibold text-gray-500 hover:text-swyn-orange rounded-xl transition-all group"
          >
            <LogOut className="w-5 h-5 mr-3 group-hover:-translate-x-1 transition-transform text-gray-400 group-hover:text-swyn-orange" /> 
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#FAF9F6]">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 px-10 flex items-center justify-between sticky top-0 z-10 relative">
          {/* Subtle gradient border line at bottom of the header */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-swyn-orange via-swyn-gold to-transparent"></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'find' && 'Find Experts'}
              {activeTab === 'directory' && 'Directory'}
              {activeTab === 'chat' && 'Messages'}
              {activeTab === 'history' && 'Match History'}
              {activeTab === 'admin' && 'Admin Console'}
            </h1>
          </div>

          <div className="flex items-center space-x-6">
            <div className="w-10 h-10 rounded-full bg-swyn-goldLight border border-swyn-goldMedium/30 flex items-center justify-center text-swyn-goldDark font-extrabold text-xs tracking-wider shadow-sm font-mono">
              {initials}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-transparent p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.99 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full"
            >
              {activeTab === 'dashboard' && <Dashboard onNavigate={(tab) => setActiveTab(tab)} />}
              {activeTab === 'find' && <MatchEngine />}
              {activeTab === 'directory' && <ExpertsDirectory />}
              {activeTab === 'chat' && <Chat />}
              {activeTab === 'admin' && <AdminDashboard />}
              {activeTab === 'history' && <MatchHistory />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{ 
  active: boolean; 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string; 
  badge?: string;
}> = ({ active, onClick, icon, label, badge }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center px-4 py-3 rounded-xl text-sm font-semibold transition-all relative group overflow-hidden ${
      active 
        ? 'bg-swyn-orange text-white shadow-md shadow-swyn-orange/10'
        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
    }`}
  >
    <span className={`mr-3 transition-transform ${active ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`}>
      {icon}
    </span>
    {label}
    {badge && (
      <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${
        active 
          ? 'bg-white/20 text-white' 
          : 'bg-[#FAF2DB] text-[#866110]'
      }`}>
        {badge}
      </span>
    )}
  </button>
);

export default App;
