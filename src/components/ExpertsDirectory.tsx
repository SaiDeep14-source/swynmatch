import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Star, 
  Search, 
  Database, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  ChevronRight, 
  Download, 
  Upload, 
  Plus, 
  X, 
  User, 
  Briefcase, 
  DollarSign, 
  Calendar,
  Layers,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { authFetch } from '../lib/api';

interface Expert {
  id: string;
  name: string;
  expertise: string;
  summary: string;
  hourlyRate: number;
  rating: number;
  availability: string;
  industry?: string;
  experience?: string;
  customFields?: Record<string, string>;
}

const ExpertsDirectory: React.FC = () => {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasClearedDeliberately, setHasClearedDeliberately] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newIndustry, setNewIndustry] = useState('');
  const [newExperience, setNewExperience] = useState('20–25 years');
  const [newRate, setNewRate] = useState('150');
  const [newRating, setNewRating] = useState('4.8');
  const [newAvailability, setNewAvailability] = useState('Flexible');
  const [newSummary, setNewSummary] = useState('');
  const [addingManual, setAddingManual] = useState(false);

  const [activeProfile, setActiveProfile] = useState<Expert | null>(null);

  const fetchExperts = () => {
    setLoading(true);
    authFetch('/api/experts')
      .then(res => res.json())
      .then(data => {
        setExperts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchExperts();

    authFetch('/api/sheets/config')
      .then(res => res.json())
      .then(data => {
        if (data && data.url) {
          setSheetUrl(data.url);
        }
      })
      .catch((e) => console.warn('Failed to load stored sheet config:', e));
  }, []);

  const handleSyncSheets = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;

    setSyncing(true);
    setSyncError(null);
    setSyncSuccess(null);

    try {
      const response = await authFetch('/api/sheets/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: sheetUrl })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync Google Sheets roster.');
      }

      setSyncSuccess(`Success! Synced ${data.count} expert records dynamically.`);
      setExperts(data.experts);
      localStorage.removeItem('swyn_directory_cleared');
      setHasClearedDeliberately(false);
      setTimeout(() => setShowSyncPanel(false), 2000);
    } catch (err: any) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleClearAll = async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/experts/clear', {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        setExperts(data.experts || []);
        localStorage.setItem('swyn_directory_cleared', 'true');
        setHasClearedDeliberately(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setConfirmDeleteAll(false);
    }
  };

  const handleAddManualExpert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newTitle.trim()) return;

    setAddingManual(true);
    try {
      const newRecord = {
        id: Math.random().toString(36).substring(2, 10),
        name: newName,
        expertise: newTitle,
        summary: newSummary || "Curated expert specializing in strategic organizational direction.",
        hourlyRate: parseFloat(newRate) || 150,
        rating: parseFloat(newRating) || 4.8,
        availability: newAvailability || "Flexible",
        industry: newIndustry || "Startups",
        experience: newExperience || "20–25 years"
      };

      setExperts(prev => [newRecord, ...prev]);

      const response = await authFetch('/api/experts/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ expert: newRecord })
      });

      if (response.ok) {
        const data = await response.json();
        setExperts(data.experts);
        localStorage.removeItem('swyn_directory_cleared');
        setHasClearedDeliberately(false);
      }

      setShowAddModal(false);
      setNewName('');
      setNewTitle('');
      setNewIndustry('');
      setNewSummary('');
    } catch (err) {
      console.error(err);
    } finally {
      setAddingManual(false);
    }
  };

  const getDisplayExperts = () => {
    if (experts.length > 0) return experts;
    if (hasClearedDeliberately || localStorage.getItem('swyn_directory_cleared') === 'true') {
      return [];
    }

    return [
      {
        id: "exp-1",
        name: "BIBHUDUTTA SATPATHY",
        expertise: "Senior Vice President",
        summary: "PSU / Government executive with over 25 years of organizational scaling experience.",
        hourlyRate: 250,
        rating: 4.9,
        availability: "Flexible",
        industry: "PSU / Government",
        experience: "25+ years"
      },
      {
        id: "exp-2",
        name: "Mohammed Yunus salim Mulla",
        expertise: "Store Head sales and operations",
        summary: "Retail operational driver directing consumer-facing startups and scaling stores.",
        hourlyRate: 180,
        rating: 4.7,
        availability: "Active",
        industry: "Retail / D2C",
        experience: "20–25 years"
      },
      {
        id: "exp-3",
        name: "Sarita Roy Choudhary",
        expertise: "Sourcing and partnership Manager",
        summary: "Supply partner and procurement leader managing complex vendor alliances.",
        hourlyRate: 195,
        rating: 4.8,
        availability: "Flexible",
        industry: "BFSI, Manufacturing, Retail / D2C, EdTech, GCC / Captives, Startups",
        experience: "20–25 years"
      },
      {
        id: "exp-4",
        name: "Gautam Dutta",
        expertise: "CEO",
        summary: "Founder executive launching scalable FMCG distribution networks.",
        hourlyRate: 300,
        rating: 5.0,
        availability: "Mon-Wed",
        industry: "FMCG, Startups",
        experience: "25+ years"
      }
    ];
  };

  const displayExperts = getDisplayExperts();

  const filteredExperts = displayExperts.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.expertise && e.expertise.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (e.summary && e.summary.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (e.industry && e.industry.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-20 font-sans">
      <div className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold text-gray-900 tracking-tight">Experts Data Directory</h2>
            <span className="bg-gradient-to-r from-swyn-goldLight to-amber-100 text-swyn-goldDark border border-swyn-goldMedium/20 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
              {filteredExperts.length} Experts
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-1 font-medium">
            Manage, sync, and view all your expert records.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <button 
            onClick={() => {
              const csvContent = "data:text/csv;charset=utf-8,Name,Expertise,Summary,Rate,Rating,Availability,Industry,Experience\nJohn Doe,Director Advisory,Experienced consultant,150,4.8,Mon-Wed,Startups,25+ years";
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", "swynmatch_template.csv");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-gray-150 text-gray-400 hover:bg-gray-50 bg-white rounded-xl transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Template
          </button>

          <button 
            onClick={() => setShowSyncPanel(!showSyncPanel)}
            className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl transition-all shadow-sm ${
              showSyncPanel 
                ? 'bg-swyn-orange/10 border-swyn-orange/30 text-swyn-orange' 
                : 'border-swyn-orange/20 text-swyn-orange hover:bg-swyn-orange/5 bg-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Manage Sheets
          </button>

          <button 
            onClick={() => setShowSyncPanel(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-swyn-orange/20 text-swyn-orange hover:bg-swyn-orange/5 bg-white rounded-xl transition-all shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload CSV
          </button>

          {confirmDeleteAll ? (
            <div className="flex items-center gap-1 bg-red-50 border border-red-150 p-1 rounded-xl shadow-sm transition-all">
              <button 
                onClick={handleClearAll}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all text-[11px] font-bold"
              >
                <Check className="w-3 h-3" />
                Yes, Purge
              </button>
              <button 
                onClick={() => setConfirmDeleteAll(false)}
                className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 hover:bg-gray-100 text-gray-500 rounded-lg bg-white transition-all text-[11px] font-bold"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setConfirmDeleteAll(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-red-200 text-red-500 hover:bg-red-50/60 bg-white rounded-xl transition-all shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete All
            </button>
          )}

          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-swyn-orange hover:bg-swyn-orangeHover text-white rounded-xl transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Manual
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showSyncPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-sm max-w-3xl space-y-5">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Google Sheets Synchronization</h3>
                <p className="text-xs text-gray-400 mt-1 font-medium">Link your spreadsheet parameters to refresh expert rosters into the core application database.</p>
              </div>

              <form onSubmit={handleSyncSheets} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide pl-1">Target Worksheet CSV/Export Link</label>
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      required
                      placeholder="e.g. https://docs.google.com/spreadsheets/d/your-spreadsheet-id/edit"
                      className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-150 rounded-xl focus:bg-white focus:ring-2 focus:ring-swyn-orange/20 focus:border-swyn-orange outline-none transition-all text-xs font-semibold"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                    />
                    <button 
                      type="submit"
                      disabled={syncing || !sheetUrl.trim()}
                      className="px-5 bg-swyn-orange hover:bg-swyn-orangeHover disabled:opacity-50 text-white rounded-xl font-semibold text-xs transition-all flex items-center gap-1.5 shrink-0"
                    >
                      {syncing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Indexing...
                        </>
                      ) : (
                        "Sync Now"
                      )}
                    </button>
                  </div>
                </div>

                {syncSuccess && (
                  <div className="p-3 bg-green-50 border border-green-100 text-green-700 text-xs font-bold rounded-xl flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>{syncSuccess}</span>
                  </div>
                )}

                {syncError && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>{syncError}</span>
                  </div>
                )}
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-2xl border border-gray-150 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <div className="relative w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search experts, industries, experiences..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 focus:bg-white rounded-xl text-xs outline-none font-semibold transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50/30">
                <th className="py-4 px-6">EXPERT</th>
                <th className="py-4 px-6">INDUSTRY</th>
                <th className="py-4 px-6">EXPERIENCE</th>
                <th className="py-4 px-6 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center">
                    <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-2" />
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Refreshing Repository</p>
                  </td>
                </tr>
              ) : filteredExperts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-gray-400 font-medium text-xs">
                    No matching expert records currently found.
                  </td>
                </tr>
              ) : (
                filteredExperts.map((expert) => {
                  const initial = String(expert?.name || "E").charAt(0).toUpperCase();
                  const industryVal = expert.industry || expert.expertise || 'Consulting';
                  const experienceVal = expert.experience || '20–25 years';

                  return (
                    <tr key={expert.id} className="hover:bg-gray-50/50 transition-colors align-middle">
                      <td className="py-4 px-6 whitespace-nowrap">
                        <div className="flex items-center space-x-3.5">
                          <div className="w-9 h-9 rounded-full bg-swyn-goldLight border border-swyn-goldMedium/30 flex items-center justify-center text-swyn-goldDark font-bold text-sm shadow-sm shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <span 
                              onClick={() => setActiveProfile(expert)}
                              className="block font-bold text-sm text-swyn-orange hover:text-swyn-orangeHover tracking-wide uppercase hover:underline cursor-pointer"
                            >
                              {expert.name}
                            </span>
                            <span className="block text-xs font-semibold text-gray-400 truncate max-w-xs mt-0.5">
                              {expert.expertise}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-6 text-xs font-semibold text-gray-650 max-w-md truncate">
                        {industryVal}
                      </td>

                      <td className="py-4 px-6 text-xs text-gray-650 font-semibold whitespace-nowrap">
                        {experienceVal}
                      </td>

                      <td className="py-4 px-6 text-center whitespace-nowrap">
                        <button 
                          onClick={() => setActiveProfile(expert)}
                          className="p-1 px-2.5 border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-950 rounded-lg text-[10px] font-bold uppercase transition-all"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 relative"
            >
              <button 
                onClick={() => setShowAddModal(false)}
                className="absolute top-5 right-5 p-1.5 text-gray-400 hover:text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <form onSubmit={handleAddManualExpert} className="space-y-4 font-sans">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Add Manual Expert</h3>
                  <p className="text-xs text-gray-450 mt-0.5">Register a resource record directly inside the catalog directory.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Full Name</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. BIBHUDUTTA SATPATHY"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-150 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-orange-500/10 text-xs font-semibold"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Job Title / Designation</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Senior Vice President"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-150 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-orange-500/10 text-xs font-semibold"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Core Industry / Verticals</label>
                    <input 
                      type="text"
                      placeholder="e.g. PSU / Government, Scaling"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-150 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-orange-500/10 text-xs font-semibold"
                      value={newIndustry}
                      onChange={(e) => setNewIndustry(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Experience Span</label>
                    <select
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-150 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-orange-500/10 text-xs font-semibold"
                      value={newExperience}
                      onChange={(e) => setNewExperience(e.target.value)}
                    >
                      <option value="25+ years">25+ years</option>
                      <option value="20–25 years">20–25 years</option>
                      <option value="15–20 years">15–20 years</option>
                      <option value="10–15 years">10–15 years</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Hourly Rate ($)</label>
                    <input 
                      type="number"
                      placeholder="150"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-150 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-orange-500/10 text-xs font-semibold"
                      value={newRate}
                      onChange={(e) => setNewRate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Availability</label>
                    <input 
                      type="text"
                      placeholder="e.g. Flexible / Mon-Wed"
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-150 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-orange-500/10 text-xs font-semibold"
                      value={newAvailability}
                      onChange={(e) => setNewAvailability(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Brief Summary Bio</label>
                  <textarea 
                    rows={3}
                    placeholder="Brief highlights description about leadership domain and background history..."
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-150 rounded-xl focus:bg-white outline-none focus:ring-2 focus:ring-orange-500/10 text-xs font-semibold resize-none"
                    value={newSummary}
                    onChange={(e) => setNewSummary(e.target.value)}
                  />
                </div>

                <button 
                  type="submit"
                  disabled={addingManual}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1"
                >
                  {addingManual && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Register Expert
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                      {String(activeProfile?.name || "E").charAt(0).toUpperCase()}
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
                                <span className="text-xs font-semibold text-gray-800 break-words leading-relaxed block whitespace-pre-line">
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
};

export default ExpertsDirectory;
