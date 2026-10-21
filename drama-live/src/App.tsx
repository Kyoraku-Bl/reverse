import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './app/AppLayout';
import { WatchPage } from './app/WatchPage';
import { MultiViewPage } from './app/MultiViewPage';
import { GuidePage } from './app/GuidePage';
import { SourcesPage } from './app/SourcesPage';
import { SettingsPage } from './app/SettingsPage';
import { Landing } from './pages/Landing';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="/app/live" replace />} />
          <Route path="live" element={<WatchPage kinds={['live']} title="nav.live" />} />
          <Route path="movies" element={<WatchPage kinds={['movie']} title="nav.movies" view="grid" />} />
          <Route path="series" element={<WatchPage kinds={['series']} title="nav.series" view="grid" />} />
          <Route path="radio" element={<WatchPage kinds={['radio']} title="nav.radio" />} />
          <Route path="favorites" element={<WatchPage kinds={['live', 'movie', 'series', 'radio']} favoriteOnly title="nav.favorites" />} />
          <Route path="multiview" element={<MultiViewPage />} />
          <Route path="guide" element={<GuidePage />} />
          <Route path="sources" element={<SourcesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
    </ErrorBoundary>
  );
}
