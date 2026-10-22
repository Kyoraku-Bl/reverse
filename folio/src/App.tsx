import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell, RequireAuth } from "./components/Shell";
import { AuthPage, Blog, Brokers, Compare, FeaturePage, Landing, Legal, MarketingLayout, Post, Pricing } from "./pages/Marketing";
import { Dashboard } from "./pages/Dashboard";
import { DayView, Notebook, TradeDetail, Trades } from "./pages/Journal";
import { Progress, ReportDetail, Reports, Strategies, StrategyDetail } from "./pages/Analyze";
import { Backtest, Replay } from "./pages/Practice";
import { Accounts, Agents, AIPage, PropFirm, Settings, Spaces, University } from "./pages/Desk";

export default function App() {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/brokers" element={<Brokers />} />
        <Route path="/features/:slug" element={<FeaturePage />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<Post />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/privacy" element={<Legal kind="privacy" />} />
        <Route path="/terms" element={<Legal kind="terms" />} />
      </Route>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/app" element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="day" element={<DayView />} />
        <Route path="day/:date" element={<DayView />} />
        <Route path="trades" element={<Trades />} />
        <Route path="trades/:id" element={<TradeDetail />} />
        <Route path="notebook" element={<Notebook />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/:id" element={<ReportDetail />} />
        <Route path="strategies" element={<Strategies />} />
        <Route path="strategies/:id" element={<StrategyDetail />} />
        <Route path="replay" element={<Replay />} />
        <Route path="replay/:id" element={<Replay />} />
        <Route path="backtest" element={<Backtest />} />
        <Route path="progress" element={<Progress />} />
        <Route path="ai" element={<AIPage />} />
        <Route path="agents" element={<Agents />} />
        <Route path="university" element={<University />} />
        <Route path="university/:id" element={<University />} />
        <Route path="spaces" element={<Spaces />} />
        <Route path="spaces/:id" element={<Spaces />} />
        <Route path="prop" element={<PropFirm />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
