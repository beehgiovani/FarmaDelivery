importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js");

firebase.initializeApp(readFirebaseConfig());

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "Drogaria Santo Antonio";
  const body = payload.notification?.body || resolveBody(payload.data?.type);

  self.registration.showNotification(title, {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: payload.data || {},
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/"));
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
