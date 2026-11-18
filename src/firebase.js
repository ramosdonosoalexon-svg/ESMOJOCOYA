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
// Evita conexiones accidentales al Firebase del proyecto original.
const originalProject = /distrigas/i.test([config.projectId, config.authDomain, config.storageBucket].join(' '));
export const configured = Boolean(config.apiKey && config.authDomain && config.appId && config.projectId && !originalProject);
export const configError = originalProject
  ? 'Esta copia no puede conectarse al Firebase del sistema original. Usa el Firebase propio de MOJOCOYA SRL.'
  : 'Falta configurar el archivo .env con los datos de Firebase de MOJOCOYA SRL.';
export const app = initializeApp(configured ? config : {
  apiKey: 'sin-configurar', authDomain: 'sin-configurar.invalid', projectId: 'sin-configurar', appId: '1:0:web:configuracion'
});
export const auth = getAuth(app);
export const db = getFirestore(app);
