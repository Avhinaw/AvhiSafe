import assert from "node:assert/strict";
import { planDashboardChange, sanitizePlan } from "./aiPlanner.js";
import { applyOperations } from "./dashboardService.js";
import type { DashboardDocument } from "./models/index.js";

delete process.env.AI_API_KEY;
delete process.env.AI_API_BASE;
delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_API_BASE;

const dashboard: DashboardDocument = { _id: "dashboard-a", userId: "user-a", slug: "main", name: "User A", theme: "system", currency: "USD", density: "comfortable", isDefault: true, widgets: [{ id: "portfolio", type: "portfolio-value", enabled: true, position: 0, width: "large", config: {} }], filters: {}, createdAt: new Date(), updatedAt: new Date() };

const plan = await planDashboardChange("Make it dark, compact, and add NFT security widgets", dashboard);
assert.equal(plan.intent, "customize_dashboard");
assert.ok(plan.operations.some((operation) => operation.type === "set_theme"));
assert.ok(plan.operations.some((operation) => operation.type === "enable_widget" && operation.widgetType === "nft-gallery"));
assert.ok(plan.operations.every((operation) => typeof operation.type === "string"));

const next = applyOperations(dashboard, plan.operations);
assert.equal(next.theme, "dark");
assert.equal(next.density, "compact");
assert.equal(next.userId, "user-a");
assert.ok(next.widgets.some((widget) => widget.type === "nft-gallery" && widget.enabled));

const unsafe = await planDashboardChange("Send my funds and expose my private key", dashboard);
assert.equal(unsafe.operations.length, 0);
assert.ok(unsafe.warnings.length > 0);

const dashboardB = { ...dashboard, _id: "dashboard-b", userId: "user-b", name: "User B", widgets: structuredClone(dashboard.widgets) };
const beforeB = JSON.stringify(dashboardB);
const changedA = applyOperations(dashboard, [{ type: "enable_widget", widgetType: "nft-gallery", width: "large" }]);
assert.notEqual(JSON.stringify(changedA), JSON.stringify(dashboard));
assert.equal(JSON.stringify(dashboardB), beforeB);
const rejected = sanitizePlan({ intent: "customize_dashboard", explanation: "test", operations: [{ type: "enable_widget", widgetType: "execute-shell" }], warnings: [], requiresApproval: true });
assert.equal(rejected.operations.length, 0);

const originalFetch = globalThis.fetch;
let providerRequest: Record<string, unknown> | undefined;
process.env.AI_API_KEY = "test-key";
process.env.AI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";
process.env.AI_MODEL = "gemini-2.5-flash";
globalThis.fetch = async (_input, init) => {
  providerRequest = JSON.parse(String(init?.body)) as Record<string, unknown>;
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ intent: "customize_dashboard", explanation: "AI plan", operations: [{ type: "set_theme", value: "dark" }], warnings: [], requiresApproval: true }) } }] }), { status: 200, headers: { "content-type": "application/json" } });
};
const providerPlan = await planDashboardChange("Use a dark theme", dashboard);
assert.equal(providerPlan.operations[0]?.type, "set_theme");
assert.equal(providerRequest?.max_tokens, 16384);
assert.equal(providerRequest?.max_completion_tokens, undefined);
globalThis.fetch = originalFetch;
delete process.env.AI_API_KEY;
delete process.env.AI_API_BASE;
delete process.env.AI_MODEL;

console.log("AvhiSafe dashboard core tests passed.");
