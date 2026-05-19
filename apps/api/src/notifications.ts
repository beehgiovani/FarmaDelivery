import type { FastifyBaseLogger } from "fastify";
import { applicationDefault, cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { canUseSupabaseRest, supabaseRest } from "./supabaseRest";
import { prisma } from "./prisma";

type NotificationType = "DELIVERY_CANCELED" | "NEW_DELIVERY_AVAILABLE";

type NotificationPayload = {
  courierId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string | null | undefined>;
  log?: FastifyBaseLogger;
};

type StoredDeviceToken = {
  id: string;
  token: string;
};

export async function sendCourierPushNotification(payload: NotificationPayload) {
  const app = getFirebaseApp();
  if (!app) {
    return {
      enabled: false,
      sent: 0,
      failed: 0,
      inactiveTokens: 0,
      reason: "FIREBASE_ADMIN_NOT_CONFIGURED",
    };
  }

  const tokens = await listCourierDeviceTokens(payload.courierId);
  if (tokens.length === 0) {
    return {
      enabled: true,
      sent: 0,
      failed: 0,
      inactiveTokens: 0,
      reason: "NO_ACTIVE_DEVICE_TOKENS",
    };
  }

  const response = await getMessaging(app).sendEachForMulticast({
    tokens: tokens.map((item) => item.token),
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: normalizeNotificationData({
      ...payload.data,
      type: payload.type,
    }),
    android: {
      priority: "high",
      notification: {
        channelId: "deliveries",
      },
    },
  });

  const invalidTokenIds = response.responses
    .map((item, index) => {
      if (item.success) return null;
      const code = item.error?.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        return tokens[index]?.id ?? null;
      }
      return null;
    })
    .filter((id): id is string => Boolean(id));

  if (invalidTokenIds.length > 0) {
    await deactivateDeviceTokens(invalidTokenIds);
  }

  payload.log?.info(
    {
      courier_id: payload.courierId,
      notification_type: payload.type,
      sent: response.successCount,
      failed: response.failureCount,
      inactive_tokens: invalidTokenIds.length,
    },
    "courier push notification processed",
  );

  return {
    enabled: true,
    sent: response.successCount,
    failed: response.failureCount,
    inactiveTokens: invalidTokenIds.length,
  };
}

export function isCourierPushConfigured() {
  return Boolean(
    getApps()[0] ||
      readEnv("FIREBASE_SERVICE_ACCOUNT_JSON") ||
      readEnv("FIREBASE_SERVICE_ACCOUNT_BASE64") ||
      (readEnv("FIREBASE_PROJECT_ID") && readEnv("FIREBASE_CLIENT_EMAIL") && readEnv("FIREBASE_PRIVATE_KEY")) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

function getFirebaseApp(): App | null {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;

  const serviceAccount = readServiceAccount();
  if (serviceAccount) {
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: readEnv("FIREBASE_PROJECT_ID"),
    });
  }

  return null;
}

function readServiceAccount(): ServiceAccount | null {
  const json = readEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (json) return JSON.parse(json) as ServiceAccount;

  const base64 = readEnv("FIREBASE_SERVICE_ACCOUNT_BASE64");
  if (base64) {
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as ServiceAccount;
  }

  const projectId = readEnv("FIREBASE_PROJECT_ID");
  const clientEmail = readEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = readEnv("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  return null;
}

async function listCourierDeviceTokens(courierId: string): Promise<StoredDeviceToken[]> {
  try {
    return await prisma.courierDeviceToken.findMany({
      where: {
        courierId,
        active: true,
      },
      select: {
        id: true,
        token: true,
      },
    });
  } catch (error) {
    if (!canUseSupabaseRest()) throw error;
    const tokens = await supabaseRest<StoredDeviceToken[]>("CourierDeviceToken", {
      query: `select=id,token&courierId=eq.${courierId}&active=eq.true`,
    });
    return tokens;
  }
}

async function deactivateDeviceTokens(ids: string[]) {
  try {
    await prisma.courierDeviceToken.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        active: false,
      },
    });
    return;
  } catch (error) {
    if (!canUseSupabaseRest()) throw error;
  }

  await supabaseRest("CourierDeviceToken", {
    method: "PATCH",
    query: `id=in.(${ids.join(",")})`,
    body: {
      active: false,
    },
  });
}

function normalizeNotificationData(data: Record<string, string | null | undefined>) {
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value ?? ""]));
}

function readEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
