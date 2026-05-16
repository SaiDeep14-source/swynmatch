import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, setDoc, getDocs, deleteDoc, writeBatch, where, arrayUnion, arrayRemove, limit, startAfter } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Expert } from '../../types';
import { useFirebase } from '../../contexts/FirebaseContext';
import { Search, RotateCw, ExternalLink, Filter, ArrowUpDown, Settings, X, Info, Award, Mail, Phone, MapPin, DollarSign, Clock, Briefcase, FileText, Link as LinkIcon, RefreshCw, Users, AlertTriangle, Trash2, Plus } from 'lucide-react';
import Papa from 'papaparse';

interface SheetSource {
  id: string;
  url: string;
  name: string;
  lastSynced?: number;
  status: 'active' | 'error';
}

export const ExpertsList = () => {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [sheets, setSheets] = useState<SheetSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState<string | null>(null); // Tracks specific sheet ID being synced
  const [showConfig, setShowConfig] = useState(false);
  const [newSheetUrl, setNewSheetUrl] = useState('');
  const [newSheetName, setNewSheetName] = useState('');
  const [selectedExpert, setSelectedExpert] = useState<Expert | null>(null);
  const [lastSynced, setLastSynced] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, danger?: boolean, onConfirm: () => void} | null>(null);
  const [selectedSource, setSelectedSource] = useState('All');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [newExpert, setNewExpert] = useState<Partial<Expert>>({
    name: '',
    role: '',
    bio: '',
    status: 'active',
    experience: [],
    tags: [],
    achievements: ''
  });

  // Fetch config from Firestore on mount
  useEffect(() => {
    const configRef = doc(db, 'config', 'experts_sync');
    const unsubscribe = onSnapshot(configRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.lastSynced) setLastSynced(data.lastSynced);
      }
    }, (error) => {
      console.warn("Config sync error:", error);
    });

    return () => unsubscribe();
  }, []);

  // Fetch Sheets
  useEffect(() => {
    const sheetsRef = collection(db, 'sheets');
    const unsubscribe = onSnapshot(sheetsRef, (snapshot) => {
      const sheetsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SheetSource[];
      setSheets(sheetsData);
    });

    return () => unsubscribe();
  }, []);

  const { isAdmin, loading: authLoading, user } = useFirebase();

  // Robust admin check for both Firestore role and hardcoded whitelisted emails
  const isEffectiveAdmin = useMemo(() => {
    if (authLoading) return false;
    const email = user?.email?.toLowerCase().trim();
    const isWhitelisted = email === 'saideepalahari14@gmail.com' || email === 'sai@swyn.in';
    return isAdmin || isWhitelisted;
  }, [isAdmin, user, authLoading]);

  useEffect(() => {
    if (syncing) {
      console.info("Syncing active for:", syncing);
    }
  }, [syncing]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    if (authLoading) return;

    if (!isEffectiveAdmin) {
      alert('Only admins can update expert status.');
      return;
    }
    try {
      const expertRef = doc(db, 'experts', id);
      await updateDoc(expertRef, { status: newStatus as any });
      // State will update via onSnapshot
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `experts/${id}`);
    }
  };

  useEffect(() => {
    const expertsRef = collection(db, 'experts');
    const unsubscribe = onSnapshot(expertsRef, (snapshot) => {
      const expertData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expert[];
      setExperts(expertData);
      setLoading(false);
    }, (error) => {
      console.error("Pool list error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddSheet = async () => {
    if (!isEffectiveAdmin) {
      alert("Admin access required.");
      return;
    }
    if (!newSheetUrl.trim()) return;
    const id = `sheet-${Date.now()}`;
    try {
      await setDoc(doc(db, 'sheets', id), {
        id,
        url: newSheetUrl,
        name: newSheetName || `Sheet ${sheets.length + 1}`,
        status: 'active',
        lastSynced: null
      });
      setNewSheetUrl('');
      setNewSheetName('');
    } catch (err) {
      console.error("Failed to add sheet:", err);
    }
  };

  const handleSheetDetails = (sheet: SheetSource) => {
    window.open(sheet.url, '_blank');
  };

  const handleDeleteSheet = async (id: string) => {
    if (!isEffectiveAdmin) {
      alert("Admin access required.");
      return;
    }
    setConfirmDialog({
      isOpen: true,
      message: "Delete this sheet source? Linked experts will be removed on next sync or manual deletion.",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'sheets', id));
          setConfirmDialog(null);
        } catch (err) {
          console.error("Failed to delete sheet:", err);
        }
      }
    });
  };

  const handleSyncSheet = async (sheetObj: SheetSource, skipSyncingReset = false) => {
    if (authLoading) return;

    if (!isEffectiveAdmin) {
      alert("Authentication error: Admin rights not detected.");
      return;
    }
    if (!skipSyncingReset) {
      setSyncing(sheetObj.id);
      setSyncError('');
    }

    try {
      console.info(`Starting sync for sheet: ${sheetObj.name}`);
      let sid = sheetObj.url.trim().replace(/\s+/g, '');
      let gid = '';

      if (sid.includes('docs.google.com')) {
        // Handle various URL formats including /export or /edit
        const match = sid.match(/\/d\/([a-zA-Z0-9-_]+)/);
        const gidMatch = sid.match(/[#&?]gid=([0-9]+)/);
        if (match && match[1]) {
          sid = match[1];
          if (gidMatch && gidMatch[1]) gid = gidMatch[1];
        } else {
          // Try alternative regex if the first one fails
          const altMatch = sid.match(/spreadsheets\/d\/([^\/]+)/);
          if (altMatch) {
            sid = altMatch[1];
            if (gidMatch && gidMatch[1]) gid = gidMatch[1];
          }
        }
      } else if (sid.includes(':')) {
        const parts = sid.split(':');
        sid = parts[0];
        gid = parts[1] || '';
      }

      console.info(`Requesting proxy for: ${sheetObj.name} | sid: ${sid} | gid: ${gid}`);
      const url = `/api/proxy-sheet?id=${encodeURIComponent(sid)}${gid ? `&gid=${encodeURIComponent(gid)}` : ''}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        let errMsg = `Source "${sheetObj.name}" unreachable (Status: ${response.status}).`;
        try {
          // Attempt to read as text first to see if it's HTML or JSON
          const errorText = await response.text();
          try {
            const errData = JSON.parse(errorText);
            if (errData && errData.error) {
              errMsg = errData.error;
            }
          } catch (e) {
            // If it's an HTML page from Cloudflare or Google, capture a snippet
            if (errorText.includes('<html') || errorText.includes('<!DOCTYPE')) {
              errMsg = `Server error (Status: ${response.status}). The endpoint returned an HTML page.`;
            } else {
              errMsg = `Server error (Status: ${response.status}): ${errorText.substring(0, 50)}...`;
            }
          }
        } catch (e) {
            // Ignore text reading error
        }
        throw new Error(errMsg);
      }
      
      const csvText = await response.text();
      if (csvText.includes('<!DOCTYPE html>') || csvText.includes('login') || csvText.includes('<html')) {
        throw new Error(`Sheet "${sheetObj.name}" is private or invalid (did you paste a Google Forms link instead of the Responses Sheet?). Share it as "Anyone with the link can view".`);
      }

      const expertsFromSheet = await parseCSV(csvText);
      console.info(`Found ${expertsFromSheet.length} records in ${sheetObj.name}`);

      const tagged = expertsFromSheet.map((e, index) => ({ 
        ...e, 
        sourceSheet: sheetObj.name, 
        sourceSheetId: sheetObj.id,
        // Include source sheet info in a robust way
        sourceSheets: [sheetObj.name],
        sourceSheetIds: [sheetObj.id]
      }));

      // DEDUPLICATION & ID GENERATION
      const incomingExpertsMap = new Map<string, Expert>();
      tagged.forEach((exp, index) => {
        const nameClean = exp.name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const emailClean = (exp.metadata.computedEmail || '').toLowerCase().trim().replace(/[^a-z0-9@.-]/g, '');
        
        let fingerprint = '';
        if (emailClean) {
          fingerprint = emailClean.replace(/[^a-z0-9]/g, '');
        } else if (nameClean && nameClean !== 'unknownexpert') {
          const roleClean = exp.role.toLowerCase().trim().replace(/[^a-z0-9]/g, '').substring(0, 5);
          fingerprint = `${nameClean}-${roleClean}`;
        } else {
          // Unlikely to match across sheets but stops them wiping each other in the same sheet
          fingerprint = `row-${index}-${Math.random().toString(36).substr(2, 4)}`;
        }

        const finalId = `sheet-expert-${fingerprint}`;
        
        if (!incomingExpertsMap.has(finalId)) {
          incomingExpertsMap.set(finalId, { ...exp, id: finalId });
        } else {
          // Merge source info if already exists
          const existing = incomingExpertsMap.get(finalId)!;
          incomingExpertsMap.set(finalId, {
            ...existing,
            sourceSheetIds: Array.from(new Set([...existing.sourceSheetIds!, sheetObj.id])),
            sourceSheets: Array.from(new Set([...existing.sourceSheets!, sheetObj.name]))
          });
        }
      });

      // 1. Cleanup
      const expertsRef = collection(db, 'experts');
      const q = query(expertsRef, where('sourceSheetIds', 'array-contains', sheetObj.id));
      const oldMatchQuery = query(expertsRef, where('sourceSheetId', '==', sheetObj.id));
      
      const [newSnap, oldSnap] = await Promise.all([getDocs(q), getDocs(oldMatchQuery)]);
      const docsToProcess = new Map<string, any>();
      newSnap.docs.forEach(d => docsToProcess.set(d.id, d.data()));
      oldSnap.docs.forEach(d => docsToProcess.set(d.id, d.data()));

      const docsToCleanup = Array.from(docsToProcess.entries());
      const cleanupBatchSize = 500;
      
      for (let i = 0; i < docsToCleanup.length; i += cleanupBatchSize) {
        const batch = writeBatch(db);
        const chunk = docsToCleanup.slice(i, i + cleanupBatchSize);
        
        chunk.forEach(([docId, data]) => {
          if (!incomingExpertsMap.has(docId)) {
            const newSheetIds = (data.sourceSheetIds || []).filter((id: string) => id !== sheetObj.id);
            const newSheetNames = (data.sourceSheets || []).filter((name: string) => name !== sheetObj.name);
            
            if (newSheetIds.length === 0) {
              batch.delete(doc(db, 'experts', docId));
            } else {
              batch.update(doc(db, 'experts', docId), {
                sourceSheetIds: newSheetIds,
                sourceSheets: newSheetNames,
                sourceSheet: newSheetNames[0] || 'Unknown'
              });
            }
          }
        });
        await batch.commit();
      }

      // 2. Upsert
      const incomingList = Array.from(incomingExpertsMap.values());
      const batchSize = 500;
      
      for (let i = 0; i < incomingList.length; i += batchSize) {
        const chunk = incomingList.slice(i, i + batchSize);
        const upsertBatch = writeBatch(db);
        
        chunk.forEach(expert => {
          const expertRef = doc(db, 'experts', expert.id);
          upsertBatch.set(expertRef, {
            ...expert,
            sourceSheetIds: arrayUnion(sheetObj.id),
            sourceSheets: arrayUnion(sheetObj.name),
            sourceSheet: sheetObj.name
          }, { merge: true });
        });
        await upsertBatch.commit();
      }

      const now = Date.now();
      await updateDoc(doc(db, 'sheets', sheetObj.id), {
        lastSynced: now,
        status: 'active'
      });

      const timeStr = new Date(now).toLocaleString();
      setLastSynced(timeStr);
      await setDoc(doc(db, 'config', 'experts_sync'), { lastSynced: timeStr }, { merge: true });
      return incomingList.length;
    } catch (err: any) {
      console.error(`Sync error for ${sheetObj.name}:`, err);
      const errMsg = `"${sheetObj.name}": ${err.message}`;
      setSyncError(prev => prev ? `${prev} | ${errMsg}` : errMsg);
      await updateDoc(doc(db, 'sheets', sheetObj.id), { status: 'error' }).catch(() => {});
      if (skipSyncingReset) throw err;
      alert(`Sync failed for ${sheetObj.name}: ${err.message}`);
    } finally {
      if (!skipSyncingReset) setSyncing(null);
    }
  };

  const handleSyncAll = async () => {
    if (authLoading) return;
    
    if (!isEffectiveAdmin) {
      alert("Admin access required.");
      return;
    }
    setSyncing('all');
    setSyncError('');
    let successCount = 0;
    let totalExperts = 0;

    try {
      if (sheets.length === 0) {
        alert("No sheet sources configured.");
        return;
      }
      
      for (const sheet of sheets) {
        try {
          const count = await handleSyncSheet(sheet, true);
          if (count !== undefined) {
             successCount++;
             totalExperts += count;
          }
        } catch (err) {
          console.warn(`Skipping sheet ${sheet.name} due to failure.`);
        }
      }
      alert(`Sync process complete. Successfully synced ${successCount} of ${sheets.length} sources.`);
    } catch (err: any) {
      console.error("Global Sync Error:", err);
    } finally {
      setSyncing(null);
    }
  };



  const [syncError, setSyncError] = useState('');

  const parseCSV = (csvText: string): Promise<Expert[]> => {
    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          const parsed: Expert[] = results.data
            .filter((row: any) => {
              return Object.values(row).some(v => !!v && String(v).trim().length > 0);
            })
            .map((row: any, i: number) => {
              const obj: any = { id: '', metadata: {} };
              const normalizedRow: Record<string, string> = {};
              
              let fName = '', lName = '', name = '', role = '', bio = '', years = '', companies = '';
              let industry = '', sectors = '', mentorship = '', achievement = '', email = '', status = '';
              
              Object.entries(row).forEach(([rawKey, v]) => {
                const strV = String(v || '').trim();
                if (!rawKey) return;
                
                const k = rawKey.toLowerCase().trim();
                normalizedRow[k] = strV;
                obj.metadata[k] = v || ''; // preserve original keys in metadata
                
                if (!strV) return;

                if (k === 'first name' || k.includes('given name') || k === 'fname') fName = fName || strV;
                else if (k.includes('first name') && !fName) fName = strV; // fuzzy fallback
                else if (k === 'last name' || k.includes('surname') || k.includes('family name') || k === 'lname') lName = lName || strV;
                else if (k.includes('last name') && !lName) lName = strV;
                else if (k === 'name' || k === 'full name' || k === 'expert name') name = name || strV;
                else if ((k.includes('name') || k.includes('who are you')) && !name && !k.includes('company') && !fName && !lName) name = strV;
                
                else if (k === 'email' || k === 'email address' || k === 'contact email') email = email || strV;
                else if (k.includes('email') && !email) email = strV;

                else if (k === 'title' || k === 'job title' || k === 'role' || k === 'position' || k === 'designation') role = role || strV;
                else if ((k.includes('title') || k.includes('role') || k.includes('headline')) && !role) role = strV;

                else if (k === 'bio' || k === 'summary' || k === 'about' || k === 'description') bio = bio || strV;
                else if ((k.includes('bio') || k.includes('summary') || k.includes('about you') || k.includes('profile')) && !bio) bio = strV;

                else if (k === 'experience' || k === 'years of experience' || k === 'total exp') years = years || strV;
                else if ((k.includes('experience') || k.includes('years')) && !years) years = strV;

                else if (k === 'companies' || k === 'company' || k === 'organisations') companies = companies || strV;
                else if ((k.includes('compan') || k.includes('organi')) && !companies) companies = strV;

                else if (k === 'industry' || k === 'primary industry') industry = industry || strV;
                else if (k.includes('industr') && !industry) industry = strV;

                else if (k === 'sectors' || k === 'sector') sectors = sectors || strV;
                else if (k.includes('sector') && !sectors) sectors = strV;

                else if (k.includes('mentor') || k.includes('expertise')) mentorship = mentorship || strV;
                else if (k.includes('achieve')) achievement = achievement || strV;
                
                else if (k === 'status') status = strV;
              });

              obj.name = (fName || lName) ? `${fName} ${lName}`.trim() : (name || 'Unknown Expert');
              obj.role = role || 'Expert';
              obj.bio = bio || '';
              
              obj.experience = [
                ...(years ? [years.replace(/years?/i, '').trim() + ' Years Exp'] : []),
                ...companies.split(/[,;|]/).map(s => s.trim()).filter(Boolean)
              ];

              const allTags = [
                ...industry.split(/[,;|]/),
                ...sectors.split(/[,;|]/),
                ...mentorship.split(/[,;|]/)
              ].map(s => s.trim()).filter(Boolean);
              obj.tags = Array.from(new Set(allTags));

              obj.achievements = achievement || '';
              obj.status = status?.toLowerCase().includes('busy') ? 'busy' : (status?.toLowerCase().includes('unavail') ? 'unavailable' : 'active');
              obj.metadata.computedEmail = email;

              return obj as Expert;
            });
          resolve(parsed);
        }
      });
    });
  };

  const handleDeleteExpert = async (id: string | undefined) => {
    if (!id) return;
    
    if (!isEffectiveAdmin) {
      alert("Admin access denied. Your account does not have permission to delete entries.");
      return;
    }
    
    setConfirmDialog({
      isOpen: true,
      message: "Permanently remove this expert from the pool?",
      danger: true,
      onConfirm: async () => {
        setIsDeleting(id);
        try {
          const expertRef = doc(db, 'experts', id);
          await deleteDoc(expertRef);
          if (selectedExpert?.id === id) setSelectedExpert(null);
          console.info(`Expert ${id} deleted successfully.`);
        } catch (err: any) {
          console.error('Expert deletion failed:', err);
          let msg = err.message || 'Unknown error';
          if (msg.includes('permission')) {
            msg = 'Permission Denied: Your account is listed as admin in UI but Firestore rules rejected the delete. Please refresh or contact support.';
          }
          alert(`Delete Failed: ${msg}`);
        } finally {
          setIsDeleting(null);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleClearPool = async () => {
    if (!isEffectiveAdmin) {
      alert("Admin access denied. Your account does not have permission to clear the pool.");
      return;
    }
    
    setConfirmDialog({
      isOpen: true,
      message: "CRITICAL: This will permanently delete ALL experts in the pool. This action cannot be undone. Proceed?",
      danger: true,
      onConfirm: async () => {
        setSyncing('clearing');
        try {
          console.info("Starting pool clear operation...");
          const expertsRef = collection(db, 'experts');
          const snapshot = await getDocs(expertsRef);
          
          if (snapshot.empty) {
            alert("Pool is already empty.");
            setSyncing(null);
            setConfirmDialog(null);
            return;
          }

          console.info(`Found ${snapshot.size} records to clear.`);
          const batches = [];
          let currentBatch = writeBatch(db);
          let count = 0;
          
          for (const d of snapshot.docs) {
            currentBatch.delete(d.ref);
            count++;
            if (count === 500) {
              batches.push(currentBatch.commit());
              currentBatch = writeBatch(db);
              count = 0;
            }
          }
          if (count > 0) batches.push(currentBatch.commit());
          
          await Promise.all(batches);
          alert(`Success: ${snapshot.size} records cleared permanently.`);
          console.info("Pool cleared successfully.");
        } catch (err: any) {
          console.error("Clear Pool Error:", err);
          let msg = err.message || 'Unknown error';
          if (msg.includes('permission')) {
            msg = 'Permission Denied: Firestore rules rejected the mass delete. This usually means your admin status is not properly synced in the database.';
          }
          alert(`Failed to clear database: ${msg}`);
        } finally {
          setSyncing(null);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleManualAdd = async () => {
    if (!isEffectiveAdmin) {
      alert('Only admins can manually add experts.');
      return;
    }
    if (!newExpert.name || !newExpert.role) {
      alert('Name and Role are required.');
      return;
    }

    const nameClean = newExpert.name!.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const id = `manual-${nameClean}`;
    
    // Check if name already exists in current state to prevent manual duplicates
    if (experts.some(e => e.name.toLowerCase().trim() === newExpert.name!.toLowerCase().trim())) {
      alert("An expert with this name already exists in the pool.");
      return;
    }

    const expertData: Expert = {
      id,
      name: newExpert.name!,
      role: newExpert.role!,
      bio: newExpert.bio || '',
      experience: newExpert.experience || [],
      tags: newExpert.tags || [],
      achievements: newExpert.achievements || '',
      status: (newExpert.status as any) || 'active',
      sourceSheet: 'Manual Entry',
      sourceSheetIds: ['manual'],
      sourceSheets: ['Manual Entry'],
      metadata: {}
    };

    try {
      await setDoc(doc(db, 'experts', id), expertData);
      setShowAddModal(false);
      setNewExpert({
        name: '',
        role: '',
        bio: '',
        status: 'active',
        experience: [],
        tags: [],
        achievements: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `experts/${id}`);
    }
  };
  const filtered = useMemo(() => {
    let base = experts;
    if (selectedSource !== 'All') {
      const sel = selectedSource.trim().toLowerCase();
      base = base.filter(e => {
        if (selectedSource === 'Manual Entry') {
          return e.sourceSheetIds?.includes('manual') || e.id.startsWith('manual-');
        }
        
        const inArray = e.sourceSheets?.some(s => (s || '').trim().toLowerCase() === sel);
        const isStringMatch = (e.sourceSheet || '').trim().toLowerCase() === sel;
        const idMatch = e.sourceSheetIds?.includes(sheets.find(s => s.name.toLowerCase() === sel)?.id || 'NONE');
        
        return inArray || isStringMatch || idMatch;
      });
    }
    
    if (!searchTerm) return base;
    const term = searchTerm.toLowerCase().trim();
    return base.filter(e => {
      const basicMatch = 
        e.name.toLowerCase().includes(term) || 
        e.role.toLowerCase().includes(term) ||
        (e.sourceSheet || '').toLowerCase().includes(term) ||
        e.sourceSheets?.some(s => s.toLowerCase().includes(term));
      if (basicMatch) return true;
      
      // Deep search in metadata
      if (e.metadata) {
        return Object.values(e.metadata).some(v => 
          String(v || '').toLowerCase().includes(term)
        );
      }
      return false;
    });
  }, [experts, searchTerm, selectedSource]);

  const sourcesList = useMemo(() => {
    const s = new Set<string>();
    sheets.forEach(sh => s.add(sh.name));
    
    // Also add manual entries if any exist
    if (experts.some(e => e.sourceSheetIds?.includes('manual') || e.id.startsWith('manual-'))) {
      s.add('Manual Entry');
    }
    
    return Array.from(s).sort();
  }, [experts, sheets]);

  return (
    <div className="p-10 space-y-10 relative">
      {/* Config Backdrop */}
      {showConfig && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-10 border border-slate-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-light text-slate-800 tracking-tight">Sheet Intelligence</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure Data Synchronization</p>
              </div>
              <button 
                onClick={() => setShowConfig(false)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Sheet Label</label>
                <input 
                  type="text"
                  value={newSheetName}
                  onChange={(e) => setNewSheetName(e.target.value)}
                  placeholder="e.g. CMO Batch 1"
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Google Sheet URL</label>
                  <input 
                    type="text"
                    value={newSheetUrl}
                    onChange={(e) => setNewSheetUrl(e.target.value)}
                    placeholder="Paste sheet URL..."
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none"
                  />
                  <p className="px-1 mt-2 text-[10px] text-slate-500 italic">
                    Tip: To sync multiple tabs from the same spreadsheet, paste the exact URL of each tab so it includes the <code>gid=...</code> ID.
                  </p>
                </div>
                <button 
                  onClick={handleAddSheet}
                  className="mt-8 p-4 bg-primary text-white rounded-2xl hover:bg-primary-dark transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stored Sources</p>
              {sheets.length === 0 && (
                <div className="p-8 border-2 border-dashed border-slate-100 rounded-2xl text-center text-slate-400 text-xs text-xs">
                  No sheets configured.
                </div>
              )}
              {sheets.map(sheet => (
                <div key={sheet.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700 truncate">{sheet.name}</span>
                      {sheet.status === 'error' && <span className="p-1 bg-red-100 text-red-500 rounded text-[8px] font-bold">ERROR</span>}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{sheet.url}</p>
                    {sheet.lastSynced && (
                      <p className="text-[8px] font-bold text-primary mt-1 uppercase tracking-tighter">
                        Synced: {new Date(sheet.lastSynced).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleSyncSheet(sheet)}
                      disabled={!!syncing}
                      className="p-2 hover:bg-white rounded-lg text-primary transition-all"
                      title="Sync this sheet"
                    >
                      <RotateCw className={`w-4 h-4 ${syncing === sheet.id && 'animate-spin'}`} />
                    </button>
                    <button 
                      onClick={() => handleSheetDetails(sheet)}
                      className="p-2 hover:bg-white rounded-lg text-slate-400 transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteSheet(sheet.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-red-400 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {syncError && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-500 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {syncError}
              </div>
            )}

            <div className="space-y-4 pt-6 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Info className="w-3 h-3 text-primary" /> Data Source Management
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleSyncAll}
                  disabled={!!syncing}
                  className="w-full bg-slate-900 hover:bg-primary text-white py-4 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] transition-all shadow-xl active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {syncing === 'all' ? <RotateCw className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />} Quick Sync All Sources
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed italic">
                Quick Sync refreshes existing connections to all sources.
              </p>
            </div>

          </div>
          </div>
        </div>
      )}

      {/* Expert Detail Modal - Full Dossier */}
      {selectedExpert && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl border border-slate-200 h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">
            {/* Header */}
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-primary/10 rounded-[1.8rem] flex items-center justify-center text-2xl font-bold text-primary shadow-inner">
                  {selectedExpert.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h2 className="text-4xl font-light text-slate-800 tracking-tight">{selectedExpert.name}</h2>
                  <p className="text-[10px] font-black text-primary uppercase tracking-[0.25em] mt-1.5">{selectedExpert.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isEffectiveAdmin && (
                  <button 
                    onClick={() => handleDeleteExpert(selectedExpert.id)}
                    disabled={!!isDeleting}
                    className="flex items-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
                  >
                    {isDeleting === selectedExpert.id ? (
                      <RotateCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )} 
                    {isDeleting === selectedExpert.id ? 'Deleting...' : 'Delete Expert'}
                  </button>
                )}
                <button 
                  onClick={() => setSelectedExpert(null)}
                  className="p-3 hover:bg-white hover:shadow-md rounded-2xl transition-all border border-transparent hover:border-slate-100"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-10 space-y-12">
              {/* Top Bio Section */}
              {selectedExpert.bio && (
                <div className="max-w-2xl">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Award className="w-3 h-3" /> Professional Dossier
                  </h3>
                  <p className="text-slate-600 leading-relaxed text-lg font-light italic">"{selectedExpert.bio}"</p>
                </div>
              )}

              {/* Categorized SWYN Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Section: Contact & Identity */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Identity & Communication</h4>
                  <div className="space-y-4">
                    {[
                      { icon: Mail, label: 'Email', key: 'personal email' },
                      { icon: Phone, label: 'Mobile', key: 'mobile number (with country code)' },
                      { icon: MapPin, label: 'Location', key: 'city' },
                      { icon: Users, label: 'Gender', key: 'gender' }
                    ].map(field => {
                      const val = selectedExpert.metadata?.[Object.keys(selectedExpert.metadata).find(k => k.toLowerCase() === field.label.toLowerCase() || k.toLowerCase() === field.key) || ''];
                      if (!val) return null;
                      return (
                        <div key={field.label} className="flex items-start gap-4 group">
                          <div className="mt-1 p-2 bg-slate-50 rounded-lg group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <field.icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{field.label}</p>
                            <p className="text-sm font-medium text-slate-700">{String(val)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section: Terms & Availability */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Engagement Strategy</h4>
                  <div className="space-y-4">
                    {[
                      { icon: DollarSign, label: 'Intl Rate', key: "international clients — rate (usd)" },
                      { icon: DollarSign, label: 'Domestic Rate', key: "indian clients — rate (inr)" },
                      { icon: Clock, label: 'Expertise Hours', key: "hours per month for mentoring" },
                      { icon: Briefcase, label: 'Preferred Mode', key: "work mode preference" }
                    ].map(field => {
                      const val = selectedExpert.metadata?.[Object.keys(selectedExpert.metadata).find(k => k.toLowerCase().includes(field.label.toLowerCase()) || k.toLowerCase() === field.key) || ''];
                      if (!val) return null;
                      return (
                        <div key={field.label} className="flex items-start gap-4">
                          <div className="mt-1 p-2 bg-slate-50 rounded-lg">
                            <field.icon className="w-3.5 h-3.5 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{field.label}</p>
                            <p className="text-sm font-bold text-slate-900">{String(val)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Section: Professional Specs */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Technical Archetype</h4>
                  <div className="space-y-5">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">Industry Primary</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedExpert.tags.slice(0, 8).map(tag => (
                          <span key={tag} className="px-3 py-1 bg-primary/5 text-primary text-[10px] font-bold rounded-lg border border-primary/10">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    {selectedExpert.experience.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase">Core Network</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedExpert.experience.map(e => (
                            <span key={e} className="px-3 py-1 border border-slate-100 text-slate-500 text-[10px] font-medium rounded-lg">
                              {e}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section: Assets & Files */}
                <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3">Intelligence Assets</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: FileText, label: 'CV / Resume', key: 'upload your cv / resume' },
                      { icon: LinkIcon, label: 'LinkedIn', key: 'linkedin profile' },
                      { icon: LinkIcon, label: 'Website', key: 'personal website / portfolio' },
                      { icon: Award, label: 'Profile Page', key: 'one page profile' }
                    ].map(field => {
                      const val = selectedExpert.metadata?.[Object.keys(selectedExpert.metadata).find(k => k.toLowerCase().includes(field.label.toLowerCase()) || k.toLowerCase() === field.key) || ''];
                      if (!val || String(val).trim() === '') return null;
                      return (
                        <a 
                          key={field.label}
                          href={String(val).startsWith('http') ? String(val) : `https://${val}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-lg hover:border-primary/20 transition-all group flex flex-col gap-2"
                        >
                          <field.icon className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.1em]">{field.label}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Catch-all Metadata for unstructured data */}
              <div className="pt-12 border-t border-slate-50">
                <button 
                  onClick={() => {
                    const el = document.getElementById('extended-data');
                    el?.classList.toggle('hidden');
                  }}
                  className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-2 hover:opacity-70"
                >
                  View Full Schema Data <RefreshCw className="w-3 h-3" />
                </button>
                <div id="extended-data" className="hidden mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                  {Object.entries(selectedExpert.metadata || {}).map(([k, v]) => (
                    <div key={k} className="bg-slate-50/50 p-4 rounded-xl">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-1 truncate" title={k}>{k}</p>
                      <p className="text-xs text-slate-600 font-medium break-words leading-relaxed">{String(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* manual Add Expert Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-10 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-light text-slate-800 tracking-tight">Manual Entry</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Add Expert to Pool</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Full Name</label>
                  <input 
                    type="text" 
                    value={newExpert.name}
                    onChange={(e) => setNewExpert({...newExpert, name: e.target.value})}
                    placeholder="e.g. John Doe"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Role / Job Title</label>
                  <input 
                    type="text" 
                    value={newExpert.role}
                    onChange={(e) => setNewExpert({...newExpert, role: e.target.value})}
                    placeholder="e.g. CMO / Fractional Executive"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Biography</label>
                <textarea 
                  value={newExpert.bio}
                  onChange={(e) => setNewExpert({...newExpert, bio: e.target.value})}
                  rows={4}
                  placeholder="Professional summary..."
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Specialization (Comma separated)</label>
                  <input 
                    type="text" 
                    value={newExpert.tags?.join(', ')}
                    onChange={(e) => setNewExpert({...newExpert, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                    placeholder="e.g. Marketing, SaaS, Web3"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">Experience (Companies/Years)</label>
                  <input 
                    type="text" 
                    value={newExpert.experience?.join(', ')}
                    onChange={(e) => setNewExpert({...newExpert, experience: e.target.value.split(',').map(s => s.trim()).filter(Boolean)})}
                    placeholder="e.g. Google, 15 Years Exp"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                  />
                </div>
              </div>

              <button 
                onClick={handleManualAdd}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-primary transition-all shadow-xl shadow-slate-200"
              >
                Create Expert Profile
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-light text-slate-800 tracking-tight flex flex-wrap items-center gap-4">
              Expert Pool
              <span className="text-lg md:text-xl text-slate-300 font-mono">({experts.length})</span>
            {isEffectiveAdmin && (
                <span className="px-3 py-1 bg-primary text-white text-[8px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-primary/20">
                  Admin Active
                </span>
              )}
            </h1>
            <p className="text-slate-500 mt-2 text-sm font-medium">
            Internal Master Pool {lastSynced ? `// Refreshed ${lastSynced}` : '// Synced with Google Sheets'}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 w-full md:w-auto">
          <div className="relative flex-1 min-w-[280px] md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search experts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-primary/10 outline-none transition-all shadow-sm"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            {isEffectiveAdmin && (
              <button 
                onClick={handleClearPool}
                disabled={!!syncing}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-50 border border-red-100 text-red-600 px-4 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm group"
                title="Delete All Entries"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All</span>
              </button>
            )}

            {isEffectiveAdmin && (
              <button 
                onClick={() => setShowAddModal(true)}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:border-primary hover:text-primary transition-all shadow-sm"
              >
                Add <Plus className="w-4 h-4" />
              </button>
            )}

            {isEffectiveAdmin && (
              <button 
                onClick={() => setShowConfig(true)}
                className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-primary transition-all shadow-sm group"
                title="Admin Settings & Sync"
              >
                <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide">
        <button
          onClick={() => setSelectedSource('All')}
          className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${selectedSource === 'All' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:border-slate-200'}`}
        >
          All Experts
        </button>
        {sourcesList.map(source => (
          <button
            key={source}
            onClick={() => setSelectedSource(source)}
            className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${selectedSource === source ? 'bg-primary text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:border-slate-200'}`}
          >
            {source}
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expert <ArrowUpDown className="inline w-3 h-3 ml-1" /></th>
                <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Designation</th>
                <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Experience</th>
                <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Specialization</th>
                <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i}><td colSpan={6} className="px-8 py-6"><div className="h-8 bg-slate-100 rounded-lg animate-pulse" /></td></tr>
                ))
              ) : filtered.length > 0 ? filtered.map((expert) => (
                <tr key={expert.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300">
                        {expert.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-base">{expert.name}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {expert.id.padStart(4, '0')}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-8 font-semibold text-slate-500 uppercase text-[10px] tracking-[0.15em]">{expert.role}</td>
                  <td className="px-8 py-8">
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {expert.experience.slice(0, 2).map(exp => (
                        <span key={exp} className="text-xs font-medium text-slate-400">{exp}{expert.experience.indexOf(exp) < expert.experience.length - 1 && ','}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="flex flex-wrap gap-2">
                      {expert.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-3 py-1 bg-primary/5 text-primary rounded-lg text-[10px] font-bold uppercase tracking-tight border border-primary/10">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="flex items-center gap-2.5">
                      <select 
                        value={expert.status || 'active'}
                        onChange={(e) => handleUpdateStatus(expert.id, e.target.value)}
                        disabled={!isEffectiveAdmin}
                        className={`text-[10px] font-bold uppercase tracking-[0.2em] bg-transparent border-none focus:ring-0 cursor-pointer ${
                          expert.status === 'active' ? 'text-emerald-500' : 
                          expert.status === 'busy' ? 'text-amber-500' : 'text-slate-400'
                        } disabled:cursor-not-allowed`}
                      >
                        <option value="active">Active</option>
                        <option value="busy">Busy</option>
                        <option value="unavailable">Unavailable</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-8 py-8">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setSelectedExpert(expert)}
                        className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-primary hover:text-white transition-all shadow-sm"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      {isEffectiveAdmin && (
                        <button 
                          onClick={() => handleDeleteExpert(expert.id)}
                          disabled={isDeleting === expert.id}
                          className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-600 hover:text-white transition-all shadow-sm disabled:opacity-50 border border-red-100"
                        >
                          {isDeleting === expert.id ? <RotateCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-8 py-20 text-center text-slate-400 font-medium tracking-widest uppercase text-xs">No experts matching your criteria</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Confirmation Dialog */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white max-w-md w-full rounded-3xl shadow-2xl p-8 border border-slate-200">
            <h3 className="text-xl font-light text-slate-800 tracking-tight mb-4 ">{confirmDialog.message}</h3>
            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setConfirmDialog(null)}
                className="flex-1 px-6 py-3 bg-slate-50 text-slate-500 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-all border border-slate-200"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                className={`flex-1 px-6 py-3 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-all shadow-sm ${
                  confirmDialog.danger ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 'bg-primary hover:bg-primary/90 shadow-primary/20'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
