import type { DashboardDocument } from "./models/index.js";
import { allowedWidgetTypes, type DashboardOperation, type DashboardPlan, widgetCatalog } from "./widgetCatalog.js";

const operationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["enable_widget", "disable_widget", "move_widget", "resize_widget", "set_theme", "set_currency", "set_density", "set_filter"] },
    widgetType: { type: "string" },
    title: { type: "string" },
    width: { type: "string", enum: ["small", "medium", "large", "full"] },
    position: { type: "integer", minimum: 0, maximum: 100 },
    value: {},
    key: { type: "string" },
  },
  required: ["type"],
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    intent: { type: "string", enum: ["customize_dashboard", "unsupported"] },
    explanation: { type: "string" },
    operations: { type: "array", items: operationSchema, maxItems: 20 },
    warnings: { type: "array", items: { type: "string" }, maxItems: 10 },
    requiresApproval: { type: "boolean" },
  },
  required: ["intent", "explanation", "operations", "warnings", "requiresApproval"],
};

function fallbackPlan(prompt: string): DashboardPlan {
  const text = prompt.toLowerCase();
  const operations: DashboardOperation[] = [];
  const warnings: string[] = [];
  const findWidget = (names: string[]) => widgetCatalog.find((widget) => names.some((name) => text.includes(name) && (widget.type.includes(name) || widget.label.toLowerCase().includes(name))));
  const enable = (names: string[]) => { const widget = findWidget(names); if (widget) operations.push({ type: "enable_widget", widgetType: widget.type, width: widget.defaultWidth }); };
  const disable = (names: string[]) => { const widget = findWidget(names); if (widget) operations.push({ type: "disable_widget", widgetType: widget.type }); };
  if (text.includes("dark")) operations.push({ type: "set_theme", value: "dark" });
  else if (text.includes("light")) operations.push({ type: "set_theme", value: "light" });
  if (text.includes("compact")) operations.push({ type: "set_density", value: "compact" });
  if (text.includes("analytics")) operations.push({ type: "set_density", value: "analytics" });
  if (text.includes("inr") || text.includes("rupee")) operations.push({ type: "set_currency", value: "INR" });
  if (text.includes("eur") || text.includes("euro")) operations.push({ type: "set_currency", value: "EUR" });
  if (text.includes("nft")) enable(["nft"]);
  if (text.includes("defi") || text.includes("staking")) enable(["defi"]);
  if (text.includes("security") || text.includes("risk")) enable(["security", "risk"]);
  if (text.includes("history") || text.includes("chart")) enable(["history"]);
  if (text.includes("transaction") || text.includes("activity")) enable(["transaction", "activity"]);
  if (text.includes("token")) enable(["token"]);
  if (text.includes("wallet")) enable(["wallet"]);
  if (text.includes("hide") || text.includes("remove") || text.includes("disable")) {
    if (text.includes("ethereum")) disable(["balances"]);
    if (text.includes("transaction")) disable(["transaction", "activity"]);
    if (text.includes("nft")) disable(["nft"]);
  }
  if (text.includes("send") || text.includes("transfer") || text.includes("sign") || text.includes("private key")) warnings.push("Transaction signing and private-key operations are not available through the AI dashboard planner.");
  if (operations.length === 0) return { intent: "unsupported", explanation: "I could not map that request to a supported dashboard customization.", operations: [], warnings: ["Try asking to enable, disable, move, resize, or restyle a supported widget."], requiresApproval: false };
  return { intent: "customize_dashboard", explanation: `Prepared ${operations.length} safe dashboard customization operation${operations.length === 1 ? "" : "s"}.`, operations, warnings, requiresApproval: true };
}

export function sanitizePlan(raw: unknown): DashboardPlan {
  const candidate = raw as Partial<DashboardPlan>;
  const operations = Array.isArray(candidate.operations) ? candidate.operations.filter((operation) => {
    if (!operation || typeof operation !== "object" || typeof (operation as { type?: unknown }).type !== "string") return false;
    const item = operation as { type: string; widgetType?: string; position?: number; width?: string; key?: string; value?: unknown };
    if (["enable_widget", "disable_widget", "move_widget", "resize_widget"].includes(item.type) && (!item.widgetType || !allowedWidgetTypes.has(item.widgetType))) return false;
    if (item.type === "move_widget" && (!Number.isInteger(item.position) || item.position! < 0 || item.position! > 100)) return false;
    if (item.type === "resize_widget" && !["small", "medium", "large", "full"].includes(item.width || "")) return false;
    if (item.type === "set_filter" && (!item.key || item.key.length > 80)) return false;
    return ["enable_widget", "disable_widget", "move_widget", "resize_widget", "set_theme", "set_currency", "set_density", "set_filter"].includes(item.type);
  }) as DashboardOperation[] : [];
  return { intent: candidate.intent === "customize_dashboard" ? "customize_dashboard" : "unsupported", explanation: typeof candidate.explanation === "string" ? candidate.explanation : "Validated dashboard plan.", operations, warnings: Array.isArray(candidate.warnings) ? candidate.warnings.filter((item): item is string => typeof item === "string").slice(0, 10) : [], requiresApproval: operations.length > 0 };
}

async function providerPlan(prompt: string, dashboard: DashboardDocument): Promise<DashboardPlan | null> {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.AI_API_BASE || process.env.OPENAI_API_BASE;
  const model = process.env.AI_MODEL || "gpt-5-mini";
  if (!apiKey || !baseUrl) return null;
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: [{ role: "system", content: `You are AvhiSafe's dashboard planner. Return only safe per-user UI operations. Never change vault security, private keys, transaction signing, or other users. Supported widgets: ${widgetCatalog.map((widget) => widget.type).join(", ")}. Current dashboard: ${JSON.stringify({ name: dashboard.name, theme: dashboard.theme, currency: dashboard.currency, density: dashboard.density, widgets: dashboard.widgets })}` }, { role: "user", content: prompt }], response_format: { type: "json_schema", json_schema: { name: "avhisafe_dashboard_plan", strict: true, schema: responseSchema } }, max_completion_tokens: 1800 }) });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}.`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI provider returned an empty plan.");
  return sanitizePlan(JSON.parse(content));
}

export async function planDashboardChange(prompt: string, dashboard: DashboardDocument) {
  try { return (await providerPlan(prompt, dashboard)) || fallbackPlan(prompt); }
  catch (error) { const plan = fallbackPlan(prompt); plan.warnings.unshift(error instanceof Error ? error.message : "AI provider unavailable; used local safe planner."); return plan; }
}
