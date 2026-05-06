import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User as AppUser } from '../types';

interface FirebaseContextType {
  user: AppUser | null;
  loading: boolean;
  isAdmin: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  loading: true,
  isAdmin: false,
});

export const useFirebase = () => useContext(FirebaseContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let userUnsubscribe: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = undefined;
      }

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Use onSnapshot for real-time profile updates (like role changes)
        userUnsubscribe = onSnapshot(userDocRef, (snapshot) => {
          const email = firebaseUser.email?.toLowerCase().trim();
          const isAdminByEmail = (email === 'sai@swyn.in' || email === 'saideepalahari14@gmail.com');
          
          if (snapshot.exists()) {
            const userData = snapshot.data();
            const isAdminUser = userData.role === 'admin' || isAdminByEmail;
            
            const appUser: AppUser = {
              email: firebaseUser.email || '',
              role: isAdminUser ? 'admin' : (userData.role || 'member')
            };
            setUser(appUser);
            setIsAdmin(isAdminUser);
          } else {
            setUser({
              email: firebaseUser.email || '',
              role: isAdminByEmail ? 'admin' : 'member'
            });
            setIsAdmin(isAdminByEmail);
          }
          setLoading(false);
        }, (error) => {
          console.error("User doc listener error:", error);
          setLoading(false);
        });
      } else {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  return (
    <FirebaseContext.Provider value={{ user, loading, isAdmin }}>
      {children}
    </FirebaseContext.Provider>
  );
};
