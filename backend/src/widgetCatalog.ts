import type { DashboardWidget, WidgetWidth } from "./models/index.js";

export const widgetCatalog = [
  { type: "portfolio-value", label: "Portfolio value", description: "Total estimated portfolio value", defaultWidth: "large" as WidgetWidth },
  { type: "balances", label: "Native balances", description: "Ethereum and Solana native balances", defaultWidth: "medium" as WidgetWidth },
  { type: "token-holdings", label: "Token holdings", description: "Searchable token positions", defaultWidth: "large" as WidgetWidth },
  { type: "transactions", label: "Recent activity", description: "Recent on-chain transactions", defaultWidth: "medium" as WidgetWidth },
  { type: "portfolio-history", label: "Portfolio history", description: "Historical estimated-value snapshots", defaultWidth: "large" as WidgetWidth },
  { type: "connected-wallets", label: "Connected wallets", description: "Read-only wallet-provider connections", defaultWidth: "medium" as WidgetWidth },
  { type: "security-score", label: "Security score", description: "Wallet and permissions safety summary", defaultWidth: "medium" as WidgetWidth },
  { type: "nft-gallery", label: "NFT gallery", description: "NFT holdings and collection metadata", defaultWidth: "large" as WidgetWidth },
  { type: "defi-positions", label: "DeFi positions", description: "Staking, lending, and liquidity positions", defaultWidth: "large" as WidgetWidth },
  { type: "risk-summary", label: "Risk summary", description: "Risk flags and review items", defaultWidth: "medium" as WidgetWidth },
] as const;

export type WidgetType = (typeof widgetCatalog)[number]["type"];
export const allowedWidgetTypes = new Set<string>(widgetCatalog.map((widget) => widget.type));

export type DashboardOperation =
  | { type: "enable_widget"; widgetType: string; title?: string; width?: WidgetWidth }
  | { type: "disable_widget"; widgetType: string }
  | { type: "move_widget"; widgetType: string; position: number }
  | { type: "resize_widget"; widgetType: string; width: WidgetWidth }
  | { type: "set_theme"; value: "light" | "dark" | "system" }
  | { type: "set_currency"; value: string }
  | { type: "set_density"; value: "comfortable" | "compact" | "analytics" }
  | { type: "set_filter"; key: string; value: unknown };

export interface DashboardPlan {
  intent: "customize_dashboard" | "unsupported";
  explanation: string;
  operations: DashboardOperation[];
  warnings: string[];
  requiresApproval: boolean;
}

export function defaultWidgets(): DashboardWidget[] {
  return widgetCatalog.slice(0, 6).map((widget, position) => ({
    id: `${widget.type}-default`, type: widget.type, title: widget.label, enabled: true, position, width: widget.defaultWidth, config: {},
  }));
}
