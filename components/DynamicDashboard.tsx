"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LayoutDashboard, RotateCcw, Sparkles, Wand2, Check, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ConnectedWallets from "./ConnectedWallets";
import PortfolioDashboard from "./PortfolioDashboard";
import SecurityCenter from "./SecurityCenter";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { applyDashboardPlan, createDashboard, loadWorkspace, planDashboard, undoDashboardUi, type Dashboard, type DashboardPlan, type DashboardWidget, type UIComponent, type UIDocument, type UISpec } from "@/lib/dashboardApi";
import { AiWorkspaceLoader } from "./ui/AiWorkspaceLoader";

const accentClasses: Record<string, string> = {
  cyan: "border-cyan-500/30 bg-cyan-500/[0.04]",
  violet: "border-violet-500/30 bg-violet-500/[0.04]",
  emerald: "border-emerald-500/30 bg-emerald-500/[0.04]",
  amber: "border-amber-500/30 bg-amber-500/[0.04]",
  rose: "border-rose-500/30 bg-rose-500/[0.04]",
  slate: "border-slate-500/30 bg-slate-500/[0.04]",
};

const PROMPT_SUGGESTIONS = [
  "Minimal single-column dashboard with just portfolio and security",
  "Analytics-focused 3-column grid with all metrics and risk summary",
  "Dark risk-focused dashboard with security first and emerald accent",
  "Compact two-column layout with portfolio history and connected wallets",
  "Show everything — all widgets in a 2-column grid with violet theme",
];

function widgetLabel(widget: DashboardWidget) { return widget.title || widget.type.replaceAll("-", " "); }

function RegisteredWidget({ widgetType }: { widgetType: string }) {
  if (widgetType === "connected-wallets") return <ConnectedWallets />;
  if (widgetType === "portfolio-value") return <PortfolioDashboard />;
  if (widgetType === "security-score") return <SecurityCenter />;
  return (
    <div className="rounded-xl bg-primary/[0.03] p-8 text-center">
      <p className="font-semibold capitalize">{widgetType.replaceAll("-", " ")}</p>
      <p className="mt-2 text-sm text-primary/55">This widget is enabled for your AI-generated workspace.</p>
    </div>
  );
}

function SafeComponent({ children }: { children: React.ReactNode }) {
  try {
    return <>{children}</>;
  } catch {
    return <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">Component failed to render.</div>;
  }
}

function GeneratedComponent({ component }: { component: UIComponent }) {
  if (component.type === "widget") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="rounded-2xl border border-primary/10 bg-background/60 p-3"
      >
        <div className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-primary/45">
          {component.title || component.widgetType.replaceAll("-", " ")}
        </div>
        <SafeComponent>
          <RegisteredWidget widgetType={component.widgetType} />
        </SafeComponent>
      </motion.div>
    );
  }

  if (component.type === "text") {
    const emphasis = component.emphasis || "normal";
    return (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={
          emphasis === "strong" ? "text-lg font-bold"
          : emphasis === "muted" ? "text-sm text-primary/60"
          : "text-sm"
        }
      >
        {component.text}
      </motion.p>
    );
  }

  if (component.type === "metric") {
    const source = component.source || "portfolio-value";
    const format = component.format || "number";
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25 }}
        className="rounded-2xl border border-primary/10 bg-background/60 p-5"
      >
        <p className="text-xs font-bold uppercase tracking-wider text-primary/50">{component.label}</p>
        <p className="mt-3 text-sm text-primary/65">Live {source.replaceAll("-", " ")} data</p>
        <p className="mt-1 text-xs text-primary/45">Format: {format}</p>
      </motion.div>
    );
  }

  // Card type — all fields are optional, so use safe defaults
  const tone = component.tone || "neutral";
  const toneClass =
    tone === "success" ? "border-emerald-500/30 bg-emerald-500/10"
    : tone === "warning" || tone === "danger" ? "border-amber-500/30 bg-amber-500/10"
    : tone === "accent" ? "border-primary/30 bg-primary/10"
    : tone === "info" ? "border-cyan-500/30 bg-cyan-500/10"
    : "border-primary/10 bg-background/60";

  const cardText = component.text || component.body || component.content || component.description || "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.25 }}
      className={`rounded-2xl border p-5 ${toneClass}`}
    >
      <p className="font-semibold">{component.title || "AI-generated card"}</p>
      {cardText && <p className="mt-2 text-sm text-primary/65">{cardText}</p>}
    </motion.div>
  );
}

function GeneratedUi({ document }: { document: UIDocument }) {
  const spec = document.spec;
  const components = useMemo(() => spec.components || [], [spec.components]);
  const accent = accentClasses[spec.accentPreset] || accentClasses.cyan;
  const columns = Math.max(1, Math.min(4, spec.columns || 2));

  return (
    <motion.div
      key={`ui-v${document.version}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`rounded-3xl border p-4 sm:p-6 ${accent}`}
      data-ui-version={document.version}
      data-ui-source={document.source}
    >
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary/50">
          AI-generated personal interface · v{document.version}
        </p>
        <h3 className="mt-2 text-xl font-black tracking-tight sm:text-3xl">{spec.title || "AvhiSafe workspace"}</h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-primary/60">{spec.description || "Your AI-generated personal wallet workspace."}</p>
      </div>
      <div
        className={
          spec.layout === "grid"
            ? `grid gap-4 grid-cols-1 ${columns >= 2 ? "sm:grid-cols-2" : ""} ${columns >= 3 ? "lg:grid-cols-3" : ""} ${columns >= 4 ? "xl:grid-cols-4" : ""}`
            : "flex flex-col gap-4"
        }
      >
        <AnimatePresence mode="popLayout">
          {components.map((component) => (
            <GeneratedComponent key={component.id} component={component} />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
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

  const load = async () => {
    setLoading(true);
    setBackendError(null);
    try {
      const data = await loadWorkspace();
      setDashboard(data.dashboard);
      setUiDocument(data.uiDocument);
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : "The AI workspace backend is unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const runPlan = async () => {
    if (!dashboard || !uiDocument) return;
    const requestedPrompt = prompt.trim();
    if (!requestedPrompt) { toast.error("Describe the UI you want the AI to create."); return; }
    setPlanning(true);
    setPlan(null);
    try {
      const result = await planDashboard(dashboard._id, requestedPrompt);
      setPlan(result.plan);
      if (result.plan.intent === "unsupported") {
        toast.info(result.plan.explanation);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI is temporarily unavailable. Please try again.");
    } finally {
      setPlanning(false);
    }
  };

  const applyPlan = async () => {
    if (!dashboard || !plan?.ui || plan.intent !== "customize_ui") return;
    setApplying(true);
    try {
      const result = await applyDashboardPlan(dashboard._id, prompt.trim(), plan);
      setDashboard(result.dashboard);
      setUiDocument(result.uiDocument);
      setPlan(null);
      setPrompt("");
      toast.success("Your AI-generated dashboard is live!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save the AI UI. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  const undo = async () => {
    if (!dashboard) return;
    try {
      const result = await undoDashboardUi(dashboard._id);
      setDashboard(result.dashboard);
      setUiDocument(result.uiDocument);
      setPlan(null);
      toast.success("Previous AI-generated UI restored.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to restore the previous AI UI.");
    }
  };

  const newDashboard = async () => {
    if (!dashboard) return;
    try {
      const result = await createDashboard({ name: "New personal dashboard", slug: `dashboard-${Date.now()}`, theme: dashboard.theme, currency: dashboard.currency, density: dashboard.density, isDefault: false, widgets: [], filters: {} });
      setDashboard(result.dashboard);
      setUiDocument(result.uiDocument);
      setPlan(null);
      toast.success("New personal AI dashboard created.");
    } catch { toast.error("Unable to create a synced dashboard."); }
  };

  if (loading) return (
    <AiWorkspaceLoader />
  );

  if (!dashboard || !uiDocument) return (
    <section className="mt-12 bg-amber-200/[0.05] px-4">
      <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-5 text-amber-600" />AI workspace unavailable</div>
      <p className="mt-2 text-sm text-primary/65">{backendError || "Connect the backend and configure an AI provider."}</p>
      <Button className="mt-4" variant="outline" onClick={() => void load()}>Retry connection</Button>
    </section>
  );

  return (
    <section className="flex flex-col gap-6 rounded-3xl bg-background text-foreground transition-colors duration-200">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary/50">Universal AI workspace</p>
          <h2 className="mt-2 flex items-center gap-3 text-2xl font-black tracking-tight sm:text-4xl"><LayoutDashboard className="size-6 sm:size-8" />{dashboard.name}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={newDashboard}><LayoutDashboard className="size-4" />New dashboard</Button>
          <Button variant="ghost" className="gap-2" onClick={undo}><RotateCcw className="size-4" />Undo AI UI</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-primary/10 bg-primary/[0.03] p-5">
        <div className="flex items-center gap-2 text-sm font-bold"><Sparkles className="size-4 text-primary/60" />Describe the interface you want</div>
        <p className="mt-2 text-xs text-primary/55">Type any request — change themes, reorder widgets, add cards, adjust columns, or describe your ideal dashboard.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PROMPT_SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} onClick={() => setPrompt(suggestion)} className="rounded-full border border-primary/10 px-3 py-1.5 text-xs text-primary/60 transition-colors hover:bg-primary/5 hover:text-primary/80">
              {suggestion}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <Input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runPlan(); }} placeholder="Build a dark risk-focused dashboard with security first, portfolio history, and a compact two-column layout" />
          <Button className="gap-2 md:min-w-32" disabled={planning} onClick={runPlan}>
            {planning ? <><Loader2 className="size-4 animate-spin" />Asking AI…</> : <><Wand2 className="size-4" />Generate UI</>}
          </Button>
        </div>

        {plan && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl bg-background p-4">
            <p className="font-semibold">{plan.explanation}</p>
            <p className="mt-1 text-xs text-primary/50">Source: {plan.source}{plan.model ? ` · ${plan.model}` : ""} · {plan.ui?.components.length || 0} generated components</p>
            {plan.warnings.map((warning) => <p key={warning} className="mt-2 text-sm text-amber-700">{warning}</p>)}
            {plan.ui && <p className="mt-3 text-sm text-primary/65">Preview: &ldquo;{plan.ui.title}&rdquo; with {plan.ui.layout} layout, {plan.ui.columns} column{plan.ui.columns === 1 ? "" : "s"}, and {plan.ui.accentPreset} accent.</p>}
            <div className="mt-4 flex gap-2">
              <Button disabled={applying || !plan.ui || plan.intent !== "customize_ui"} onClick={applyPlan} className="gap-2">
                {applying ? <><Loader2 className="size-4 animate-spin" />Saving AI UI…</> : <><Check className="size-4" />Apply AI UI to my dashboard</>}
              </Button>
              <Button variant="ghost" onClick={() => setPlan(null)}>Cancel</Button>
            </div>
          </motion.div>
        )}
      </div>

      <GeneratedUi document={uiDocument} />
    </section>
  );
}
