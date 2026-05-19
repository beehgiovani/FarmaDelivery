import { z } from "zod";

export const DELIVERY_PROOF_MAX_BYTES = 4 * 1024 * 1024;
export const DELIVERY_PROOF_BASE64_MAX_LENGTH = Math.ceil(DELIVERY_PROOF_MAX_BYTES / 3) * 4;
export const DELIVERY_PROOF_UPLOAD_BODY_LIMIT_BYTES = 6 * 1024 * 1024;

export const DELIVERY_DEADLINE_TIERS = ["PERTO", "MEDIO", "LONGE"] as const;
export const COURIER_SERVICE_AREAS = ["ASTURIAS", "PEREQUE"] as const;
export const DELIVERY_DEADLINE_WINDOWS_MINUTES = {
  PERTO: { warning: 60, critical: 90 },
  MEDIO: { warning: 90, critical: 120 },
  LONGE: { warning: 120, critical: 180 },
} as const satisfies Record<(typeof DELIVERY_DEADLINE_TIERS)[number], { warning: number; critical: number }>;

export const uuidSchema = z.string().uuid();

export const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const createStoreSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(2),
  address: z.string().min(5),
  baseType: z.enum(["COMPARTILHADA", "DEDICADA"]),
  coordinates: coordinateSchema.optional(),
  weeklyHours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        opensAt: z.string().min(4),
        closesAt: z.string().min(4),
        closed: z.boolean().default(false),
      }),
    )
    .optional(),
});

export const updateStoreWeeklyHoursSchema = z.object({
  weeklyHours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        opensAt: z.string().min(4),
        closesAt: z.string().min(4),
        closed: z.boolean().default(false),
      }),
    )
    .length(7),
});

export const createStoreDateOverrideSchema = z.object({
  date: z.string().date(),
  opensAt: z.string().min(4).optional(),
  closesAt: z.string().min(4).optional(),
  closed: z.boolean().default(false),
  reason: z.string().optional(),
});

export const createUserSchema = z
  .object({
    name: z.string().min(2),
    phone: z.string().min(8).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    role: z.enum(["ADMIN", "GERENTE", "BALCONISTA_CAIXA", "MOTOBOY"]),
    storeId: uuidSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === "BALCONISTA_CAIXA") return;

    if (!value.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "password is required.",
        path: ["password"],
      });
    }

    if (!value.email && !value.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "phone or email is required.",
        path: ["email"],
      });
    }

    if ((value.role === "GERENTE" || value.role === "MOTOBOY") && !value.storeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "storeId is required for this role.",
        path: ["storeId"],
      });
    }
  });

export const resetUserPasswordSchema = z.object({
  password: z.string().min(8),
});

export const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
});

export const bootstrapAdminSchema = z.object({
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8),
});

export const createCustomerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(8),
});

export const createCustomerAddressSchema = z.object({
  customerId: uuidSchema,
  street: z.string().min(2),
  number: z.string().min(1),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  reference: z.string().optional(),
  coordinates: coordinateSchema.optional(),
});

export const createDeliverySchema = z.object({
  storeId: uuidSchema,
  customerId: uuidSchema,
  customerAddressId: uuidSchema,
  priority: z.enum(["NORMAL", "URGENTE", "RETORNO"]).default("NORMAL"),
  deadlineTier: z.enum(DELIVERY_DEADLINE_TIERS).default("MEDIO"),
  notes: z.string().optional(),
  earliestDispatchAt: z.string().datetime().optional(),
});

export const createDeliveryWithCustomerSchema = z.object({
  storeId: uuidSchema,
  redirectStoreId: uuidSchema.optional(),
  customerAddressId: uuidSchema.optional(),
  attendantName: z.string().trim().min(2).max(80).optional(),
  customerName: z.string().min(2),
  phone: z.string().min(8),
  street: z.string().min(2),
  number: z.string().min(1),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  reference: z.string().optional(),
  coordinates: coordinateSchema.optional(),
  priority: z.enum(["NORMAL", "URGENTE", "RETORNO"]).default("NORMAL"),
  deadlineTier: z.enum(DELIVERY_DEADLINE_TIERS).default("MEDIO"),
  notes: z.string().optional(),
  earliestDispatchAt: z.string().datetime().optional(),
});

export const courierServiceAreaSchema = z.enum(COURIER_SERVICE_AREAS);

export const deliveryListQuerySchema = z.object({
  serviceArea: courierServiceAreaSchema.optional(),
});

export const acceptDeliverySchema = z.object({
  deliveryId: uuidSchema,
  courierId: uuidSchema,
  serviceArea: courierServiceAreaSchema.optional(),
});

// Contrato unico para coletar, sair em rota e entregar.
// Na entrega final, proofId e opcional: a foto ajuda auditoria, mas nao pode travar o motoboy.
export const deliveryStatusTransitionSchema = z.object({
  deliveryId: uuidSchema,
  notes: z.string().optional(),
  proofId: uuidSchema.optional(),
});

export const uploadDeliveryProofSchema = z.object({
  fileName: z.string().min(3).max(120),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  contentBase64: z
    .string()
    .min(20)
    .max(DELIVERY_PROOF_BASE64_MAX_LENGTH)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/)
    .refine((value) => value.length % 4 === 0, "Base64 content length must be a multiple of 4."),
});

export const registerDeliveryProblemSchema = z.object({
  deliveryId: uuidSchema,
  notes: z.string().min(3),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const cancelDeliverySchema = z.object({
  deliveryId: uuidSchema,
  reason: z.string().min(3),
  notifyCourier: z.boolean().default(true),
});

export const recalculateRouteSchema = z.object({
  routeId: uuidSchema,
  reason: z.enum(["NOVA_ENTREGA", "NOVA_COLETA", "OCORRENCIA", "AJUSTE_MANUAL"]),
});

export const routePreviewQuerySchema = z.object({
  storeId: uuidSchema.optional(),
  courierId: uuidSchema.optional(),
});

export const geocodeAddressQuerySchema = z.object({
  street: z.string().min(2),
  number: z.string().min(1),
  neighborhood: z.string().optional(),
  city: z.string().default("Guaruja"),
  state: z.string().default("SP"),
});

export const deliveryReportQuerySchema = z.object({
  date: z.string().date().optional(),
  startsAt: z.string().date().optional(),
  endsAt: z.string().date().optional(),
  storeId: uuidSchema.optional(),
  status: z.enum(["RASCUNHO", "AGUARDANDO_MOTOBOY", "ACEITA_PELO_MOTOBOY", "COLETADA", "EM_ROTA", "ENTREGUE", "PROBLEMA", "CANCELADA"]).optional(),
  priority: z.enum(["NORMAL", "URGENTE", "RETORNO"]).optional(),
  proof: z.enum(["com", "sem"]).optional(),
  mapPoint: z.enum(["com", "sem"]).optional(),
  attendant: z.string().trim().min(1).max(80).optional(),
  exportLimit: z.coerce.number().int().min(1).max(50000).optional(),
}).refine((value) => !(value.startsAt && value.endsAt) || value.startsAt <= value.endsAt, {
  message: "startsAt must be before or equal to endsAt.",
  path: ["endsAt"],
});

export const updateCourierLocationSchema = z.object({
  courierId: uuidSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  available: z.boolean().optional(),
  serviceArea: courierServiceAreaSchema.optional(),
});

export const updateCourierAvailabilitySchema = z.object({
  courierId: uuidSchema,
  available: z.boolean(),
  serviceArea: courierServiceAreaSchema.optional(),
});

export const registerCourierDeviceTokenSchema = z.object({
  deviceToken: z.string().min(20),
  platform: z.enum(["android", "web"]).default("android"),
});

export const assignmentKindSchema = z.enum(["BASE", "TEMPORARIA", "COBERTURA", "DEDICADA", "RODIZIO"]);

export const createUserStoreAssignmentSchema = z.object({
  userId: uuidSchema,
  storeId: uuidSchema,
  kind: assignmentKindSchema.default("TEMPORARIA"),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  reason: z.string().min(3).optional(),
});

export const createCourierStoreAssignmentSchema = z.object({
  courierId: uuidSchema,
  storeId: uuidSchema,
  kind: assignmentKindSchema.default("COBERTURA"),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  reason: z.string().min(3).optional(),
});
