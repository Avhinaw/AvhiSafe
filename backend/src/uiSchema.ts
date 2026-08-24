import { z } from "zod";
import { allowedWidgetTypes } from "./widgetCatalog.js";

const safeId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const safeText = z.string().trim().max(240);
const widgetWidth = z.enum(["small", "medium", "large", "full"]);
const cardTone = z.enum(["neutral", "accent", "success", "warning", "info", "danger"]);

export const uiComponentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("widget"),
    id: safeId,
    widgetType: z.string().refine((value) => allowedWidgetTypes.has(value), "Widget is not registered."),
    title: safeText.optional(),
    width: widgetWidth,
  }).strict(),
  z.object({
    type: z.literal("text"),
    id: safeId,
    text: z.string().trim().min(1).max(500),
    emphasis: z.enum(["normal", "muted", "strong"]).default("normal"),
  }).strict(),
  z.object({
    type: z.literal("metric"),
    id: safeId,
    label: safeText,
    source: z.enum(["portfolio-value", "native-balances", "security-score", "wallet-count"]),
    format: z.enum(["number", "currency", "percent"]),
  }).strict(),
  z.object({
    type: z.literal("badge"),
    id: safeId,
    label: safeText,
    tone: cardTone.default("neutral"),
  }).strict(),
  z.object({
    type: z.literal("list"),
    id: safeId,
    title: safeText.optional(),
    items: z.array(z.string().trim().min(1).max(180)).min(1).max(8),
    tone: cardTone.default("neutral"),
  }).strict(),
  z.object({
    type: z.literal("divider"),
    id: safeId,
    label: safeText.optional(),
  }).strict(),
  z.object({
    type: z.literal("card"),
    id: safeId,
    title: safeText.optional(),
    tone: cardTone.default("neutral"),
    text: z.string().trim().max(500).optional(),
    body: z.string().trim().max(500).optional(),
    content: z.string().trim().max(500).optional(),
    description: z.string().trim().max(500).optional(),
    severity: z.enum(["low", "medium", "high"]).optional(),
    width: widgetWidth.optional(),
  }).strict(),
]);

export const uiSpecSchema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300),
  accentPreset: z.enum(["cyan", "violet", "emerald", "amber", "rose", "slate"]),
  layout: z.enum(["stack", "grid"]),
  columns: z.number().int().min(1).max(4),
  components: z.array(uiComponentSchema).min(1).max(24),
}).strict().superRefine((value, context) => {
  const ids = new Set<string>();
  for (const component of value.components) {
    if (ids.has(component.id)) context.addIssue({ code: "custom", path: ["components"], message: "Component IDs must be unique." });
    ids.add(component.id);
  }
  if (value.layout === "stack" && value.columns !== 1) context.addIssue({ code: "custom", path: ["columns"], message: "Stack layouts must use one column." });
});

export type UIComponent = z.infer<typeof uiComponentSchema>;
export type UISpec = z.infer<typeof uiSpecSchema>;

export function sanitizeUiSpec(raw: unknown): UISpec {
  return uiSpecSchema.parse(raw);
}

export function isSafeUiSpec(raw: unknown): raw is UISpec {
  return uiSpecSchema.safeParse(raw).success;
}

export const uiResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: ["customize_ui", "unsupported"] },
    explanation: { type: "string" },
    warnings: { type: "array", items: { type: "string" }, maxItems: 10 },
    requiresApproval: { type: "boolean" },
    ui: {
      type: "object",
      additionalProperties: false,
      properties: {
        version: { type: "integer", enum: [1] },
        title: { type: "string" },
        description: { type: "string" },
        accentPreset: { type: "string", enum: ["cyan", "violet", "emerald", "amber", "rose", "slate"] },
        layout: { type: "string", enum: ["stack", "grid"] },
        columns: { type: "integer", minimum: 1, maximum: 4 },
        components: {
          type: "array",
          maxItems: 24,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["widget", "text", "metric", "card", "badge", "list", "divider"] },
              id: { type: "string" },
              widgetType: { anyOf: [{ type: "string", enum: [...allowedWidgetTypes] }, { type: "null" }] },
              title: { anyOf: [{ type: "string" }, { type: "null" }] },
              width: { anyOf: [{ type: "string", enum: ["small", "medium", "large", "full"] }, { type: "null" }] },
              text: { anyOf: [{ type: "string" }, { type: "null" }] },
              body: { anyOf: [{ type: "string" }, { type: "null" }] },
              content: { anyOf: [{ type: "string" }, { type: "null" }] },
              description: { anyOf: [{ type: "string" }, { type: "null" }] },
              emphasis: { anyOf: [{ type: "string", enum: ["normal", "muted", "strong"] }, { type: "null" }] },
              label: { anyOf: [{ type: "string" }, { type: "null" }] },
              source: { anyOf: [{ type: "string", enum: ["portfolio-value", "native-balances", "security-score", "wallet-count"] }, { type: "null" }] },
              format: { anyOf: [{ type: "string", enum: ["number", "currency", "percent"] }, { type: "null" }] },
              tone: { anyOf: [{ type: "string", enum: ["neutral", "accent", "success", "warning", "info", "danger"] }, { type: "null" }] },
              severity: { anyOf: [{ type: "string", enum: ["low", "medium", "high"] }, { type: "null" }] },
            },
            required: ["type", "id", "widgetType", "title", "width", "text", "body", "content", "description", "emphasis", "label", "source", "format", "tone", "severity"],
          },
        },
      },
      required: ["version", "title", "description", "accentPreset", "layout", "columns", "components"],
    },
  },
  required: ["intent", "explanation", "warnings", "requiresApproval", "ui"],
} as const;

export type UIPlan = {
  intent: "customize_ui" | "unsupported";
  explanation: string;
  warnings: string[];
  requiresApproval: boolean;
  ui: UISpec | null;
  source: "ai";
  model?: string;
};

export function emptyUiSpec(): UISpec {
  return {
    version: 1,
    title: "AvhiSafe workspace",
    description: "Your AI-generated personal wallet workspace.",
    accentPreset: "cyan",
    layout: "grid",
    columns: 2,
    components: [
      { type: "widget", id: "portfolio-value", widgetType: "portfolio-value", title: "Portfolio value", width: "large" },
      { type: "widget", id: "connected-wallets", widgetType: "connected-wallets", title: "Connected wallets", width: "medium" },
      { type: "widget", id: "security-score", widgetType: "security-score", title: "Security score", width: "medium" },
    ],
  };
}

export function defaultUiSpec(): UISpec {
  return emptyUiSpec();
}
