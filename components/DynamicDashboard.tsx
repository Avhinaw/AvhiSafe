"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ArrowUpRight, BarChart3, CircleDollarSign, Gauge, LayoutDashboard, RotateCcw, Wand2, Check, AlertTriangle, Loader2, Settings2, ShieldCheck, Sparkles, Wallet, Waves } from "lucide-react";
import { toast } from "sonner";
import ConnectedWallets from "./ConnectedWallets";
import PortfolioDashboard from "./PortfolioDashboard";
import SecurityCenter from "./SecurityCenter";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { applyDashboardPlan, createDashboard, loadDashboard, loadWorkspace, planDashboard, undoDashboardUi, updateDashboard, type Dashboard, type DashboardPlan, type DashboardWidget, type UIComponent, type UIDocument, type UISpec } from "@/lib/dashboardApi";
import { AiWorkspaceLoader } from "./ui/AiWorkspaceLoader";
import { useAuth } from "./AuthProvider";

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

function DashboardKpi({ icon: Icon, label, value, detail, tone }: { icon: typeof Activity; label: string; value: string; detail: string; tone: string }) {
  return <motion.div whileHover={{ y: -3 }} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.07] p-4 text-white backdrop-blur-xl transition-all duration-300 hover:border-white/25 hover:bg-white/[0.12]"><div className={`mb-5 flex size-9 items-center justify-center rounded-xl ${tone}`}><Icon className="size-4" /></div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{label}</p><p className="mt-1 text-xl font-black tracking-tight">{value}</p><p className="mt-1 text-xs text-white/45">{detail}</p><div className="absolute -bottom-8 -right-5 size-20 rounded-full bg-white/10 blur-2xl transition-transform duration-500 group-hover:scale-150" /></motion.div>;
}

function widgetLabel(widget: DashboardWidget) { return widget.title || widget.type.replaceAll("-", " "); }

const widgetMeta: Record<string, { icon: typeof Activity; eyebrow: string; accent: string; value: string; detail: string }> = {
  balances: { icon: Wallet, eyebrow: "Network spread", accent: "text-sky-600 dark:text-sky-300", value: "ETH  ·  SOL", detail: "Native balances" },
  "token-holdings": { icon: CircleDollarSign, eyebrow: "Asset mix", accent: "text-violet-600 dark:text-violet-300", value: "12 assets", detail: "Token holdings" },
  transactions: { icon: Activity, eyebrow: "Live ledger", accent: "text-amber-600 dark:text-amber-300", value: "Recent activity", detail: "Review your latest movements" },
  "portfolio-history": { icon: BarChart3, eyebrow: "Performance", accent: "text-emerald-600 dark:text-emerald-300", value: "Trendline ready", detail: "Historical portfolio value" },
  "risk-summary": { icon: ShieldCheck, eyebrow: "Risk desk", accent: "text-rose-600 dark:text-rose-300", value: "Low exposure", detail: "No urgent review items" },
  "defi-positions": { icon: Waves, eyebrow: "Protocols", accent: "text-cyan-600 dark:text-cyan-300", value: "Coming online", detail: "Staking, lending and liquidity" },
  "nft-gallery": { icon: Sparkles, eyebrow: "Collectibles", accent: "text-fuchsia-600 dark:text-fuchsia-300", value: "Gallery ready", detail: "NFT holdings and metadata" },
};

function InsightWidget({ widgetType }: { widgetType: string }) {
  const meta = widgetMeta[widgetType] || { icon: Gauge, eyebrow: "Workspace signal", accent: "text-primary", value: "Awaiting sync", detail: widgetType.replaceAll("-", " ") };
  const Icon = meta.icon;
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 280, damping: 20 }} className="group relative overflow-hidden rounded-2xl border border-primary/10 bg-background/80 p-5 shadow-sm transition-shadow duration-300 hover:shadow-xl hover:shadow-primary/10">
      <div className="absolute -right-10 -top-10 size-28 rounded-full bg-primary/[0.06] blur-2xl transition-transform duration-500 group-hover:scale-150" />
      <div className="relative flex items-start justify-between gap-3"><div className={`flex size-10 items-center justify-center rounded-xl bg-primary/[0.07] ${meta.accent}`}><Icon className="size-5" /></div><ArrowUpRight className="size-4 text-primary/30 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div>
      <p className="relative mt-5 text-[10px] font-black uppercase tracking-[0.18em] text-primary/45">{meta.eyebrow}</p>
      <p className="relative mt-2 text-xl font-black tracking-tight">{meta.value}</p>
      <p className="relative mt-1 text-sm text-primary/55">{meta.detail}</p>
      <div className="relative mt-5 h-1 overflow-hidden rounded-full bg-primary/10"><motion.div initial={{ width: 0 }} animate={{ width: widgetType === "risk-summary" ? "28%" : "68%" }} transition={{ delay: 0.25, duration: 0.8 }} className={`h-full rounded-full bg-current ${meta.accent}`} /></div>
    </motion.div>
  );
}

function RegisteredWidget({ widgetType }: { widgetType: string }) {
  if (widgetType === "connected-wallets") return <ConnectedWallets />;
  if (widgetType === "portfolio-value") return <PortfolioDashboard />;
  if (widgetType === "security-score") return <SecurityCenter />;
  return <InsightWidget widgetType={widgetType} />;
}

function SafeComponent({ children }: { children: React.ReactNode }) {
  try {
    return <>{children}</>;
  } catch {
    return <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">Component failed to render.</div>;
  }
}

// Shared layout guards applied to every generated component:
// - min-w-0 + overflow-hidden: stop intrinsic-width children (charts, long strings)
//   from bursting out of their CSS-column and visually overlapping the next item
// - break-inside-avoid: stop a single card from being split top/bottom across columns
// - block + w-full + mb-4: MUST be `block` not `inline-block` — inline-block margins
//   don't reliably reserve vertical space in a multi-column layout, which is what
//   was causing cards to render flush against each other with no gap
const ITEM_WRAP_CLASS = "min-w-0 overflow-hidden break-inside-avoid block w-full mb-4";

function GeneratedComponent({ component }: { component: UIComponent }) {
  if (component.type === "widget") {
    // No border/bg on this wrapper — ConnectedWallets / PortfolioDashboard /
    // SecurityCenter already render their own card chrome internally.
    // Adding border+bg here nests a card inside a card (visible double-border bug).
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={`${ITEM_WRAP_CLASS} transition-transform duration-300 hover:translate-y-[-2px]`}
      >
        <div className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-primary/45">
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
          (emphasis === "strong" ? "text-lg font-bold"
          : emphasis === "muted" ? "text-sm text-primary/60"
          : "text-sm") + ` ${ITEM_WRAP_CLASS}`
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
        className={`rounded-2xl border border-primary/10 bg-background/60 p-5 ${ITEM_WRAP_CLASS}`}
      >
        <p className="text-xs font-bold uppercase tracking-wider text-primary/50">{component.label}</p>
        <p className="mt-3 text-sm text-primary/65">{source.replaceAll("-", " ")}</p>
        <p className="mt-1 text-xs text-primary/45">Format: {format}</p>
      </motion.div>
    );
  }

  // Card type — keeps its own border/bg since it has no inner widget chrome to clash with.
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
      className={`rounded-2xl border p-5 ${toneClass} ${ITEM_WRAP_CLASS}`}
    >
      {component.title && <p className="font-semibold">{component.title}</p>}
      {cardText && <p className="mt-2 text-sm text-primary/65">{cardText}</p>}
    </motion.div>
  );
}

function GeneratedUi({ document, density }: { document: UIDocument; density: Dashboard["density"] }) {
  const spec = document.spec;
  const components = useMemo(() => {
    const base = spec.components || [];
    if (density !== "analytics" || base.length >= 6) return base;
    const existing = new Set(base.filter((item) => item.type === "widget").map((item) => item.widgetType));
    const extras: UIComponent[] = ["balances", "token-holdings", "transactions", "portfolio-history", "risk-summary"].filter((widgetType) => !existing.has(widgetType)).map((widgetType) => ({ type: "widget", id: `analytics-${widgetType}`, widgetType, title: widgetType.replaceAll("-", " "), width: "medium" }));
    return [...base, ...extras].slice(0, 9);
  }, [density, spec.components]);
  const accent = accentClasses[spec.accentPreset] || accentClasses.cyan;
  const columns = density === "analytics" ? Math.max(2, Math.min(4, Number(spec.columns) || 3)) : Math.max(1, Math.min(4, Number(spec.columns) || 2));

  // Masonry via CSS multi-column layout instead of CSS grid.
  // Grid advances every column in lockstep row-by-row, so a tall widget in
  // col 1 leaves a permanent dead zone next to a short widget in col 2.
  // CSS columns flow each item into whichever column is currently shortest,
  // closing that gap automatically without hardcoding row/col spans per widget.
  const columnStyle =
    spec.layout === "grid"
      ? ({
          columnCount: columns,
          columnGap: "1rem",
        } as React.CSSProperties)
      : undefined;

  return (
    <motion.div
      key={`ui-v${document.version}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`relative overflow-hidden rounded-[2rem] border p-4 shadow-[0_18px_70px_-35px_rgba(15,23,42,0.45)] sm:p-6 ${accent} ${density === "analytics" ? "bg-gradient-to-br from-background via-background to-primary/[0.04]" : ""}`}
      data-ui-version={document.version}
      data-ui-source={document.source}
    >
      <div className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-primary/45">{density === "analytics" ? "Analytics desk" : "Personal workspace"}</p><h3 className="text-xl font-black tracking-tight sm:text-3xl">{spec.title || "Workspace"}</h3></div><div className="flex items-center gap-2 text-xs font-semibold text-primary/45"><span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />Live workspace</div></div>
        {spec.description && <p className="mt-2 max-w-2xl text-sm leading-6 text-primary/60">{spec.description}</p>}
      </div>

      {spec.layout === "grid" ? (
        <div style={columnStyle}>
          <AnimatePresence mode="popLayout">
            {components.map((component) => (
              <GeneratedComponent key={component.id} component={component} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <AnimatePresence mode="popLayout">
            {components.map((component) => (
              <GeneratedComponent key={component.id} component={component} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

export default function DynamicDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
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
      setDashboards(data.dashboards);
      setUiDocument(data.uiDocument);
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : "Couldn't reach the workspace backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) void load(); else setLoading(false); }, [user]);

  const selectDashboard = async (id: string) => {
    if (!id || id === dashboard?._id) return;
    try {
      const result = await loadDashboard(id);
      setDashboard(result.dashboard);
      setUiDocument(result.uiDocument);
      setPlan(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't load that dashboard."); }
  };

  const saveDashboardSetting = async (patch: Partial<Dashboard>) => {
    if (!dashboard) return;
    try {
      const result = await updateDashboard(dashboard._id, { ...patch, revisionSummary: "Updated dashboard settings" });
      setDashboard(result.dashboard);
      setDashboards((items) => items.map((item) => item._id === result.dashboard._id ? result.dashboard : item));
      toast.success("Dashboard settings saved.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't save dashboard settings."); }
  };

  const runPlan = async () => {
    if (!dashboard || !uiDocument) return;
    const requestedPrompt = prompt.trim();
    if (!requestedPrompt) { toast.error("Describe the layout you want first."); return; }
    setPlanning(true);
    setPlan(null);
    try {
      const result = await planDashboard(dashboard._id, requestedPrompt);
      setPlan(result.plan);
      if (result.plan.intent === "unsupported") {
        toast.info(result.plan.explanation);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generation failed. Try again.");
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
      toast.success("Dashboard updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the layout.");
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
      toast.success("Previous layout restored.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't restore the previous layout.");
    }
  };

  const newDashboard = async () => {
    if (!dashboard) return;
    try {
      const result = await createDashboard({ name: "New dashboard", slug: `dashboard-${Date.now()}`, theme: dashboard.theme, currency: dashboard.currency, density: dashboard.density, isDefault: false, widgets: [], filters: {} });
      setDashboard(result.dashboard);
      setDashboards((items) => [...items, result.dashboard]);
      setUiDocument(result.uiDocument);
      setPlan(null);
      toast.success("New dashboard created.");
    } catch { toast.error("Couldn't create a new dashboard."); }
  };

  if (authLoading || loading) return (
    <AiWorkspaceLoader />
  );

  if (!user) return (
    <section className="rounded-[2rem] border border-primary/10 bg-gradient-to-br from-primary/[0.06] to-background p-8 text-center shadow-sm sm:p-12">
      <ShieldCheck className="mx-auto size-10 text-primary/60" />
      <h2 className="mt-4 text-2xl font-black tracking-tight">Sign in to open your analytics desk</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-primary/60">Connect an EVM or Solana wallet from the top bar. Your dashboards, generated public-wallet records, layouts, and portfolio history are scoped to that account.</p>
    </section>
  );

  if (!dashboard || !uiDocument) return (
    <section className="mt-12 bg-amber-200/[0.05] px-4">
      <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-5 text-amber-600" />Workspace unavailable</div>
      <p className="mt-2 text-sm text-primary/65">{backendError || "Connect the backend to load your workspace."}</p>
      <Button className="mt-4" variant="outline" onClick={() => void load()}>Retry</Button>
    </section>
  );

  const activeWidgetCount = dashboard.widgets.filter((widget) => widget.enabled).length;
  return (
    <section className="relative flex flex-col gap-7 overflow-hidden rounded-[2.5rem] bg-[#0b1220] p-3 text-white shadow-2xl shadow-slate-950/20 transition-colors duration-200 sm:p-5">
      <div className="pointer-events-none absolute -left-32 -top-40 size-[30rem] rounded-full bg-cyan-500/10 blur-3xl" /><div className="pointer-events-none absolute -bottom-48 -right-20 size-[28rem] rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-900 via-[#101b30] to-[#0c1526] p-5 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-cyan-300/70"><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />AvhiSafe command center <span className="text-white/25">/</span> {user.role || "user"} access</div><h2 className="flex items-center gap-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl"><LayoutDashboard className="size-7 text-cyan-300 sm:size-9" />{dashboard.name}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/55">A private, read-only intelligence desk for your wallets, risk posture, and on-chain activity.</p></div>
          <div className="flex flex-wrap gap-2">
          <select value={dashboard._id} onChange={(event) => void selectDashboard(event.target.value)} className="h-10 rounded-md border border-white/15 bg-white/10 px-3 text-sm text-white outline-none">
            {dashboards.map((item) => <option key={item._id} value={item._id}>{item.name}{item.isDefault ? " · Default" : ""}</option>)}
          </select>
          <Button variant="outline" className="gap-2 border-white/15 bg-white/5 text-white hover:bg-white/15" onClick={newDashboard}><LayoutDashboard className="size-4" />New dashboard</Button>
          <Button variant="ghost" className="gap-2 text-white/70 hover:bg-white/10 hover:text-white" onClick={undo}><RotateCcw className="size-4" />Undo</Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3"><DashboardKpi icon={CircleDollarSign} label="Portfolio pulse" value="Read-only" detail="Provider data protected" tone="bg-cyan-400/15 text-cyan-200" /><DashboardKpi icon={Wallet} label="Tracked surface" value={`${activeWidgetCount} widgets`} detail="Across your workspace" tone="bg-violet-400/15 text-violet-200" /><DashboardKpi icon={ShieldCheck} label="Account posture" value="Protected" detail={`${dashboard.density} analytics mode`} tone="bg-emerald-400/15 text-emerald-200" /></div>
      </div>

      <div className="relative flex flex-col gap-3 rounded-[2rem] border border-primary/10 bg-background p-4 text-foreground shadow-xl shadow-black/5 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Settings2 className="size-4" /></div><div><p className="text-sm font-black">Workspace controls</p><p className="text-xs text-primary/50">Tune the desk without leaving your account.</p></div></div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Dashboard theme" value={dashboard.theme} onChange={(event) => void saveDashboardSetting({ theme: event.target.value as Dashboard["theme"] })} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="system">System theme</option><option value="light">Light theme</option><option value="dark">Dark theme</option></select>
          <select aria-label="Dashboard density" value={dashboard.density} onChange={(event) => void saveDashboardSetting({ density: event.target.value as Dashboard["density"] })} className="h-9 rounded-md border border-input bg-background px-2 text-sm"><option value="comfortable">Comfortable</option><option value="compact">Compact</option><option value="analytics">Analytics</option></select>
          <Input aria-label="Dashboard name" defaultValue={dashboard.name} key={dashboard._id + dashboard.name} onBlur={(event) => { const name = event.target.value.trim(); if (name && name !== dashboard.name) void saveDashboardSetting({ name }); }} className="h-9 w-44" />
        </div>
      </div>

      <div className="relative rounded-[2rem] border border-primary/10 bg-background p-5 text-foreground shadow-xl shadow-black/5 sm:p-6">
        <div className="text-sm font-bold">Describe the layout you want</div>
        <p className="mt-2 text-xs text-primary/55">Change the theme, reorder widgets, or adjust columns.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {PROMPT_SUGGESTIONS.map((suggestion) => (
            <button key={suggestion} onClick={() => setPrompt(suggestion)} className="rounded-full border border-primary/10 px-3 py-1.5 text-xs text-primary/60 transition-colors hover:bg-primary/5 hover:text-primary/80">
              {suggestion}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-3 md:flex-row">
          <Input value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void runPlan(); }} placeholder="e.g. dark risk-focused layout, security first, two columns" />
          <Button className="gap-2 md:min-w-32" disabled={planning} onClick={runPlan}>
            {planning ? <><Loader2 className="size-4 animate-spin" />Generating…</> : <><Wand2 className="size-4" />Generate</>}
          </Button>
        </div>

        {plan && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl bg-background p-4">
            <p className="font-semibold">{plan.explanation}</p>
            {plan.warnings.map((warning) => <p key={warning} className="mt-2 text-sm text-amber-700">{warning}</p>)}
            {plan.ui && <p className="mt-3 text-sm text-primary/65">&ldquo;{plan.ui.title}&rdquo; — {plan.ui.layout}, {plan.ui.columns} column{plan.ui.columns === 1 ? "" : "s"}, {plan.ui.accentPreset} accent.</p>}
            <div className="mt-4 flex gap-2">
              <Button disabled={applying || !plan.ui || plan.intent !== "customize_ui"} onClick={applyPlan} className="gap-2">
                {applying ? <><Loader2 className="size-4 animate-spin" />Saving…</> : <><Check className="size-4" />Apply</>}
              </Button>
              <Button variant="ghost" onClick={() => setPlan(null)}>Cancel</Button>
            </div>
          </motion.div>
        )}
      </div>

      <GeneratedUi document={uiDocument} density={dashboard.density} />
    </section>
  );
}
