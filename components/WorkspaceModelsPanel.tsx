"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Bell, Clock3, Layers3, Loader2, Save, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  applyDashboardTemplate, loadActivity, loadAiUsage, loadDashboardPreference, loadIntegrationRecords,
  loadModelCatalog, listNotifications, loadSecurityData, loadSessions, loadAuditLog, loadUserPreferences,
  loadFeaturePermissions, markAllNotificationsRead,
  runBaselineScan, saveDashboardPreference, saveDashboardTemplate, updateNotification,
  saveUserPreferences, updateFeaturePermission, revokeSession, updateSecurityAlert,
  type ActivityData, type AiEdit, type AiUsage, type AuditEntry, type DashboardPreference,
  type DashboardTemplate, type NetworkDefinition, type SecurityAlert, type SecurityCheck,
  type SecurityScan, type UserNotification, type UserPreferences, type UserSession, type WidgetDefinition,
} from "@/lib/modelApi";
import type { Dashboard, UIDocument } from "@/lib/dashboardApi";

type Props = {
  dashboard: Dashboard;
  onTemplateApplied: (dashboard: Dashboard, uiDocument: UIDocument) => void;
};

const cardClass = "rounded-2xl border border-primary/10 bg-background p-5 shadow-sm";

export default function WorkspaceModelsPanel({ dashboard, onTemplateApplied }: Props) {
  const { setTheme } = useTheme();
  const [widgets, setWidgets] = useState<WidgetDefinition[]>([]);
  const [networks, setNetworks] = useState<NetworkDefinition[]>([]);
  const [templates, setTemplates] = useState<DashboardTemplate[]>([]);
  const [preference, setPreference] = useState<DashboardPreference | null>(null);
  const [profilePreferences, setProfilePreferences] = useState<UserPreferences | null>(null);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [scanPermission, setScanPermission] = useState(true);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [scans, setScans] = useState<SecurityScan[]>([]);
  const [checks, setChecks] = useState<SecurityCheck[]>([]);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [usage, setUsage] = useState<AiUsage[]>([]);
  const [edits, setEdits] = useState<AiEdit[]>([]);
  const [integrationMessage, setIntegrationMessage] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalog, pref, inbox, security, recentActivity, ai, integrations, profile, activeSessions, audit, permissions] = await Promise.all([
        loadModelCatalog(),
        loadDashboardPreference(dashboard._id),
        listNotifications(),
        loadSecurityData(),
        loadActivity(),
        loadAiUsage(),
        loadIntegrationRecords(),
        loadUserPreferences(),
        loadSessions(),
        loadAuditLog(),
        loadFeaturePermissions(),
      ]);
      setWidgets(catalog.widgets);
      setNetworks(catalog.networks);
      setTemplates(catalog.templates);
      setPreference(pref.preference);
      setProfilePreferences(profile.preferences);
      setSessions(activeSessions.sessions);
      setAuditLogs(audit.logs);
      setScanPermission(permissions.permissions.find((permission) => permission.featureKey === "security.baseline_scan")?.enabled ?? true);
      setNotifications(inbox.notifications);
      setScans(security.scans);
      setChecks(security.checks);
      setAlerts(security.alerts);
      setActivity(recentActivity);
      setUsage(ai.usage);
      setEdits(ai.edits);
      setIntegrationMessage(integrations.message);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load model-backed workspace data.");
    } finally {
      setLoading(false);
    }
  }, [dashboard._id]);

  useEffect(() => { void reload(); }, [reload]);

  const runScan = async () => {
    setBusy("scan");
    try {
      const result = await runBaselineScan();
      toast.success(`Baseline checks complete: ${result.checks.length} checks, ${result.alerts.length} alerts.`);
      await reload();
    } catch (scanError) {
      toast.error(scanError instanceof Error ? scanError.message : "Unable to run wallet checks.");
    } finally {
      setBusy(null);
    }
  };

  const updatePreference = async (input: Partial<DashboardPreference>) => {
    setBusy("preferences");
    try {
      const result = await saveDashboardPreference(dashboard._id, input);
      setPreference(result.preference);
      window.dispatchEvent(new CustomEvent("avhisafe:dashboard-preference-updated", {
        detail: { dashboardId: dashboard._id, refreshIntervalSeconds: result.preference.refreshIntervalSeconds || 300 },
      }));
      toast.success("Workspace preferences saved.");
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Unable to save preferences.");
    } finally {
      setBusy(null);
    }
  };

  const applyTemplate = async (template: DashboardTemplate) => {
    setBusy(template._id);
    try {
      const result = await applyDashboardTemplate(template._id, dashboard._id);
      onTemplateApplied(result.dashboard, result.uiDocument);
      toast.success(`${template.name} applied.`);
      await reload();
    } catch (applyError) {
      toast.error(applyError instanceof Error ? applyError.message : "Unable to apply dashboard template.");
    } finally {
      setBusy(null);
    }
  };

  const saveTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      toast.error("Enter a name for this template.");
      return;
    }
    setBusy("template-save");
    try {
      await saveDashboardTemplate({ dashboardId: dashboard._id, name });
      setTemplateName("");
      toast.success("Dashboard template saved to your account.");
      await reload();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : "Unable to save template.");
    } finally {
      setBusy(null);
    }
  };

  const setNotificationStatus = async (notificationId: string, status: "read" | "archived") => {
    try {
      await updateNotification(notificationId, status);
      setNotifications((items) => status === "archived" ? items.filter((item) => item._id !== notificationId) : items.map((item) => item._id === notificationId ? { ...item, status } : item));
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "Unable to update notification.");
    }
  };

  const markAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((items) => items.map((item) => item.status === "unread" ? { ...item, status: "read" } : item));
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "Unable to mark notifications read.");
    }
  };

  const updateAlert = async (alertId: string, status: "acknowledged" | "resolved" | "dismissed") => {
    try {
      await updateSecurityAlert(alertId, status);
      setAlerts((items) => items.filter((item) => item._id !== alertId));
    } catch (updateError) {
      toast.error(updateError instanceof Error ? updateError.message : "Unable to update alert.");
    }
  };

  const changeScanPermission = async (enabled: boolean) => {
    try {
      await updateFeaturePermission("security.baseline_scan", enabled);
      setScanPermission(enabled);
      toast.success(enabled ? "Baseline wallet checks enabled." : "Baseline wallet checks disabled.");
    } catch (permissionError) {
      toast.error(permissionError instanceof Error ? permissionError.message : "Unable to update feature permissions.");
    }
  };

  const changeProfilePreference = async (input: Partial<UserPreferences>) => {
    try {
      const result = await saveUserPreferences(input);
      setProfilePreferences((current) => ({ ...current, ...result.preferences }));
      if (input.theme) setTheme(input.theme);
      toast.success("Account preferences saved.");
    } catch (preferenceError) {
      toast.error(preferenceError instanceof Error ? preferenceError.message : "Unable to save account preferences.");
    }
  };

  const closeSession = async (session: UserSession) => {
    try {
      await revokeSession(session._id);
      setSessions((items) => items.map((item) => item._id === session._id ? { ...item, status: "revoked" } : item));
      toast.success("Session revoked.");
    } catch (sessionError) {
      toast.error(sessionError instanceof Error ? sessionError.message : "Unable to revoke session.");
    }
  };

  const today = new Date();
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString();
  const latestUsage = usage.find((item) => new Date(item.periodStart).toISOString() === todayStart);
  const unreadCount = notifications.filter((item) => item.status === "unread").length;
  const successfulSyncs = activity?.walletSyncs.filter((sync) => sync.status === "success").length || 0;
  const latestScan = scans[0];

  return (
    <section className="relative rounded-[2rem] border border-primary/10 bg-background p-4 text-foreground shadow-xl shadow-black/5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary/45">Connected data models</p>
          <h3 className="mt-1 text-2xl font-black tracking-tight">Workspace systems</h3>
          <p className="mt-1 text-sm text-primary/55">Manage persisted portfolio, security, dashboard, and AI records.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => void reload()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Activity className="size-4" />}Refresh data
        </Button>
      </div>

      {error && <div role="alert" className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      {loading && !activity ? <div className="mt-5 flex items-center gap-2 text-sm text-primary/55"><Loader2 className="size-4 animate-spin" />Loading account data…</div> : (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <div><h4 className="flex items-center gap-2 font-bold"><ShieldCheck className="size-4 text-emerald-600" />Wallet security checks</h4><p className="mt-1 text-xs text-primary/50">Validates stored wallet address and network metadata only.</p></div>
              <Button size="sm" onClick={() => void runScan()} disabled={busy === "scan" || !scanPermission}>{busy === "scan" ? <Loader2 className="size-4 animate-spin" /> : "Run checks"}</Button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-primary/55">
              <input type="checkbox" checked={scanPermission} onChange={(event) => void changeScanPermission(event.target.checked)} />
              Allow baseline wallet-metadata checks
            </label>
            {latestScan && <p className="mt-3 text-xs text-primary/55">Latest run: {new Date(latestScan.createdAt).toLocaleString()} · {latestScan.checksRun} checks · {latestScan.alertsCreated} alerts</p>}
            <div className="mt-3 space-y-2">
              {checks.slice(0, 4).map((check) => (
                <div key={check._id} className="rounded-xl bg-primary/[0.03] p-3">
                  <p className="text-sm font-semibold">{check.title}<span className={`ml-2 text-xs uppercase ${check.result === "pass" ? "text-emerald-600" : check.result === "fail" ? "text-destructive" : "text-amber-600"}`}>{check.result}</span></p>
                  <p className="mt-1 text-xs text-primary/55">{check.explanation}</p>
                </div>
              ))}
              {!checks.length && <p className="text-sm text-primary/50">No checks yet. Run a baseline check to inspect registered wallet metadata.</p>}
            </div>
            <p className="mt-3 text-[11px] leading-5 text-amber-700">This does not scan contracts, transactions, approvals, or phishing risks.</p>
            {alerts.map((alert) => (
              <div key={alert._id} className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-sm font-semibold">{alert.title} <span className="text-xs uppercase text-amber-700">{alert.severity}</span></p>
                <p className="mt-1 text-xs text-primary/60">{alert.explanation}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void updateAlert(alert._id, "acknowledged")}>Acknowledge</Button>
                  <Button size="sm" variant="ghost" onClick={() => void updateAlert(alert._id, "dismissed")}>Dismiss</Button>
                </div>
              </div>
            ))}
          </div>

          <div className={cardClass}>
            <div className="flex items-center justify-between gap-3">
              <h4 className="flex items-center gap-2 font-bold"><Bell className="size-4 text-amber-600" />Notifications <span className="rounded-full bg-primary/5 px-2 py-0.5 text-xs">{unreadCount} unread</span></h4>
              {unreadCount > 0 && <Button size="sm" variant="ghost" onClick={() => void markAllRead()}>Mark all read</Button>}
            </div>
            <div className="mt-3 max-h-72 space-y-2 overflow-auto">
              {notifications.slice(0, 12).map((notification) => (
                <div key={notification._id} className={`rounded-xl p-3 ${notification.status === "unread" ? "bg-primary/[0.06]" : "bg-primary/[0.025]"}`}>
                  <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{notification.title}</p><span className="shrink-0 text-[10px] uppercase text-primary/45">{notification.type}</span></div>
                  <p className="mt-1 text-xs leading-5 text-primary/60">{notification.body}</p>
                  <div className="mt-2 flex gap-2">
                    {notification.status === "unread" && <button className="text-xs font-semibold text-primary/65 hover:text-primary" onClick={() => void setNotificationStatus(notification._id, "read")}>Mark read</button>}
                    <button className="text-xs font-semibold text-primary/45 hover:text-primary" onClick={() => void setNotificationStatus(notification._id, "archived")}>Archive</button>
                  </div>
                </div>
              ))}
              {!notifications.length && <p className="text-sm text-primary/50">You’re all caught up.</p>}
            </div>
          </div>

          <div className={cardClass}>
            <div className="flex items-center gap-2"><Layers3 className="size-4 text-violet-600" /><h4 className="font-bold">Dashboard templates</h4></div>
            <p className="mt-1 text-xs text-primary/50">Apply a saved layout to this dashboard, or save its current widget setup.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {templates.map((template) => (
                <div key={template._id} className="rounded-xl border border-primary/10 p-3">
                  <p className="text-sm font-semibold">{template.name}</p>
                  <p className="mt-1 min-h-8 text-xs text-primary/55">{template.description || `${template.widgets.length} widgets · ${template.category || "custom"}`}</p>
                  <Button size="sm" variant="outline" className="mt-2 w-full" disabled={busy === template._id} onClick={() => void applyTemplate(template)}>
                    {busy === template._id ? <Loader2 className="size-4 animate-spin" /> : "Apply template"}
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input aria-label="Template name" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Save current dashboard as…" maxLength={100} />
              <Button variant="outline" className="gap-2" disabled={busy === "template-save"} onClick={() => void saveTemplate()}><Save className="size-4" />Save</Button>
            </div>
          </div>

          <div className={cardClass}>
            <h4 className="flex items-center gap-2 font-bold"><Clock3 className="size-4 text-cyan-600" />Refresh preferences</h4>
            <p className="mt-1 text-xs text-primary/50">These settings are stored per dashboard.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-primary/60">Portfolio refresh cadence
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                  value={preference?.refreshIntervalSeconds || 300}
                  disabled={busy === "preferences"}
                  onChange={(event) => void updatePreference({ refreshIntervalSeconds: Number(event.target.value) })}
                >
                  <option value="30">30 seconds</option><option value="60">1 minute</option><option value="300">5 minutes</option><option value="900">15 minutes</option><option value="3600">1 hour</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-primary/60">Account theme
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                  value={profilePreferences?.theme || "system"}
                  onChange={(event) => void changeProfilePreference({ theme: event.target.value as UserPreferences["theme"] })}
                >
                  <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-primary/60">
              {["security", "sync", "portfolio", "system"].map((kind) => (
                <label key={kind} className="flex items-center gap-1.5 capitalize">
                  <input
                    type="checkbox"
                    checked={profilePreferences?.notifications?.[kind] !== false}
                    onChange={(event) => void changeProfilePreference({ notifications: { ...(profilePreferences?.notifications || {}), [kind]: event.target.checked } })}
                  />
                  {kind} notifications
                </label>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-primary/[0.04] p-3"><p className="text-xl font-black">{activity?.snapshots.length || 0}</p><p className="text-[10px] text-primary/50">Asset snapshots</p></div>
              <div className="rounded-xl bg-primary/[0.04] p-3"><p className="text-xl font-black">{activity?.tokenBalances.length || 0}</p><p className="text-[10px] text-primary/50">Token balances</p></div>
              <div className="rounded-xl bg-primary/[0.04] p-3"><p className="text-xl font-black">{successfulSyncs}</p><p className="text-[10px] text-primary/50">Successful syncs</p></div>
            </div>
            <p className="mt-2 text-xs text-primary/50">{activity?.transactions.length || 0} recent transactions · {activity?.assets.length || 0} asset records · {activity?.assetPrices.length || 0} price observations</p>
          </div>

          <div className={cardClass}>
            <h4 className="flex items-center gap-2 font-bold"><Sparkles className="size-4 text-fuchsia-600" />AI usage & edit history</h4>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-primary/[0.04] p-3"><p className="text-xl font-black">{latestUsage?.requestCount || 0}</p><p className="text-[10px] text-primary/50">Requests today</p></div>
              <div className="rounded-xl bg-primary/[0.04] p-3"><p className="text-xl font-black">{latestUsage?.successfulRequestCount || 0}</p><p className="text-[10px] text-primary/50">Plans ready</p></div>
              <div className="rounded-xl bg-primary/[0.04] p-3"><p className="text-xl font-black">{latestUsage?.failedRequestCount || 0}</p><p className="text-[10px] text-primary/50">Other outcomes</p></div>
            </div>
            {latestUsage?.model && <p className="mt-3 text-xs text-primary/55">Model: {latestUsage.model} · Token/cost usage is reported only when available from the provider.</p>}
            <div className="mt-3 space-y-2">
              {edits.slice(0, 3).map((edit) => <div key={edit._id} className="rounded-xl bg-primary/[0.03] p-3"><div className="flex justify-between gap-2"><p className="line-clamp-1 text-sm font-semibold">{edit.prompt}</p><span className="shrink-0 text-[10px] uppercase text-primary/45">{edit.status}</span></div><p className="mt-1 text-xs text-primary/55">{edit.outputSummary}</p></div>)}
              {!edits.length && <p className="text-sm text-primary/50">AI edits will appear here after you generate a dashboard plan.</p>}
            </div>
          </div>

          <div className={cardClass}>
            <h4 className="flex items-center gap-2 font-bold"><ShieldCheck className="size-4 text-indigo-600" />Account sessions</h4>
            <p className="mt-1 text-xs text-primary/50">Revoke sessions you no longer recognize. Session tokens are never shown.</p>
            <div className="mt-3 space-y-2">
              {sessions.filter((session) => session.status === "active").map((session) => (
                <div key={session._id} className="flex items-center justify-between gap-3 rounded-xl bg-primary/[0.03] p-3">
                  <div><p className="text-sm font-semibold">{session.deviceLabel || (session.isCurrent ? "This session" : "Wallet sign-in session")}{session.isCurrent ? " · current" : ""}</p><p className="text-xs text-primary/50">Expires {new Date(session.expiresAt).toLocaleDateString()}</p></div>
                  {!session.isCurrent && <Button size="sm" variant="outline" onClick={() => void closeSession(session)}>Revoke</Button>}
                </div>
              ))}
              {!sessions.some((session) => session.status === "active") && <p className="text-sm text-primary/50">No active sessions found.</p>}
            </div>
          </div>

          <div className={cardClass}>
            <h4 className="flex items-center gap-2 font-bold"><Activity className="size-4 text-slate-600" />Recent account changes</h4>
            <p className="mt-1 text-xs text-primary/50">Security-relevant changes and workspace actions.</p>
            <div className="mt-3 space-y-2">
              {auditLogs.slice(0, 6).map((entry) => <div key={entry._id} className="flex items-center justify-between gap-3 rounded-xl bg-primary/[0.03] p-3"><div><p className="text-sm font-semibold">{entry.action.replaceAll("_", " ")}</p><p className="text-xs text-primary/50">{entry.resourceType}{entry.resourceId ? ` · ${entry.resourceId.slice(0, 10)}` : ""}</p></div><time className="shrink-0 text-[10px] text-primary/45">{new Date(entry.createdAt).toLocaleDateString()}</time></div>)}
              {!auditLogs.length && <p className="text-sm text-primary/50">Account activity will appear here as you use the workspace.</p>}
            </div>
          </div>

          <div className={cardClass}>
            <h4 className="flex items-center gap-2 font-bold"><Activity className="size-4 text-sky-600" />Model registry</h4>
            <p className="mt-1 text-xs text-primary/50">Available renderers, networks, and external adapter status.</p>
            <p className="mt-3 text-sm"><strong>{widgets.length}</strong> widget definitions · <strong>{networks.length}</strong> enabled networks</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {networks.map((network) => <span key={network._id} className="rounded-full bg-primary/[0.05] px-3 py-1 text-xs">{network.name} · {network.environment}</span>)}
            </div>
            <p className="mt-3 text-xs leading-5 text-primary/55">{integrationMessage || "External integrations are not enabled."}</p>
          </div>

          {busy === "preferences" && <span className="sr-only" aria-live="polite">Saving preferences</span>}
        </div>
      )}
    </section>
  );
}
