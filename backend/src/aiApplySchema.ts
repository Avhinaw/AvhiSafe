import { z } from "zod";
import { dashboardOperationsSchema } from "./dashboardPlanSchema.js";

export const aiApplyInput = z.object({
  dashboardId: z.string(),
  prompt: z.string().max(8000),
  plan: z.object({
    intent: z.enum(["customize_ui", "unsupported"]),
    explanation: z.string().max(500),
    warnings: z.array(z.string()).max(10).default([]),
    requiresApproval: z.boolean(),
    ui: z.unknown(),
    operations: dashboardOperationsSchema.default([]),
    expectedVersion: z.number().int().min(1),
    source: z.literal("ai").optional(),
    model: z.string().max(100).optional(),
    requestId: z.string().uuid().optional(),
  }).strict(),
}).strict();
