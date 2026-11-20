import type { FirebaseApp } from 'firebase/app'
import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

export type FirebaseServices = {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

let services: FirebaseServices | null = null
let configured: boolean | null = null

export function isFirebaseConfigured(): boolean {
  if (configured !== null) return configured
  const key = import.meta.env.VITE_FIREBASE_API_KEY
  const project = import.meta.env.VITE_FIREBASE_PROJECT_ID
  configured = Boolean(key && project && key !== 'demo')
  return configured
}

export async function getFirebase(): Promise<FirebaseServices | null> {
  if (!isFirebaseConfigured()) return null
  if (services) return services
  const { initializeApp, getApps } = await import('firebase/app')
  const { getAuth, signInAnonymously } = await import('firebase/auth')
  const { getFirestore } = await import('firebase/firestore')
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    })
  services = { app, auth: getAuth(app), db: getFirestore(app) }
  // touch signInAnonymously for tree - exported via ensureAnonAuth
  void signInAnonymously
  return services
}

export async function ensureAnonAuth(): Promise<string | null> {
  const fb = await getFirebase()
  if (!fb) return null
  if (fb.auth.currentUser) return fb.auth.currentUser.uid
  const { signInAnonymously } = await import('firebase/auth')
  const cred = await signInAnonymously(fb.auth)
  return cred.user.uid
}
