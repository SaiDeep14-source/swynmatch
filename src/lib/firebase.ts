import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDlLddRM4SwNPJrUxa6W6J1mVWXEsgtNTw",
  authDomain: "gen-lang-client-0734918162.firebaseapp.com",
  projectId: "gen-lang-client-0734918162",
  storageBucket: "gen-lang-client-0734918162.firebasestorage.app",
  messagingSenderId: "179441064722",
  appId: "1:179441064722:web:38b5335439d5865314b1cb"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
