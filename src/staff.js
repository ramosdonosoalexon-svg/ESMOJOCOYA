import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth } from './firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

const functions = getFunctions(auth.app, 'southamerica-east1');
export async function manageStaff(payload) {
  const fn = httpsCallable(functions, 'manageStaff');
  const response = await fn(payload);
  return response.data;
}
export async function sendRecoveryEmail(email) {
  return sendPasswordResetEmail(auth, email);
}
