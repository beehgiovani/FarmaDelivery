importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js");

firebase.initializeApp(readFirebaseConfig());

const messaging = firebase.messaging();

messaging.onBackgroundMessage(async (payload) => {
  if (payload.data?.type === "NEW_DELIVERY_AVAILABLE" && !(await readCourierAvailable())) {
    return;
  }

  const title = payload.notification?.title || payload.data?.title || "Drogaria Santo Antonio";
  const body = payload.notification?.body || resolveBody(payload.data?.type);
  const mapUrl = buildMapUrl(payload.data || {});

  self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: {
      ...(payload.data || {}),
      url: mapUrl || "/",
    },
    actions: mapUrl
      ? [
          {
            action: "open-map",
            title: "Abrir mapa",
          },
        ]
      : [],
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.action === "open-map" ? event.notification.data?.url : "/";
  event.waitUntil(clients.openWindow(targetUrl || "/"));
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "FARMADELIVERY_COURIER_AVAILABILITY") return;
  event.waitUntil(writeCourierAvailable(event.data.available === true));
});

function resolveBody(type) {
  switch (type) {
    case "NEW_DELIVERY_AVAILABLE":
      return "Uma nova entrega esta aguardando aceite.";
    case "DELIVERY_CANCELED":
      return "Uma entrega da sua rota foi cancelada.";
    default:
      return "Voce tem uma atualizacao de entrega.";
  }
}

function buildMapUrl(data) {
  if (data.latitude && data.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${data.latitude},${data.longitude}`)}`;
  }
  if (data.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.address)}`;
  }
  return "";
}

async function readCourierAvailable() {
  const db = await openStateDb();
  return new Promise((resolve) => {
    const request = db.transaction("state", "readonly").objectStore("state").get("courierAvailable");
    request.onsuccess = () => resolve(request.result === true);
    request.onerror = () => resolve(false);
  });
}

async function writeCourierAvailable(available) {
  const db = await openStateDb();
  return new Promise((resolve) => {
    const request = db.transaction("state", "readwrite").objectStore("state").put(available, "courierAvailable");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

function openStateDb() {
  return new Promise((resolve) => {
    const request = indexedDB.open("farmadelivery-motoboy", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("state");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve({ transaction: () => ({ objectStore: () => ({ get: fallbackRequest(false), put: fallbackRequest(undefined) }) }) });
  });
}

function fallbackRequest(result) {
  const request = { result };
  setTimeout(() => request.onsuccess?.(), 0);
  return request;
}

function readFirebaseConfig() {
  const params = new URL(self.location.href).searchParams;
  return {
    apiKey: params.get("apiKey") || "",
    authDomain: params.get("authDomain") || "",
    projectId: params.get("projectId") || "",
    storageBucket: params.get("storageBucket") || "",
    messagingSenderId: params.get("messagingSenderId") || "",
    appId: params.get("appId") || "",
    measurementId: params.get("measurementId") || "",
  };
}
