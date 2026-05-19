import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getMessaging, getToken, isSupported as isMessagingSupported } from "firebase/messaging";

type FirebaseEnv = ImportMeta & {
  env?: Record<string, string | undefined>;
};

const env = (import.meta as FirebaseEnv).env ?? {};

function readFirebaseConfig(): FirebaseOptions {
  return {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
  };
}

function getFirebaseApp(): FirebaseApp {
  return getApps()[0] ?? initializeApp(readFirebaseConfig());
}

export async function initializeFirebaseAnalytics() {
  if (isFirebaseWebConfigComplete() && (await isAnalyticsSupported())) {
    getAnalytics(getFirebaseApp());
  }
}

export function hasFirebaseWebPushBrowserSupport(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function isFirebaseWebConfigComplete(config = readFirebaseConfig()): boolean {
  return Boolean(
    config.apiKey?.trim() &&
      config.projectId?.trim() &&
      config.messagingSenderId?.trim() &&
      config.appId?.trim(),
  );
}

export function canRequestFirebaseWebPushToken(
  vapidKey: string | null | undefined,
  browserSupported = hasFirebaseWebPushBrowserSupport(),
  firebaseConfigured = isFirebaseWebConfigComplete(),
): boolean {
  return Boolean(vapidKey?.trim()) && browserSupported && firebaseConfigured;
}

export async function getFirebaseWebPushToken(vapidKey: string): Promise<string | null> {
  if (!canRequestFirebaseWebPushToken(vapidKey)) return null;
  if (!(await isMessagingSupported())) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const serviceWorkerRegistration = await navigator.serviceWorker.register(buildFirebaseMessagingServiceWorkerUrl(readFirebaseConfig()));
  const messaging = getMessaging(getFirebaseApp());
  return getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });
}

function buildFirebaseMessagingServiceWorkerUrl(config: FirebaseOptions) {
  const params = new URLSearchParams();
  Object.entries(config).forEach(([key, value]) => {
    if (typeof value === "string" && value.trim()) {
      params.set(key, value);
    }
  });
  return `/firebase-messaging-sw.js?${params.toString()}`;
}
