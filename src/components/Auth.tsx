import React, { useState } from 'react';
import { Briefcase, Lock, Mail, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import SwynLogo from './SwynLogo';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';

interface AuthProps {
  onLogin: (token: string, email: string) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const token = await userCredential.user.getIdToken();
        onLogin(token, userCredential.user.email || email);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const token = await userCredential.user.getIdToken();
        onLogin(token, userCredential.user.email || email);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <SwynLogo className="h-20 w-auto" />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          {isLogin ? 'Sign in to SWYNMatch' : 'Create an account'}
        </h2>
        <p className="mt-4 text-center text-sm text-gray-600">
          {isLogin ? 'Or ' : 'Already have an account? '}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="font-medium text-orange-600 hover:text-orange-500 hover:underline"
          >
            {isLogin ? 'register a new account' : 'sign in instead'}
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-orange-100/50 sm:rounded-2xl sm:px-10 border border-gray-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className={`p-3 rounded-lg text-sm text-center font-medium ${error.includes('successful') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  pattern={isLogin ? undefined : ".*@swyn\\.in$"}
                  title={isLogin ? undefined : "Please use a @swyn.in email address"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 px-3 py-3 border border-gray-300 rounded-xl focus:ring-orange-500 focus:border-orange-500 sm:text-sm transition-colors text-gray-900"
                  placeholder="user@swyn.in"
                />
              </div>
              {!isLogin && (
                <p className="mt-2 text-xs text-gray-500">
                  Only @swyn.in email addresses are allowed.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 px-3 py-3 border border-gray-300 rounded-xl focus:ring-orange-500 focus:border-orange-500 sm:text-sm transition-colors text-gray-900"
                  placeholder="••••••••"
                />
              </div>
              {!isLogin && (
                <p className="mt-2 text-xs text-gray-500">
                  Password must be at least 8 characters long.
                </p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : isLogin ? (
                  <span className="flex items-center">
                    Sign In <LogIn className="ml-2 h-4 w-4" />
                  </span>
                ) : (
                  <span className="flex items-center">
                    Register <UserPlus className="ml-2 h-4 w-4" />
                  </span>
                )}
              </button>
            </div>
            
            {isLogin && (
                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-500">Please sign in with your registered email.</p>
                </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
