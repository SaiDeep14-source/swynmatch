import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Mail, Lock, Loader2, ArrowRight, UserPlus, LogIn, Globe } from 'lucide-react';
import { motion } from 'motion/react';

export const LoginForm: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create profile in Firestore
        const path = `users/${user.uid}`;
        const normalizedEmail = user.email?.toLowerCase().trim();
        const isAdminEmail = (normalizedEmail === 'sai@swyn.in' || normalizedEmail === 'saideepalahari14@gmail.com');
        const role = isAdminEmail ? 'admin' : 'member';
        
        try {
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            role: role,
            createdAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let message = "Authentication failed";
      
      if (err.code === 'auth/operation-not-allowed') {
        message = "Email/Password login is not enabled. Please enable it in your Firebase Console under Authentication > Sign-in method.";
      } else if (err.code === 'auth/invalid-credential') {
        message = isLogin 
          ? "Invalid credentials. If you haven't joined yet, please use the 'Request Authorization' tab below to create an account." 
          : "Could not create account. Please check your credentials.";
      } else if (err.code === 'auth/email-already-in-use') {
        message = "This email is already registered. Please Switch to Login.";
      } else if (err.code === 'auth/weak-password') {
        message = "Password must be at least 6 characters.";
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user doc exists, if not create it
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        const normalizedEmail = user.email?.toLowerCase().trim();
        const isAdminEmail = (normalizedEmail === 'sai@swyn.in' || normalizedEmail === 'saideepalahari14@gmail.com');
        const role = isAdminEmail ? 'admin' : 'member';
        
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          role: role,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      console.error("Google handle error:", err);
      setError("Google Sign-In failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 max-w-md w-full">
      <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mb-6">
        <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
          {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
        </div>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 mb-2">
        {isLogin ? 'Neural Matcher' : 'Join SWYN Pool'}
      </h2>
      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-8">
        Fractional Expert Intelligence
      </p>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Email Terminal</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@swyn.in"
              className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-primary/5 focus:bg-white transition-all outline-none"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Passkey</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-11 pr-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-primary/5 focus:bg-white transition-all outline-none"
              required
            />
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-wider text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white/40" />
          ) : (
            <>
              {isLogin ? 'Initialize Session' : 'Create Access Profile'}
              <ArrowRight className="w-4 h-4 text-primary" />
            </>
          )}
        </button>

        <div className="relative py-4 flex items-center gap-4">
          <div className="flex-1 h-[1px] bg-slate-100"></div>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Or</span>
          <div className="flex-1 h-[1px] bg-slate-100"></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-2xl font-bold text-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-3 shadow-sm"
        >
          <Globe className="w-4 h-4 text-blue-500" />
          Continue with Google
        </button>
      </form>

      <div className="mt-8 pt-8 border-t border-slate-100 w-full flex flex-col items-center">
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
          {isLogin ? "No connection?" : "Existing operative?"}
        </p>
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-xs font-bold text-primary hover:underline uppercase tracking-widest"
        >
          {isLogin ? 'Request Authorization' : 'Enter Protocol Terminal'}
        </button>
      </div>
    </div>
  );
};
