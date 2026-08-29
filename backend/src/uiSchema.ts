import { z } from "zod";
import { allowedWidgetTypes } from "./widgetCatalog.js";

const safeId = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const safeText = z.string().trim().max(240);
const widgetWidth = z.enum(["small", "medium", "large", "full"]);

export const uiComponentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("widget"),
    id: safeId,
    widgetType: z.string().refine((value) => allowedWidgetTypes.has(value), "Widget is not registered."),
    title: safeText.optional(),
    width: widgetWidth.default("medium"),
  }),
  z.object({
    type: z.literal("text"),
    id: safeId,
    text: z.string().trim().min(1).max(500),
    emphasis: z.enum(["normal", "muted", "strong"]).default("normal"),
  }),
  z.object({
    type: z.literal("metric"),
    id: safeId,
    label: safeText,
    source: z.enum(["portfolio-value", "native-balances", "security-score", "wallet-count"]),
    format: z.enum(["number", "currency", "percent"]),
  }),
  z.object({
    type: z.literal("card"),
    id: safeId,
    title: safeText.optional(),
    tone: z.enum(["neutral", "accent", "success", "warning", "info", "danger"]).default("neutral"),
    text: z.string().trim().max(500).optional(),
    body: z.string().trim().max(500).optional(),
    content: z.string().trim().max(500).optional(),
    description: z.string().trim().max(500).optional(),
    severity: z.enum(["low", "medium", "high"]).optional(),
    width: widgetWidth.optional(),
  }),
]);

export const uiSpecSchema = z.object({
  version: z.literal(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300),
  accentPreset: z.enum(["cyan", "violet", "emerald", "amber", "rose", "slate"]),
  layout: z.enum(["stack", "grid"]),
  columns: z.number().int().min(1).max(4),
  components: z.array(uiComponentSchema).min(1).max(24),
}).superRefine((value, context) => {
  const ids = new Set<string>();
  for (const component of value.components) {
    if (ids.has(component.id)) context.addIssue({ code: "custom", path: ["components"], message: "Component IDs must be unique." });
    ids.add(component.id);
  }
  if (value.layout === "stack" && value.columns !== 1) context.addIssue({ code: "custom", path: ["columns"], message: "Stack layouts must use one column." });
});

export type UIComponent = z.infer<typeof uiComponentSchema>;
export type UISpec = z.infer<typeof uiSpecSchema>;

// --- Fields allowed per component type (used to strip extras from AI output) ---
const ALLOWED_FIELDS: Record<string, Set<string>> = {
  widget: new Set(["type", "id", "widgetType", "title", "width"]),
  text: new Set(["type", "id", "text", "emphasis"]),
  metric: new Set(["type", "id", "label", "source", "format"]),
  card: new Set(["type", "id", "title", "tone", "text", "body", "content", "description", "severity", "width"]),
};

const VALID_ACCENTS = new Set(["cyan", "violet", "emerald", "amber", "rose", "slate"]);
const VALID_LAYOUTS = new Set(["stack", "grid"]);

/**
 * Aggressively fix common AI response mistakes BEFORE Zod validation.
 * This ensures that even sloppy AI output becomes valid.
 */
export function autoFixUiSpec(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const spec = structuredClone(raw) as Record<string, unknown>;

  // Force version
  spec.version = 1;

  // Fix accentPreset
  if (!spec.accentPreset || !VALID_ACCENTS.has(spec.accentPreset as string)) spec.accentPreset = "cyan";

  // Fix layout
  if (!spec.layout || !VALID_LAYOUTS.has(spec.layout as string)) spec.layout = "grid";

  // Clamp columns
  if (typeof spec.columns !== "number" || spec.columns < 1 || spec.columns > 4) spec.columns = 2;
  spec.columns = Math.round(spec.columns as number);

  // Stack must have 1 column
  if (spec.layout === "stack") spec.columns = 1;

  // Fix title/description
  if (!spec.title || typeof spec.title !== "string") spec.title = "AvhiSafe workspace";
  if (!spec.description || typeof spec.description !== "string") spec.description = "Your AI-generated personal wallet workspace.";
  if ((spec.title as string).length > 120) spec.title = (spec.title as string).slice(0, 120);
  if ((spec.description as string).length > 300) spec.description = (spec.description as string).slice(0, 300);

  // Fix components
  if (!Array.isArray(spec.components) || spec.components.length === 0) {
    spec.components = [
      { type: "widget", id: "portfolio-value", widgetType: "portfolio-value", title: "Portfolio value", width: "large" },
      { type: "widget", id: "connected-wallets", widgetType: "connected-wallets", title: "Connected wallets", width: "medium" },
      { type: "widget", id: "security-score", widgetType: "security-score", title: "Security score", width: "medium" },
    ];
    return spec;
  }

  const usedIds = new Set<string>();
  const fixedComponents: unknown[] = [];

  for (const rawComponent of spec.components as unknown[]) {
    if (!rawComponent || typeof rawComponent !== "object") continue;
    const component = rawComponent as Record<string, unknown>;

    // Strip null/undefined values
    for (const [key, value] of Object.entries(component)) {
      if (value === null || value === undefined) delete component[key];
    }

    // Must have a valid type
    const componentType = component.type as string;
    if (!componentType || !ALLOWED_FIELDS[componentType]) continue;

    // Strip fields that don't belong to this component type
    const allowed = ALLOWED_FIELDS[componentType];
    for (const key of Object.keys(component)) {
      if (!allowed.has(key)) delete component[key];
    }

    // Fix ID: must match /^[a-z0-9][a-z0-9_-]{0,63}$/
    if (!component.id || typeof component.id !== "string") {
      component.id = `${componentType}-${fixedComponents.length + 1}`;
    } else {
      // Sanitize the ID
      let fixedId = (component.id as string).toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/^[^a-z0-9]/, "a").slice(0, 64);
      if (!fixedId) fixedId = `${componentType}-${fixedComponents.length + 1}`;
      component.id = fixedId;
    }

    // Deduplicate IDs
    let finalId = component.id as string;
    if (usedIds.has(finalId)) {
      let suffix = 2;
      while (usedIds.has(`${finalId}-${suffix}`)) suffix++;
      finalId = `${finalId}-${suffix}`;
      component.id = finalId;
    }
    usedIds.add(finalId);

    // Widget: validate widgetType against catalog
    if (componentType === "widget") {
      if (!component.widgetType || !allowedWidgetTypes.has(component.widgetType as string)) continue;
      if (!component.width) component.width = "medium";
    }

    // Text: ensure text exists
    if (componentType === "text") {
      if (!component.text || typeof component.text !== "string") continue;
      if (!component.emphasis) component.emphasis = "normal";
    }

    // Metric: validate source
    if (componentType === "metric") {
      const validSources = new Set(["portfolio-value", "native-balances", "security-score", "wallet-count"]);
      if (!component.source || !validSources.has(component.source as string)) continue;
      const validFormats = new Set(["number", "currency", "percent"]);
      if (!component.format || !validFormats.has(component.format as string)) component.format = "number";
    }

    // Card: defaults
    if (componentType === "card") {
      if (!component.tone) component.tone = "neutral";
    }

    fixedComponents.push(component);
  }

  // Limit to 24 and ensure at least 1
  spec.components = fixedComponents.slice(0, 24);
  if ((spec.components as unknown[]).length === 0) {
    spec.components = [
      { type: "widget", id: "portfolio-value", widgetType: "portfolio-value", title: "Portfolio value", width: "large" },
    ];
  }

  return spec;
}

/**
 * Validate and fix a UI spec. Throws on failure.
 */
export function sanitizeUiSpec(raw: unknown): UISpec {
  const fixed = autoFixUiSpec(raw);
  return uiSpecSchema.parse(fixed);
}

/**
 * Safe version that NEVER throws. Returns the validated spec or a fallback.
 */
export function safeSanitizeUiSpec(raw: unknown, fallback?: UISpec): { ok: true; spec: UISpec } | { ok: false; error: string; spec: UISpec } {
  try {
    const spec = sanitizeUiSpec(raw);
    return { ok: true, spec };
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
      : error instanceof Error ? error.message : "Invalid UI spec.";
    return { ok: false, error: message, spec: fallback || defaultUiSpec() };
  }
}

export function isSafeUiSpec(raw: unknown): raw is UISpec {
  return safeSanitizeUiSpec(raw).ok;
}

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
