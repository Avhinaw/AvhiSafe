import { z } from "zod";
import { allowedWidgetTypes } from "./widgetCatalog.js";

const widgetType = z.string().refine((value) => allowedWidgetTypes.has(value), "Widget is not registered.");
const width = z.enum(["small", "medium", "large", "full"]);

export const dashboardOperationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set_dashboard_name"), value: z.string().trim().min(1).max(120) }).strict(),
  z.object({ type: z.literal("enable_widget"), widgetType, title: z.string().trim().max(120).optional(), width: width.optional() }).strict(),
  z.object({ type: z.literal("disable_widget"), widgetType }).strict(),
  z.object({ type: z.literal("move_widget"), widgetType, position: z.number().int().min(0).max(19) }).strict(),
  z.object({ type: z.literal("resize_widget"), widgetType, width }).strict(),
  z.object({ type: z.literal("rename_widget"), widgetType, title: z.string().trim().min(1).max(120) }).strict(),
  z.object({ type: z.literal("set_theme"), value: z.enum(["light", "dark", "system"]) }).strict(),
  z.object({ type: z.literal("set_density"), value: z.enum(["comfortable", "compact", "analytics"]) }).strict(),
]);

export const dashboardOperationsSchema = z.array(dashboardOperationSchema).max(20);

