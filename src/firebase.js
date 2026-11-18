import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const configured = Boolean(config.apiKey && config.appId && config.projectId);
export const app = initializeApp(configured ? config : {
  apiKey: 'sin-configurar', authDomain: 'sin-configurar.invalid', projectId: 'sin-configurar', appId: '1:0:web:configuracion'
});
export const auth = getAuth(app);
export const db = getFirestore(app);
