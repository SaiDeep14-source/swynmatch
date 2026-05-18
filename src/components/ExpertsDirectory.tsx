import React, { useState, useEffect, useRef } from 'react';
import { Expert, SheetSource } from '../types';
import { Trash2, Upload, Plus, AlertCircle, CheckCircle2, Download, FileSpreadsheet, Link as LinkIcon, Loader2, ChevronDown, ChevronRight, Mail, AlignLeft, RefreshCw, X, ExternalLink, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import { authFetch } from '../lib/api';

export default function ExpertsDirectory() {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manual entry state
  const [showManualForm, setShowManualForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    industry: '',
    experience: '',
    email: '',
    notes: ''
  });

  // Links sync state
  const [showLinksForm, setShowLinksForm] = useState(false);
  const [linksInput, setLinksInput] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [sources, setSources] = useState<SheetSource[]>([]);

  // Selected expert for profile modal
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);

  const fetchExperts = async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/experts');
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setExperts(data);
          setError(null);
        } catch (parseErr) {
          console.error('Failed to parse experts JSON:', text.substring(0, 100));
          setError('Server returned invalid data format');
        }
      } else {
        const errorText = await res.text().catch(() => 'No error details');
        setError(`Failed to fetch experts: ${res.status} ${res.statusText}`);
        console.error('API Error:', res.status, errorText);
      }
    } catch (err: any) {
      setError(`Connection error: ${err.message || 'Unknown'}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchSources = async () => {
    try {
      const res = await authFetch('/api/sources');
      if (res.ok) {
        setSources(await res.json());
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchExperts();
    fetchSources();
  }, []);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: async (results) => {
        const knownKeys = ['id', 'name', 'fullname', 'full name', 'expert', 'role', 'title', 'job', 'job title', 'current job title / role', 'current professional headline', 'current / most recent role', 'industry', 'primary industry', 'key sectors / industries', 'sectors', 'experience', 'exp', 'level', 'years', 'total years of experience', 'total years of professional experience', 'email', 'personal email', 'contact', 'notes', 'description', 'bio', 'brief professional bio', 'please provide a brief biography / professional summary', 'first name', 'last name'];
        const parsedExperts: Expert[] = results.data.map((row: any) => {
          const industry = row.industry || row['primary industry'] || row['key sectors / industries'] || row.sectors || '';
          
          const metadata: Record<string, any> = {};
          for (const key of Object.keys(row)) {
            if (key && !knownKeys.includes(key.toLowerCase()) && row[key] !== '') {
              metadata[key] = row[key];
            }
          }

          let name = row.name || row.fullname || row['full name'] || row.expert || '';
          if (!name && row['first name']) {
            name = `${row['first name']} ${row['last name'] || ''}`.trim();
          }
          if (!name) name = 'Unknown';

          const role = row.role || row.title || row.job || row['job title'] || row['current job title / role'] || row['current professional headline'] || row['current / most recent role'] || '';
          const experience = row.experience || row.exp || row.level || row.years || row['total years of experience'] || row['total years of professional experience'] || '';
          const email = row.email || row['personal email'] || row.contact || '';
          const notes = row.notes || row.description || row.bio || row['brief professional bio'] || row['please provide a brief biography / professional summary'] || '';

          return {
            id: row.id || uuidv4(),
            name,
            role,
            industry,
            experience,
            email,
            notes,
            metadata
          };
        }).filter((expert) => expert.name !== 'Unknown');

        try {
          // Sync to server entirely
          const res = await authFetch('/api/experts/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ experts: parsedExperts }),
          });

          if (res.ok) {
            fetchExperts();
            showSuccess(`Successfully synchronized ${parsedExperts.length} experts from sheet.`);
          } else {
            setError('Failed to sync experts');
            setTimeout(() => setError(null), 3000);
          }
        } catch (err) {
          setError('Failed to sync experts. Connection error.');
          setTimeout(() => setError(null), 3000);
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (err) => {
         setError(`Error parsing CSV: ${err.message}`);
         setTimeout(() => setError(null), 3000);
      }
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await authFetch(`/api/experts/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setExperts(prev => prev.filter(e => e.id !== id));
        showSuccess('Expert deleted successfully.');
      } else {
        setError('Failed to delete expert.');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError('Connection error while deleting.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newExpert: Expert = {
      id: uuidv4(),
      name: formData.name,
      role: formData.role,
      industry: formData.industry,
      experience: formData.experience,
      email: formData.email,
      notes: formData.notes
    };

    try {
      const res = await authFetch('/api/experts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExpert),
      });

      if (res.ok) {
        setExperts(prev => [...prev, newExpert]);
        setShowManualForm(false);
        setFormData({ name: '', role: '', industry: '', experience: '', email: '', notes: '' });
        showSuccess('Expert added manually.');
      } else {
         setError('Failed to add expert manually.');
         setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
       setError('Connection error while adding expert.');
       setTimeout(() => setError(null), 3000);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "name,role,industry,experience,email,notes\n"
      + "Jane Doe,Senior Consultant,Healthcare,5 years,jane@example.com,Great communicator";
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "expert_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linksInput.trim() && sources.length === 0) return;

    setIsSyncing(true);
    setError(null);
    try {
      // 1. Add all new links first
      const urls = linksInput.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      for (const url of urls) {
        // Just post to /api/sources, ignore error if already exists
        await authFetch('/api/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
      }

      // 2. Refresh sources list
      await fetchSources();

      // 3. Sync all sources
      const res = await authFetch('/api/sources/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) // syncs all
      });

      if (res.ok) {
        const data = await res.json();
        const successCount = data.sources?.filter((s: any) => s.status === 'success').length || 0;
        const errorCount = data.sources?.filter((s: any) => s.status === 'error').length || 0;
        
        if (errorCount === 0) {
          showSuccess(`Successfully synchronized ${data.count} experts from ${successCount} sources.`);
        } else {
          showSuccess(`Sync partially successful: ${data.count} experts added from ${successCount} sources. ${errorCount} sources failed.`);
          const errors = data.sources
            .filter((s: any) => s.status === 'error')
            .map((s: any) => s.error)
            .join(', ');
          console.warn('Sync errors:', errors);
        }
        setLinksInput('');
        fetchExperts(); // Refresh list
        fetchSources();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to sync from links.');
      }
    } catch (err) {
      setError('Connection error while syncing links.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncSingleSource = async (id: string) => {
    setIsSyncing(true);
    setError(null);
    try {
      const res = await authFetch('/api/sources/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: id })
      });

      if (res.ok) {
        const data = await res.json();
        const sourceResult = data.sources?.[0];
        if (sourceResult?.status === 'error') {
          setError(`Failed to sync source: ${sourceResult.error}`);
        } else {
          showSuccess(`Successfully synchronized ${data.count} experts from this source.`);
          fetchExperts();
          fetchSources();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to sync source.');
      }
    } catch (err) {
      setError('Connection error.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRemoveSource = async (id: string) => {
    try {
      const res = await authFetch(`/api/sources/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showSuccess('Source removed successfully.');
        fetchSources();
      } else {
        setError('Failed to delete source.');
      }
    } catch (err) {
      setError('Connection error while deleting.');
    }
  };

  const isUrl = (string: string) => {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <FileSpreadsheet className="h-6 w-6 mr-2 text-orange-600" />
            Experts Data Directory
            <span className="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
              {experts.length} {experts.length === 1 ? 'Expert' : 'Experts'}
            </span>
          </h2>
          <p className="text-gray-500 mt-1">Manage, sync, and view all your expert records.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            id="csv-upload"
          />
          <button 
            onClick={() => handleDownloadTemplate()}
            className="flex-1 sm:flex-none flex justify-center items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <Download className="h-4 w-4 mr-2" />
            Template
          </button>
          <button 
            onClick={() => { setShowLinksForm(!showLinksForm); setShowManualForm(false); }}
            className="flex-1 sm:flex-none flex justify-center items-center px-4 py-2 bg-orange-50 text-orange-700 hover:bg-orange-100 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <LinkIcon className="h-4 w-4 mr-2" />
            Manage Sheets
          </button>
          <label 
            htmlFor="csv-upload"
            className="flex-1 sm:flex-none flex justify-center items-center px-4 py-2 bg-orange-50 text-orange-700 hover:bg-orange-100 text-sm font-medium rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </label>
          <button 
            onClick={() => { setShowManualForm(!showManualForm); setShowLinksForm(false); }}
            className="flex-1 sm:flex-none flex justify-center items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Manual
          </button>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            <AlertCircle className="h-5 w-5 mr-3 shrink-0" />
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
            <CheckCircle2 className="h-5 w-5 mr-3 shrink-0" />
            {success}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLinksForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Connected Sheets</h3>
              {sources.length > 0 && (
                <button
                  type="button"
                  onClick={handleSyncLinks}
                  disabled={isSyncing}
                  className="px-3 py-1.5 border border-transparent rounded shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 inline-flex items-center"
                >
                  {isSyncing ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sync All Sources
                </button>
              )}
            </div>

            {sources.length > 0 && (
              <div className="mb-6 border rounded-lg overflow-x-auto border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sheet URL</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Last Synced</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sources.map(source => (
                      <tr key={source.id}>
                        <td className="px-4 py-3 text-sm text-gray-900 break-all max-w-[200px] sm:max-w-md">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline line-clamp-2 md:line-clamp-none">{source.url}</a>
                          </div>
                          <div className="sm:hidden text-xs text-gray-500 mt-1">
                             Synced: {source.lastSynced ? new Date(source.lastSynced).toLocaleString() : 'Never'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                          {source.lastSynced ? new Date(source.lastSynced).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => handleSyncSingleSource(source.id)} className="text-orange-600 hover:text-orange-900 p-2 hover:bg-orange-50 rounded inline-flex items-center" title="Sync this sheet">
                            <RefreshCw className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1 text-xs">Sync</span>
                          </button>
                          <button onClick={() => handleRemoveSource(source.id)} className="text-red-600 hover:text-red-900 ml-1 p-2 hover:bg-red-50 rounded inline-flex items-center" title="Remove this sheet">
                            <Trash2 className="h-4 w-4" />
                            <span className="hidden sm:inline ml-1 text-xs">Remove</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form onSubmit={handleSyncLinks}>
              <h4 className="text-sm font-medium text-gray-900 mb-2">{sources.length > 0 ? "Add More Sheets" : "Add Sheet Links"}</h4>
              <p className="text-xs text-gray-500 mb-2">Paste multiple Google Sheets Links (one per line). Make sure they are "Anyone with the link can view".</p>
              <textarea 
                value={linksInput} 
                onChange={e => setLinksInput(e.target.value)} 
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm" 
                placeholder="https://docs.google.com/spreadsheets/d/...&#10;https://docs.google.com/spreadsheets/d/..." 
                rows={3} 
              />
              <div className="mt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowLinksForm(false)} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500">
                  Close
                </button>
                <button disabled={isSyncing || (!linksInput.trim() && sources.length === 0)} type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50">
                  {isSyncing ? <><Loader2 className="animate-spin h-4 w-4 inline mr-2" /> Processing...</> : (linksInput.trim() ? 'Add & Sync New' : 'Sync All')}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showManualForm && (
          <motion.form 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: 'auto' }} 
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleManualSubmit}
            className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm overflow-hidden"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Expert Manually</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm" placeholder="John Doe" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Role</label>
                <input required type="text" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm" placeholder="Software Engineer" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Industry</label>
                <input type="text" value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm" placeholder="e.g. Healthcare, Finance" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Experience Level</label>
                <input type="text" value={formData.experience} onChange={e => setFormData({...formData, experience: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm" placeholder="5 Years" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm" placeholder="john@example.com" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Notes (Optional)</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500 sm:text-sm" placeholder="Additional details..." rows={2} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setShowManualForm(false)} className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500">
                Save Expert
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Experts List */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading experts...</div>
        ) : experts.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center">
            <div className="h-12 w-12 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mb-4">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No experts found</h3>
            <p className="mt-1 text-gray-500 max-w-sm">Upload a CSV sheet to sync experts or add them manually to build your directory.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expert</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Industry</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Experience</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {experts.map((expert) => {
                  return (
                  <React.Fragment key={expert.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => setSelectedExpert(expert)}>
                        <div className="flex items-center">
                          <div className="mr-3 w-5 h-5 flex items-center justify-center text-gray-400">
                             <User className="h-4 w-4" />
                          </div>
                          <div className="h-10 w-10 flex-shrink-0 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold uppercase">
                            {expert.name.charAt(0)}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-orange-600 hover:underline">{expert.name}</div>
                            <div className="text-sm text-gray-500">{expert.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 cursor-pointer text-sm text-gray-700" onClick={() => setSelectedExpert(expert)}>
                        {expert.industry || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer" onClick={() => setSelectedExpert(expert)}>
                        {expert.experience || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedExpert(expert); }}
                          className="text-orange-600 hover:text-orange-900 transition-colors p-2 hover:bg-orange-50 rounded-md inline-flex items-center mr-2"
                          title="View Profile"
                        >
                          <User className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(expert.id); }}
                          className="text-red-500 hover:text-red-700 transition-colors p-2 hover:bg-red-50 rounded-md inline-flex items-center"
                          title="Delete Expert"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  </React.Fragment>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expert Profile Modal */}
      <AnimatePresence>
        {selectedExpert && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
              onClick={() => setSelectedExpert(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-10 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:max-w-2xl w-full bg-white rounded-2xl shadow-xl z-50 overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="bg-orange-600 px-6 py-8 relative text-white shrink-0">
                <button 
                  onClick={() => setSelectedExpert(null)}
                  className="absolute right-4 top-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="flex items-center">
                  <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center text-orange-600 text-2xl font-bold uppercase shadow-sm">
                     {selectedExpert.name.charAt(0)}
                  </div>
                  <div className="ml-5">
                    <h2 className="text-2xl font-bold">{selectedExpert.name}</h2>
                    <p className="text-orange-100 mt-1 text-lg">{selectedExpert.role || 'No Role Specified'}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto bg-gray-50 flex-1">
                <div className="space-y-8">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                     <div>
                       <span className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Experience</span>
                       <span className="text-gray-900 font-medium">{selectedExpert.experience || 'Not specified'}</span>
                     </div>
                     <div>
                       <span className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Email Connection</span>
                       {selectedExpert.email ? (
                         <a href={`mailto:${selectedExpert.email}`} className="text-orange-600 hover:underline font-medium flex items-center">
                           <Mail className="h-4 w-4 mr-2" />
                           {selectedExpert.email}
                         </a>
                       ) : (
                         <span className="text-gray-500">Not specified</span>
                       )}
                     </div>
                     <div className="sm:col-span-2">
                        <span className="block text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Industry</span>
                        <div className="text-gray-900 font-medium">
                          {selectedExpert.industry || <span className="text-gray-500 font-normal">Not specified</span>}
                        </div>
                     </div>
                  </div>

                  {/* Bio/Notes */}
                  {selectedExpert.notes && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <AlignLeft className="h-5 w-5 mr-2 text-orange-500" />
                        Bio & Notes
                      </h3>
                      <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedExpert.notes}</p>
                      </div>
                    </div>
                  )}

                  {/* Metadata / Other Details / Links */}
                  {selectedExpert.metadata && Object.keys(selectedExpert.metadata).length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                        <LinkIcon className="h-5 w-5 mr-2 text-orange-500" />
                        Additional Details & Documents
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(selectedExpert.metadata).map(([key, value]) => {
                          const valStr = value as string;
                          const isLink = isUrl(valStr);
                          
                          return (
                            <div key={key} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                              <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{key}</span>
                              {isLink ? (
                                <a href={valStr} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:text-orange-800 hover:underline flex items-start mt-1 font-medium break-all">
                                  <ExternalLink className="h-4 w-4 mr-2 shrink-0 mt-0.5" />
                                  <span>{valStr}</span>
                                </a>
                              ) : (
                                <span className="block text-gray-800 break-words">{valStr}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-4 bg-white border-t border-gray-100 flex justify-end shrink-0">
                 <button 
                  onClick={() => setSelectedExpert(null)}
                  className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
                 >
                   Close Profile
                 </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
