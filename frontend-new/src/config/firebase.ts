import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC8VVE6gmMiIy6-3QNPHZrd6A_A-aUnLQQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "niramaya-ai-23db9.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "niramaya-ai-23db9",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "niramaya-ai-23db9.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "986430921115",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:986430921115:web:ed8d2996cb77ffaca3e93e",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-8WTZ10N2YP"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
