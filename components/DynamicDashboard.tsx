"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard, RotateCcw, Sparkles, Wand2, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import ConnectedWallets from "./ConnectedWallets";
import PortfolioDashboard from "./PortfolioDashboard";
import SecurityCenter from "./SecurityCenter";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { applyDashboardPlan, createDashboard, getAiStatus, loadWorkspace, planDashboard, undoDashboardUi, type AiStatus, type Dashboard, type DashboardPlan, type DashboardWidget, type UIComponent, type UIDocument, type UISpec } from "@/lib/dashboardApi";

const accentClasses: Record<UISpec["accentPreset"], string> = {
  cyan: "border-cyan-500/30 bg-cyan-500/[0.04]",
  violet: "border-violet-500/30 bg-violet-500/[0.04]",
  emerald: "border-emerald-500/30 bg-emerald-500/[0.04]",
  amber: "border-amber-500/30 bg-amber-500/[0.04]",
  rose: "border-rose-500/30 bg-rose-500/[0.04]",
  slate: "border-slate-500/30 bg-slate-500/[0.04]",
};

function widgetLabel(widget: DashboardWidget) { return widget.title || widget.type.replaceAll("-", " "); }

function RegisteredWidget({ widgetType, preview = false }: { widgetType: string; preview?: boolean }) {
  if (preview) return <div className="rounded-xl bg-primary/[0.03] p-5 text-sm text-primary/60">Registered {widgetType.replaceAll("-", " ")} data widget preview</div>;
  if (widgetType === "connected-wallets") return <ConnectedWallets />;
  if (widgetType === "portfolio-value") return <PortfolioDashboard />;
  if (widgetType === "security-score") return <SecurityCenter />;
  return <div className="rounded-xl bg-primary/[0.03] p-8 text-center"><p className="font-semibold">{widgetType.replaceAll("-", " ")}</p><p className="mt-2 text-sm text-primary/55">This registered data adapter is enabled for your AI-generated workspace.</p></div>;
}

function GeneratedComponent({ component, preview = false }: { component: UIComponent; preview?: boolean }) {
  if (component.type === "widget") return <div className="min-w-0 rounded-2xl border border-primary/10 bg-background/60 p-3"><div className="mb-3 break-words px-2 text-xs font-bold uppercase tracking-wider text-primary/45">{component.title || component.widgetType.replaceAll("-", " ")}</div><RegisteredWidget widgetType={component.widgetType} preview={preview} /></div>;
  if (component.type === "text") return <p className={component.emphasis === "strong" ? "text-lg font-bold" : component.emphasis === "muted" ? "text-sm text-primary/60" : "text-sm"}>{component.text}</p>;
  if (component.type === "metric") return <div className="min-w-0 rounded-2xl border border-primary/10 bg-background/60 p-5"><p className="break-words text-xs font-bold uppercase tracking-wider text-primary/50">{component.label}</p><p className="mt-3 text-sm text-primary/65">Live {component.source.replaceAll("-", " ")} data</p><p className="mt-1 text-xs text-primary/45">Format: {component.format}</p></div>;
  if (component.type === "divider") return <div className="flex items-center gap-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary/40"><span className="h-px flex-1 bg-primary/10" />{component.label && <span>{component.label}</span>}<span className="h-px flex-1 bg-primary/10" /></div>;
  const toneClass = component.tone === "success" ? "border-emerald-500/30 bg-emerald-500/10" : component.tone === "warning" || component.tone === "danger" ? "border-amber-500/30 bg-amber-500/10" : component.tone === "accent" ? "border-primary/30 bg-primary/10" : component.tone === "info" ? "border-cyan-500/30 bg-cyan-500/10" : "border-primary/10 bg-background/60";
  if (component.type === "badge") return <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-bold ${toneClass}`}>{component.label}</span>;
  if (component.type === "list") return <div className={`min-w-0 rounded-2xl border p-5 ${toneClass}`}>{component.title && <p className="break-words font-semibold">{component.title}</p>}<ul className="mt-3 space-y-2 text-sm text-primary/70">{component.items.map((item) => <li key={item} className="flex min-w-0 gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-current" /><span className="break-words">{item}</span></li>)}</ul></div>;
  const copy = component.text || component.body || component.content || component.description;
  return <div className={`min-w-0 rounded-2xl border p-5 ${toneClass}`}><p className="break-words font-semibold">{component.title || "AI-generated card"}</p>{component.severity && <p className="mt-1 text-xs font-bold uppercase tracking-wider text-primary/45">{component.severity} severity</p>}{copy && <p className="mt-2 break-words text-sm text-primary/65">{copy}</p>}</div>;
}

function gridClass(columns: number) { return columns >= 4 ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4" : columns === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"; }

function GeneratedUi({ document, preview = false }: { document: UIDocument; preview?: boolean }) {
  const spec = document.spec;
  const components = useMemo(() => spec.components, [spec.components]);
  return <div className={`min-w-0 overflow-hidden rounded-3xl border p-4 sm:p-6 ${accentClasses[spec.accentPreset]}`} data-ui-version={document.version} data-ui-source={document.source}><div className="mb-6 min-w-0"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/50">AI-generated personal interface · v{document.version}</p><h3 className="mt-2 break-words text-2xl font-black tracking-tight sm:text-3xl">{spec.title}</h3><p className="mt-2 max-w-2xl break-words text-sm leading-6 text-primary/60">{spec.description}</p></div><div className={`${spec.layout === "grid" ? `grid ${gridClass(spec.columns)}` : "flex flex-col"} min-w-0 gap-4`}>{components.map((component) => <GeneratedComponent key={component.id} component={component} preview={preview} />)}</div></div>;
}

export default function DynamicDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [uiDocument, setUiDocument] = useState<UIDocument | null>(null);
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<DashboardPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);

  const load = async () => { setLoading(true); setBackendError(null); try { const data = await loadWorkspace(); setDashboard(data.dashboard); setUiDocument(data.uiDocument); void getAiStatus().then(setAiStatus).catch(() => setAiStatus(null)); } catch (error) { setBackendError(error instanceof Error ? error.message : "The AI workspace backend is unavailable."); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);

  const runPlan = async () => { if (!dashboard || !uiDocument) return; const requestedPrompt = prompt.trim(); if (!requestedPrompt) { toast.error("Describe the UI you want the AI to create."); return; } setPlanning(true); setPlan(null); try { const result = await planDashboard(dashboard._id, requestedPrompt); setPlan(result.plan); } catch (error) { toast.error(error instanceof Error ? error.message : "AI provider unavailable. No local planner was used."); } finally { setPlanning(false); } };
  const applyPlan = async () => { if (!dashboard || !plan?.ui || plan.intent !== "customize_ui") return; setApplying(true); try { const result = await applyDashboardPlan(dashboard._id, prompt.trim(), plan); setDashboard(result.dashboard); setUiDocument(result.uiDocument); setPlan(null); toast.success("AI-generated UI saved to your personal dashboard."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save AI-generated UI."); } finally { setApplying(false); } };
  const undo = async () => { if (!dashboard) return; try { const result = await undoDashboardUi(dashboard._id); setDashboard(result.dashboard); setUiDocument(result.uiDocument); setPlan(null); toast.success("Previous AI-generated UI restored."); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to restore the previous AI UI."); } };
  const newDashboard = async () => { if (!dashboard) return; try { const result = await createDashboard({ name: "New personal dashboard", slug: `dashboard-${Date.now()}`, theme: dashboard.theme, currency: dashboard.currency, density: dashboard.density, isDefault: false, widgets: [], filters: {} }); setDashboard(result.dashboard); setUiDocument(result.uiDocument); setPlan(null); toast.success("New personal AI dashboard created."); } catch { toast.error("Unable to create a synced dashboard."); } };

  if (loading) return <section className="mt-12 rounded-3xl border border-primary/10 p-8 text-center text-sm text-primary/60">Loading your AI-generated personal workspace…</section>;
  if (!dashboard || !uiDocument) return <section className="mt-12 rounded-3xl border border-amber-500/30 bg-amber-500/[0.05] p-8"><div className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-5 text-amber-600" />AI workspace unavailable</div><p className="mt-2 text-sm text-primary/65">{backendError || "Connect the backend and configure an AI provider. This screen does not run a static or keyword-based fallback."}</p><Button className="mt-4" variant="outline" onClick={() => void load()}>Retry connection</Button></section>;

  return <section className="mt-12 min-w-0 overflow-hidden rounded-3xl border border-primary/10 bg-background p-4 pt-10 text-foreground transition-colors duration-200 sm:p-6 sm:pt-12"><div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-primary/50">Universal AI workspace</p><h2 className="mt-2 flex items-center gap-3 text-4xl font-black tracking-tight"><LayoutDashboard className="size-8" />{dashboard.name}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-primary/60">This interface is generated by AI, saved in MongoDB, and isolated to this dashboard and user.</p></div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-3 py-2 text-xs font-bold ${aiStatus?.configured ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}>{aiStatus ? aiStatus.configured ? `AI provider · ${aiStatus.model}` : "AI provider not configured" : "Checking AI provider…"}</span><Button variant="outline" className="gap-2" onClick={newDashboard}><LayoutDashboard className="size-4" />New dashboard</Button><Button variant="ghost" className="gap-2" onClick={undo}><RotateCcw className="size-4" />Undo AI UI</Button></div></div>
    <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-5"><div className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-primary/60" />Describe the interface you want</div><p className="mt-2 text-xs text-primary/55">The prompt is sent to the server-side AI model. The model returns a complete UI document, not keyword operations.</p><div className="mt-3 flex flex-col gap-3 md:flex-row"><Input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runPlan(); }} placeholder="Build a dark risk-focused dashboard with security first, portfolio history, and a compact two-column layout" /><Button className="gap-2 md:min-w-32" disabled={planning} onClick={runPlan}><Wand2 className="size-4" />{planning ? "Asking AI…" : "Generate UI"}</Button></div>{plan && <div className="mt-4 rounded-xl bg-background p-4"><p className="font-semibold">{plan.explanation}</p><p className="mt-1 text-xs text-primary/50">Source: {plan.source}{plan.model ? ` · ${plan.model}` : ""} · {plan.ui?.components.length || 0} generated components</p>{plan.warnings.map((warning) => <p key={warning} className="mt-2 text-sm text-amber-700">{warning}</p>)}{plan.ui && <><p className="mt-3 text-sm text-primary/65">Preview: “{plan.ui.title}” with {plan.ui.layout} layout, {plan.ui.columns} column{plan.ui.columns === 1 ? "" : "s"}, and {plan.ui.accentPreset} accent.</p><div className="mt-4"><GeneratedUi document={{ _id: "ai-preview", userId: dashboard.userId, dashboardId: dashboard._id, version: uiDocument.version + 1, source: "ai", spec: plan.ui, createdAt: uiDocument.createdAt, updatedAt: uiDocument.updatedAt }} preview /></div></>}<div className="mt-4 flex flex-wrap gap-2"><Button disabled={applying || !plan.ui || plan.intent !== "customize_ui"} onClick={applyPlan} className="gap-2"><Check className="size-4" />{applying ? "Saving AI UI…" : "Apply AI UI to my dashboard"}</Button><Button variant="ghost" onClick={() => setPlan(null)}>Cancel</Button></div></div>}</div>
    <GeneratedUi document={uiDocument} />
  </section>;
}
