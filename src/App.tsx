import React, { useState, useEffect } from 'react';
import { Search, UserCircle, Briefcase, ChevronRight, FileText, History, LogOut, Home, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ExpertsDirectory from './components/ExpertsDirectory';
import MatchEngine from './components/MatchEngine';
import MatchHistory from './components/MatchHistory';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Chat from './components/Chat';
import SwynLogo from './components/SwynLogo';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'find' | 'directory' | 'history' | 'chat'>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const email = localStorage.getItem('user_email');
    if (token) {
      setIsAuthenticated(true);
      if (email) {
        setUserEmail(email);
      } else {
        try {
          const payloadBase64 = token.split('.')[1];
          const decoded = JSON.parse(atob(payloadBase64));
          if (decoded.email) {
            setUserEmail(decoded.email);
            localStorage.setItem('user_email', decoded.email);
          }
        } catch (e) {
          console.error("Failed to decode token", e);
        }
      }
    }
    setIsLoadingAuth(false);
  }, []);

  const handleLogin = (token: string, email: string) => {
    localStorage.setItem('auth_token', token);
    if (email) {
      localStorage.setItem('user_email', email);
      setUserEmail(email);
    }
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_email');
    setIsAuthenticated(false);
    setUserEmail('');
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-8 w-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex md:flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <SwynLogo className="h-8 w-8 mr-2" />
          <span className="text-xl font-semibold text-gray-900 tracking-tight">SWYNMatch</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center px-3 py-2.5 rounded-lg font-medium transition-colors ${
              activeTab === 'dashboard' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Home className="h-5 w-5 mr-3" />
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('find')}
            className={`w-full flex items-center px-3 py-2.5 rounded-lg font-medium transition-colors ${
              activeTab === 'find' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Search className="h-5 w-5 mr-3" />
            Find Experts
          </button>
          <button 
            onClick={() => setActiveTab('directory')}
            className={`w-full flex items-center px-3 py-2.5 rounded-lg font-medium transition-colors ${
              activeTab === 'directory' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <UserCircle className="h-5 w-5 mr-3" />
            Expert Directory
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center px-3 py-2.5 rounded-lg font-medium transition-colors ${
              activeTab === 'history' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <History className="h-5 w-5 mr-3" />
            Match History
          </button>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`w-full flex items-center px-3 py-2.5 rounded-lg font-medium transition-colors ${
              activeTab === 'chat' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <MessageSquare className="h-5 w-5 mr-3" />
            Messages
          </button>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-3 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
             <LogOut className="h-5 w-5 mr-2" />
             Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 z-10 relative">
          <div className="flex-1 flex items-center md:hidden mr-4">
             {/* Mobile Tabs */}
             <select 
               className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5"
               value={activeTab}
               onChange={(e) => setActiveTab(e.target.value as any)}
             >
               <option value="dashboard">Dashboard</option>
               <option value="find">Find Experts</option>
               <option value="directory">Expert Directory</option>
               <option value="history">Match History</option>
               <option value="chat">Messages</option>
             </select>
          </div>
          <div className="hidden md:block flex-1">
             <h1 className="text-xl font-semibold text-gray-800">
               {activeTab === 'dashboard' ? 'Dashboard' : activeTab === 'directory' ? 'Directory' : activeTab === 'history' ? 'Match History' : activeTab === 'chat' ? 'Messages' : 'Find Experts'}
             </h1>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button 
              onClick={handleLogout}
              className="md:hidden text-gray-500 hover:text-red-500 transition-colors p-2"
              title="Sign out"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-semibold border border-orange-200 hidden md:flex">
              {userEmail ? userEmail.substring(0, 2).toUpperCase() : 'AD'}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-hidden p-4 md:p-8 flex flex-col bg-gray-50">
          <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
             <AnimatePresence mode="wait">
               {activeTab === 'dashboard' && (
                 <motion.div
                   key="dashboard"
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 10 }}
                   transition={{ duration: 0.2 }}
                   className="h-full overflow-auto pb-8"
                 >
                   <Dashboard onNavigate={setActiveTab} />
                 </motion.div>
               )}
               {activeTab === 'directory' && (
                 <motion.div
                   key="directory"
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 10 }}
                   transition={{ duration: 0.2 }}
                   className="h-full overflow-auto"
                 >
                   <ExpertsDirectory />
                 </motion.div>
               )}
               {activeTab === 'find' && (
                 <motion.div
                   key="find"
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 10 }}
                   transition={{ duration: 0.2 }}
                   className="h-full overflow-hidden"
                 >
                   <MatchEngine onMatchSaved={() => setActiveTab('history')} />
                 </motion.div>
               )}
               {activeTab === 'history' && (
                 <motion.div
                   key="history"
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 10 }}
                   transition={{ duration: 0.2 }}
                   className="h-full overflow-hidden"
                 >
                   <MatchHistory />
                 </motion.div>
               )}
               {activeTab === 'chat' && (
                 <motion.div
                   key="chat"
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 10 }}
                   transition={{ duration: 0.2 }}
                   className="h-full overflow-hidden"
                 >
                   <Chat currentUser={userEmail || 'Guest'} />
                 </motion.div>
               )}
             </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
