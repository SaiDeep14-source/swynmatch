import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { UserCheck, UserX, Edit, Trash2, ArrowUpRight, Search, Filter, Loader2, RotateCw } from 'lucide-react';
import { Expert } from '../../types';
import { useFirebase } from '../../contexts/FirebaseContext';

export const ExpertManagement: React.FC = () => {
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, message: string, danger?: boolean, onConfirm: () => void} | null>(null);
  const { isAdmin, user, loading: authLoading } = useFirebase();

  // Robust admin check consistent with ExpertsList
  const isEffectiveAdmin = useMemo(() => {
    if (authLoading) return false;
    const email = user?.email?.toLowerCase().trim();
    const isWhitelisted = email === 'saideepalahari14@gmail.com' || email === 'sai@swyn.in';
    return isAdmin || isWhitelisted;
  }, [isAdmin, user, authLoading]);

  const updateExpertStatus = async (id: string, newStatus: string) => {
    if (!isEffectiveAdmin) {
      alert("Admin access required for status updates.");
      return;
    }
    try {
      const expertRef = doc(db, 'experts', id);
      await updateDoc(expertRef, { status: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `experts/${id}`);
    }
  };

  const deleteExpert = async (id: string) => {
    if (!isEffectiveAdmin) {
      alert("Admin access required for deletion.");
      return;
    }
    setConfirmDialog({
      isOpen: true,
      message: "Permanently delete this expert from the database?",
      danger: true,
      onConfirm: async () => {
        setIsDeleting(id);
        try {
          await deleteDoc(doc(db, 'experts', id));
          console.info(`Expert ${id} deleted successfully from pipeline.`);
        } catch (err: any) {
          console.error('Pipeline deletion failed:', err);
          let msg = err.message || 'Unknown error';
          if (msg.includes('permission')) {
            msg = 'Permission Denied: Your account is listed as admin in UI but Firestore rules rejected the delete.';
          }
          alert(`Delete Failed: ${msg}`);
          handleFirestoreError(err, OperationType.DELETE, `experts/${id}`);
        } finally {
          setIsDeleting(null);
          setConfirmDialog(null);
        }
      }
    });
  };

  useEffect(() => {
    const expertsRef = collection(db, 'experts');
    const unsubscribe = onSnapshot(expertsRef, (snapshot) => {
      const expertData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Unknown',
          role: data.role || 'Expert',
          bio: data.bio || '',
          experience: data.experience || [],
          tags: data.tags || [],
          achievements: data.achievements || '',
          status: data.status || 'active',
          metadata: data.metadata || {}
        };
      }) as Expert[];
      setExperts(expertData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'experts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredExperts = experts.filter(e => 
    e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-xl">
            <UserCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Expert Pipeline</h2>
            <p className="text-[10px] text-slate-400 font-medium">Verify & Manage Personnel</p>
          </div>
        </div>
        <div className="flex gap-2">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Find expert..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold uppercase tracking-wider"
              />
           </div>
           <button 
             className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
           >
              <Filter className="w-4 h-4 text-slate-500" />
           </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50">
              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Expert Intel</th>
              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Domain</th>
              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Ops</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                </td>
              </tr>
            ) : filteredExperts.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest italic">
                  No experts found in the pipeline
                </td>
              </tr>
            ) : (
              filteredExperts.map((expert) => (
                <tr key={expert.id} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-400">
                        {expert.name ? expert.name.split(' ').map(n => n[0]).join('') : '?'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{expert.name || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-400">{expert.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md uppercase tracking-tighter">
                      {expert.tags?.[0] || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${
                      expert.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 
                      expert.status === 'busy' ? 'bg-amber-100 text-amber-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      <div className={`w-1 h-1 rounded-full ${
                        expert.status === 'active' ? 'bg-emerald-600' : 
                        expert.status === 'busy' ? 'bg-amber-600' :
                        'bg-slate-600'} animate-pulse`} />
                      {expert.status || 'active'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {expert.status !== 'active' && (
                        <button 
                          onClick={() => updateExpertStatus(expert.id, 'active')}
                          title="Set Active"
                          className="p-2 hover:bg-emerald-50 rounded-lg text-slate-400 hover:text-emerald-500 transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {expert.status !== 'busy' && (
                        <button 
                          onClick={() => updateExpertStatus(expert.id, 'busy')}
                          title="Set Busy"
                          className="p-2 hover:bg-amber-50 rounded-lg text-slate-400 hover:text-amber-500 transition-colors"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {expert.status !== 'unavailable' && (
                        <button 
                          onClick={() => updateExpertStatus(expert.id, 'unavailable')}
                          title="Set Unavailable"
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button 
                        onClick={() => deleteExpert(expert.id)}
                        disabled={isDeleting === expert.id}
                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete Permanently"
                      >
                        {isDeleting === expert.id ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
