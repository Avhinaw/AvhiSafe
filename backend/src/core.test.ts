import assert from "node:assert/strict";
import { planDashboardChange } from "./aiPlanner.js";
import { applyOperations } from "./dashboardService.js";
import type { DashboardDocument } from "./models.js";

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

console.log("AvhiSafe dashboard core tests passed.");
