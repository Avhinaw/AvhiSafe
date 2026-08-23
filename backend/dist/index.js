import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { findDefaultWorkspace, listFeaturePermissions, listPublicAddresses, listWidgets } from "./db.js";
const app = express();
const port = Number(process.env.PORT || 4000);
const origin = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(cors({ origin }));
app.use(express.json({ limit: "256kb" }));
function userIdFromRequest(request) {
    const userId = request.header("x-user-id");
    if (!userId || !/^[a-zA-Z0-9_-]{1,64}$/.test(userId))
        throw new Error("Missing or invalid x-user-id.");
    return userId;
}
app.get("/health", (_request, response) => response.json({ ok: true, service: "avhisafe-backend", timestamp: new Date().toISOString() }));
app.get("/ready", async (_request, response) => {
    try {
        await findDefaultWorkspace("health-check");
        response.json({ ok: true, database: "available" });
    }
    catch (error) {
        response.status(503).json({ ok: false, database: "unavailable", message: error instanceof Error ? error.message : "Database unavailable." });
    }
});
app.get("/api/v1/workspace", async (request, response) => {
    try {
        const userId = userIdFromRequest(request);
        const workspace = await findDefaultWorkspace(userId);
        if (!workspace)
            return response.status(404).json({ error: "Workspace not found." });
        const [widgets, addresses, permissions] = await Promise.all([
            listWidgets(userId, workspace.id),
            listPublicAddresses(userId),
            listFeaturePermissions(userId),
        ]);
        return response.json({ workspace, widgets, addresses, permissions });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unable to load workspace.";
        return response.status(message.includes("x-user-id") ? 401 : 500).json({ error: message });
    }
});
const workspacePatch = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    theme: z.enum(["light", "dark", "system"]).optional(),
    currency: z.string().trim().regex(/^[A-Z]{3,8}$/).optional(),
    density: z.enum(["comfortable", "compact", "analytics"]).optional(),
}).strict();
app.patch("/api/v1/workspace", (request, response) => {
    try {
        userIdFromRequest(request);
        const patch = workspacePatch.parse(request.body);
        return response.status(501).json({ error: "Workspace writes will be enabled after authentication middleware is connected.", acceptedFields: Object.keys(patch) });
    }
    catch (error) {
        return response.status(400).json({ error: error instanceof Error ? error.message : "Invalid workspace update." });
    }
});
app.use((error, _request, response, _next) => {
    response.status(500).json({ error: error instanceof Error ? error.message : "Unexpected server error." });
});
app.listen(port, () => console.log(`AvhiSafe backend listening on http://localhost:${port}`));
