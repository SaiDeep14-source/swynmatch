import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Server, ShieldAlert, CheckCircle2, AlertCircle } from 'lucide-react';

interface EnvVar {
  key: string;
  value: string;
}

export const EnvDashboard: React.FC = () => {
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEnv();
  }, []);

  const fetchEnv = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/debug/env', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch environment variables');
      const data = await response.json();
      setEnvVars(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Environment Diagnostics</h1>
          <p className="text-gray-500 mt-1">Review system configuration and environment variables.</p>
        </div>
        <div className="flex items-center space-x-2 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
          <Server className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Live Runtime</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3 text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold">Diagnostic Error</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 font-mono text-[10px] uppercase tracking-widest text-gray-400">
                <th className="px-6 py-4 font-semibold">Variable Name</th>
                <th className="px-6 py-4 font-semibold text-right">Value / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={2} className="px-6 py-12 text-center text-gray-400 font-mono text-sm">
                    Scanning environment...
                  </td>
                </tr>
              ) : envVars.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-6 py-12 text-center text-gray-400 font-mono text-sm">
                    No variables detected.
                  </td>
                </tr>
              ) : (
                envVars.map((v, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    key={v.key} 
                    className="hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-sm text-gray-600 font-medium">
                      {v.key}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono text-gray-800 break-all">
                        {v.value}
                      </code>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <div className="flex items-center space-x-2 text-orange-700 mb-2">
            <ShieldAlert className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase">Security Masking</h3>
          </div>
          <p className="text-xs text-orange-600 leading-relaxed">
            API keys and tokens are automatically masked to show only prefix and suffix characters.
          </p>
        </div>
        
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center space-x-2 text-blue-700 mb-2">
            <CheckCircle2 className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase">Configuration Check</h3>
          </div>
          <p className="text-xs text-blue-600 leading-relaxed">
            Ensure GEMINI_API_KEY and other critical infrastructure variables are present.
          </p>
        </div>

        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="flex items-center space-x-2 text-gray-700 mb-2">
            <Server className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase">Runtime Context</h3>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Variables are fetched directly from the current process.env on the backend.
          </p>
        </div>
      </div>
    </div>
  );
};
