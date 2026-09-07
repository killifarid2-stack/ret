import React, { useEffect, useState, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { MatchProvider, isPublicDisplayWindow } from "@/context/MatchContext";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { I18nProvider } from "@/context/I18nProvider";
import { AccessControlProvider, hasRouteAccess, useAccessControl } from "@/context/AccessControlContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import SplashScreen from "@/components/SplashScreen";
import SessionRecoveryModal from "@/components/SessionRecoveryModal";
import AccessRestricted from "@/components/AccessRestricted";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import TopNav from "@/components/TopNav";

// NOTE: these used to be React.lazy(() => import(...)) route chunks, split
// out so the ~957KB bundle wasn't all loaded up front. That's the right
// call in a browser served over http(s), but this app's Electron windows
// load index.html via `file://` (electron/main.cjs win.loadFile), where
// dynamic import() of a separate chunk can execute before a chunk it
// depends on has finished initializing — a TDZ ReferenceError ("Cannot
// access 'X' before initialization") caught by ErrorBoundary. Removing
// build.rollupOptions manualChunks (see vite.config.ts) fixed one instance
// of this, but the *same* class of bug still fires the moment a lazy route
// itself is first opened (Individual Match / Par Équipe start, etc.) — the
// dynamic-import chunk boundary is the actual hazard, not just manual
// vendor splitting. Importing every route eagerly here removes that
// boundary entirely: everything ships in the one entry chunk that's
// already known to load correctly, at the cost of a larger single bundle
// (acceptable for a desktop app that isn't paying per-KB over a network).
import OperatorScreen from "./components/OperatorScreen";
import PublicScoreboard from "./components/PublicScoreboard";
import AdminPanel from "./components/AdminPanel";
import TournamentManager from "./components/TournamentManager";
import JudgePage from "./pages/JudgePage";
import InstallPage from "./pages/InstallPage";
import ClubPointsPage from "./pages/ClubPointsPage";
import ControlRoomPage from "./pages/ControlRoomPage";
import TournamentControlCenter from "./pages/TournamentControlCenter";
import TournamentWallPage from "./pages/TournamentWallPage";
import ResultsWallPage from "./pages/ResultsWallPage";
import TournamentIntelligencePage from "./pages/TournamentIntelligencePage";
import TournamentOperationsPage from "./pages/TournamentOperationsPage";
import TournamentFinalizationPage from "./pages/TournamentFinalizationPage";
import FinalCommandCenterPage from "./pages/FinalCommandCenterPage";
import QATestCenterPage from "./pages/QATestCenterPage";
import WinnerResultEditorPage from "./pages/WinnerResultEditorPage";
import TournamentDashboardPage from "./pages/TournamentDashboardPage";
import AwardAnimationScreenPage from "./pages/AwardAnimationScreenPage";
import { syncTournamentArchiveIndexFromCloud, syncTournamentArchiveIndexToCloud } from "@/lib/tournament-archive-index";
import { syncAuditLogFromCloud } from "@/lib/audit-log";
import { processPendingSyncActions } from "@/lib/offline-sync";

// Minimal, theme-matched fallback while a lazy route chunk is fetched —
// intentionally plain (no logo/branding fetch of its own) so it never
// itself becomes something else to wait on.
function RouteFallback() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'hsl(var(--background, 222 47% 6%))', color: 'hsl(var(--muted-foreground, 215 20% 65%))',
      fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em',
    }}>
      …
    </div>
  );
}

const queryClient = new QueryClient();

// When Electron opens the secondary "Public Scoreboard" window it loads the
// same index.html with ?displayWindow=public. This gate sends that window
// straight to /scoreboard as soon as the router is mounted, regardless of
// whatever pathname the file:// URL resolved to.
function PublicWindowGate() {
  const navigate = useNavigate();
  useEffect(() => {
    if (isPublicDisplayWindow()) {
      navigate("/scoreboard", { replace: true });
    }
  }, [navigate]);
  return null;
}

function GlobalTopNav() {
  if (isPublicDisplayWindow()) return null;
  return (
    <div className="app-drag-region sticky top-0 relative z-[500] w-full border-b border-white/10 bg-[hsl(var(--background))]/95 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,.22)]">
      <TopNav />
    </div>
  );
}

function NoCloudBanner() {
  if (isSupabaseConfigured || isPublicDisplayWindow()) return null;
  return (
    <div style={{
      background: 'hsl(0 72% 30%)', color: 'white', fontSize: '11px', fontWeight: 700,
      textAlign: 'center', padding: '4px 8px', direction: 'rtl',
    }}>
      ⚠ وضع Offline فعال — البطولة والمباريات تُحفظ محليًا على هذا الجهاز. عند عودة الاتصال تُرسل عناصر المزامنة المعلقة تلقائيًا إلى الخادم؛ استخدم BACKUP TO FILE كنسخة مستقلة إضافية.
    </div>
  );
}

// Gate for role-restricted routes (Admin, Tournament, etc). Used to
// silently navigate('/operator', { replace: true }) the instant access was
// denied — which, since the match state is never reset just by navigating
// away, meant clicking "Admin" or "Tournament" without the right role
// silently dumped the operator onto whatever match (often an old, already
// finished one) happened to still be loaded, with no explanation of why
// they never actually reached Admin/Tournament. Show an in-place unlock
// prompt instead: the route never navigates anywhere on its own, and the
// requested page renders the moment the correct role is unlocked.
function ProtectedRoute({ path, children }: { path: string; children: React.ReactNode }) {
  const { role } = useAccessControl();
  if (!hasRouteAccess(role, path)) return <AccessRestricted path={path} />;
  return <>{children}</>;
}

function AppShell() {
  useEffect(() => {
    void syncTournamentArchiveIndexFromCloud();
    void syncTournamentArchiveIndexToCloud();
    void syncAuditLogFromCloud();
    void processPendingSyncActions();
  }, []);
  const showSplashOnOpen = !isPublicDisplayWindow();
  const [showSplash, setShowSplash] = useState(showSplashOnOpen);

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <div style={!showSplash ? { animation: "splashAppFadeIn 400ms ease-out 1" } : { visibility: "hidden" }}>
        <Toaster />
        <Sonner />
        {!showSplash && <SessionRecoveryModal />}
        <HashRouter>
          <PublicWindowGate />
          <GlobalTopNav />
          <NoCloudBanner />
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/admin" element={<ProtectedRoute path="/admin"><AdminPanel /></ProtectedRoute>} />
                <Route path="/operator" element={<OperatorScreen />} />
                <Route path="/scoreboard" element={<PublicScoreboard />} />
                <Route path="/judge" element={<JudgePage />} />
                <Route path="/tournament" element={<ProtectedRoute path="/tournament"><TournamentManager /></ProtectedRoute>} />
                <Route path="/club-points" element={<ProtectedRoute path="/club-points"><ClubPointsPage /></ProtectedRoute>} />
                <Route path="/control-room" element={<ProtectedRoute path="/control-room"><ControlRoomPage /></ProtectedRoute>} />
                <Route path="/tournament-control" element={<ProtectedRoute path="/tournament-control"><TournamentControlCenter /></ProtectedRoute>} />
                <Route path="/tournament-wall" element={<TournamentWallPage />} />
                <Route path="/results-wall" element={<ResultsWallPage />} />
                <Route path="/tournament-intelligence" element={<ProtectedRoute path="/tournament-intelligence"><TournamentIntelligencePage /></ProtectedRoute>} />
                <Route path="/tournament-operations" element={<ProtectedRoute path="/tournament-operations"><TournamentOperationsPage /></ProtectedRoute>} />
                <Route path="/tournament-finalization" element={<ProtectedRoute path="/tournament-finalization"><TournamentFinalizationPage /></ProtectedRoute>} />
                <Route path="/final-command" element={<ProtectedRoute path="/final-command"><FinalCommandCenterPage /></ProtectedRoute>} />
                <Route path="/qa-test-center" element={<ProtectedRoute path="/qa-test-center"><QATestCenterPage /></ProtectedRoute>} />
                <Route path="/winner-editor" element={<WinnerResultEditorPage />} />
                <Route path="/tournament-dashboard" element={<ProtectedRoute path="/tournament-dashboard"><TournamentDashboardPage /></ProtectedRoute>} />
                <Route path="/award-screen" element={<AwardAnimationScreenPage />} />
                <Route path="/install" element={<InstallPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </HashRouter>
      </div>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <AccessControlProvider>
        <MatchProvider>
          <AppShell />
        </MatchProvider>
      </AccessControlProvider>
    </I18nProvider>
  </QueryClientProvider>
);

export default App;
