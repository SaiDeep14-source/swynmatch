import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Users, UserPlus, Trash2, ShieldCheck, Loader2, AlertCircle, CheckCircle2, Key, Mail, Search } from 'lucide-react';
import { authFetch } from '../lib/api';

interface User {
  uid: string;
  email: string;
  disabled: boolean;
  lastSignInTime?: string;
}

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await authFetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uid: string) => {
    if (!window.confirm('IRREVERSIBLE: Delete this account?')) return;
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/admin/users/${uid}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSuccess('Target account purged from registry.');
      fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-gray-100">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight flex items-center">
            <ShieldCheck className="w-8 h-8 mr-3 text-orange-600" />
            Control Center
          </h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">High-Privilege Access Only</p>
        </div>
        <button className="bg-black text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-gray-800 transition-all shadow-xl shadow-gray-200 flex items-center">
          <UserPlus className="w-4 h-4 mr-2" />
          Provision Account
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-700 text-xs font-bold animate-shake">
          CRITICAL ERROR: {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-50 border border-green-100 rounded-2xl text-green-700 text-xs font-bold">
          COMMAND SUCCESS: {success}
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 uppercase text-[10px] font-black text-gray-400 tracking-widest border-b border-gray-100">
                <th className="px-8 py-6">Identity</th>
                <th className="px-8 py-6">Security Status</th>
                <th className="px-8 py-6">Last Check-in</th>
                <th className="px-8 py-6 text-right">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center">
                    <Loader2 className="w-8 h-8 text-orange-600 animate-spin mx-auto" />
                    <p className="text-[10px] text-gray-400 font-bold mt-4 uppercase tracking-widest">Querying Auth Database...</p>
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.uid} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black text-sm">
                          {user.email ? user.email[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                          <p className="text-sm font-black text-gray-900 leading-none">{user.email}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-1">{user.uid}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight ${
                        user.disabled 
                          ? 'bg-red-50 text-red-600 border border-red-100' 
                          : 'bg-green-50 text-green-600 border border-green-100'
                      }`}>
                        {user.disabled ? 'Revoked' : 'Verified'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-xs text-gray-500 font-bold">
                      {user.lastSignInTime ? new Date(user.lastSignInTime).toLocaleString() : 'PENDING'}
                    </td>
                    <td className="px-8 py-6 text-right">
                      <button 
                        onClick={() => handleDelete(user.uid)} 
                        disabled={user.email === 'info@swyn.in'}
                        className="p-3 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all disabled:opacity-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

