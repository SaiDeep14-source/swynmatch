import React, { useState } from 'react';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import SwynLogo from './SwynLogo';

interface AuthProps {
  onLogin: (token: string, email: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email to receive a reset link.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError('Password reset link sent! Check your inbox.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setResetSent(false);

    try {
      let userCredential;
      if (isLogin) {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }
      
      const token = await userCredential.user.getIdToken();
      onLogin(token, userCredential.user.email || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50/50">
      <div className="bg-white p-10 rounded-3xl shadow-2xl shadow-gray-200/50 w-full max-w-md border border-gray-100 relative overflow-hidden">
        {/* Decorative element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full translate-x-16 -translate-y-16"></div>
        
        <div className="flex flex-col items-center mb-10 relative z-10">
          <SwynLogo size={52} className="mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mt-2">Executive Gateway</p>
        </div>

        {error && (
          <div className={`mb-8 p-4 rounded-xl flex items-start space-x-3 text-xs font-semibold ${resetSent ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
            {resetSent ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2 pl-1">Email Address</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-orange-600 transition-colors" />
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all outline-none text-sm font-semibold"
                placeholder="you@domain.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2 pl-1">Password</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-orange-600 transition-colors" />
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500 focus:bg-white transition-all outline-none text-sm font-semibold"
                placeholder="••••••••"
              />
            </div>
            {isLogin && (
              <div className="flex justify-end mt-2">
                <button type="button" onClick={handleForgotPassword} className="text-xs font-semibold text-orange-600 hover:text-orange-700">Forgot password?</button>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="group w-full py-4 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 transition-all shadow-xl shadow-orange-100 disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? 'Processing...' : (isLogin ? 'Initialize Session' : 'Register Profile')}
            {!isLoading && (isLogin ? <LogIn className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" /> : <UserPlus className="ml-2 w-4 h-4 group-hover:scale-110 transition-transform" />)}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-gray-100 text-center relative z-10">
          <p className="text-xs text-gray-500">
            {isLogin ? "New to the platform?" : "Existing account found?"}
            <button 
              onClick={() => setIsLogin(!isLogin)}
              className="ml-2 font-semibold text-orange-600 hover:text-orange-700"
            >
              {isLogin ? 'Create Profile' : 'Sign In Now'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
