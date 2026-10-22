export type Side = "long" | "short";
export type Market = "futures" | "forex" | "stocks" | "crypto";
export type AccountId = "ibkr" | "ftmo" | "apex" | "topstep";
export type ViewMode = "dollar" | "percent" | "r" | "privacy";
export type RangeKey = "month" | "30d" | "90d" | "ytd" | "all" | "custom";
export type PlanId = "essential" | "pro" | "ultra";

export interface Account {
  id: AccountId;
  name: string;
  broker: string;
  kind: "live" | "prop";
  balance0: number;
  firm?: string;
  rules?: PropRules;
}

export interface PropRules {
  profitTarget: number;
  dailyLoss: number;
  maxLoss: number;
  trailing: boolean;
  minDays: number;
  consistency?: number;
  note: string;
}

export interface Execution {
  time: string;
  price: number;
  qty: number;
  action: "buy" | "sell";
  kind: "entry" | "exit" | "partial";
}

export interface Trade {
  id: string;
  accountId: AccountId;
  symbol: string;
  market: Market;
  side: Side;
  qty: number;
  entry: number;
  exit: number;
  stop: number;
  target: number;
  openedAt: string;
  closedAt: string;
  pnl: number;
  fees: number;
  rMultiple: number;
  mae: number;
  mfe: number;
  playbookId: string;
  emotion: string;
  mistakes: string[];
  tags: string[];
  notes: string;
  rating: number;
  reviewed: boolean;
  session: string;
  executions: Execution[];
  rulesHit: number;
  rulesTotal: number;
  source: "sync" | "csv" | "manual" | "backtest";
}

export interface OpenPosition {
  id: string;
  accountId: AccountId;
  symbol: string;
  side: Side;
  qty: number;
  entry: number;
  last: number;
  stop: number;
  target: number;
  openedAt: string;
  playbookId: string;
}

export interface Playbook {
  id: string;
  name: string;
  market: string;
  description: string;
  color: string;
  rules: { id: string; text: string }[];
  createdAt: string;
}

export interface Note {
  id: string;
  folder: string;
  title: string;
  body: string;
  updatedAt: string;
  template?: string;
}

export interface ChatMessage {
  id: string;
  spaceId: string;
  author: string;
  role: "you" | "mentor" | "member";
  text: string;
  symbol?: string;
  pnl?: number;
  time: string;
  reactions: number;
}

export interface Space {
  id: string;
  name: string;
  kind: "private" | "group";
  members: number;
  blurb: string;
  mentor?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: string;
  description: string;
  active: boolean;
  custom?: boolean;
  watch?: string;
}

export interface DayPlan {
  date: string;
  items: string[];
  maxLoss: number;
  levels: string;
  journal: string;
  intention: string;
}

export interface BacktestSession {
  id: string;
  name: string;
  mode: "manual" | "auto";
  symbol: string;
  strategy?: string;
  seed: number;
  createdAt: string;
  note: string;
  net: number;
  trades: { side: Side; entry: number; exit: number; pnl: number; r: number }[];
}

export interface User {
  name: string;
  email: string;
  plan: PlanId;
  city: string;
  timezone: string;
}

export interface Filters {
  account: "all" | AccountId;
  range: RangeKey;
  from?: string;
  to?: string;
  playbook: string;
  symbol: string;
  side: "all" | Side;
  tag: string;
  view: ViewMode;
}

export interface AppState {
  version: 1;
  user: User | null;
  theme: "dark" | "light";
  trades: Trade[];
  playbooks: Playbook[];
  notes: Note[];
  messages: ChatMessage[];
  agents: AgentConfig[];
  checklists: Record<string, DayPlan>;
  backtests: BacktestSession[];
  connected: string[];
  filters: Filters;
  widgets: Record<string, boolean>;
  lastImport: string;
  aiCredits: number;
  lessonsDone: string[];
}
