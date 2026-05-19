import { getAnalytics, isSupported as isAnalyticsSupported } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported as isMessagingSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAjj_qFZ88se-_AmiNeI-CBbtnsaZ9jeiI",
  authDomain: "farmadelivery-d40a9.firebaseapp.com",
  projectId: "farmadelivery-d40a9",
  storageBucket: "farmadelivery-d40a9.firebasestorage.app",
  messagingSenderId: "289634919670",
  appId: "1:289634919670:web:f2b8b6bd7a9622f07db8d7",
  measurementId: "G-BM5XQ8NZQW",
};

export const firebaseApp = initializeApp(firebaseConfig);

export async function initializeFirebaseAnalytics() {
  if (await isAnalyticsSupported()) {
    getAnalytics(firebaseApp);
  }
}

export function hasFirebaseWebPushBrowserSupport(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function canRequestFirebaseWebPushToken(vapidKey: string | null | undefined, browserSupported = hasFirebaseWebPushBrowserSupport()): boolean {
  return Boolean(vapidKey?.trim()) && browserSupported;
}

export async function getFirebaseWebPushToken(vapidKey: string): Promise<string | null> {
  if (!canRequestFirebaseWebPushToken(vapidKey)) return null;
  if (!(await isMessagingSupported())) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const serviceWorkerRegistration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const messaging = getMessaging(firebaseApp);
  return getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  });
}
