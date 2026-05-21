import { Suspense, lazy, useState, useCallback, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppLayout } from './layout';
import { DashboardPage } from '@/features/dashboard';
import { LoginPage, RegisterPage, ForgotPasswordPage } from '@/features/auth';
import { ProjectsPage, CreateProjectPage, ProjectDetailPage } from '@/features/projects';
import { OnboardingWizard } from '@/features/onboarding';
import { ModulesPage, ModuleDeveloperGuide } from '@/features/modules';
import { useModuleRouteElements } from '@/modules/ModuleRoutes';
import { SettingsPage } from '@/features/settings';
import { DatabaseSetupPage } from '@/features/setup';
import { IntegrationsPage } from '@/features/integrations';
import { AboutPage } from '@/features/about/AboutPage';
import { Logo, ShortcutsDialog, CommandPalette, ToastContainer, ErrorBoundary, NotFoundPage } from '@/shared/ui';
import GlobalSearchModal from '@/features/search/GlobalSearchModal';
import { useGlobalSearchStore } from '@/stores/useGlobalSearchStore';
import { FloatingQueuePanel } from './layout/FloatingQueuePanel';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { ddcVerifyIntegrity, ddcInjectMeta, DDC_ORIGIN } from '@/shared/lib/ddc-integrity';
import { useKeyboardShortcuts } from '@/shared/hooks/useKeyboardShortcuts';
import { useTranslation } from 'react-i18next';
import { initErrorLogger } from '@/shared/lib/errorLogger';

// Lazy-loaded heavy pages — code-split into separate chunks
const SchedulePage = lazy(() =>
  import('@/features/schedule/SchedulePage').then((m) => ({ default: m.SchedulePage }))
);
const ChangeOrdersPage = lazy(() =>
  import('@/features/changeorders/ChangeOrdersPage').then((m) => ({ default: m.ChangeOrdersPage }))
);
const RiskRegisterPage = lazy(() =>
  import('@/features/risk/RiskRegisterPage').then((m) => ({ default: m.RiskRegisterPage }))
);
const DocumentsPage = lazy(() =>
  import('@/features/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage }))
);
const PhotoGalleryPage = lazy(() =>
  import('@/features/documents/PhotoGalleryPage').then((m) => ({ default: m.PhotoGalleryPage }))
);
const MarkupsPage = lazy(() =>
  import('@/features/markups/MarkupsPage').then((m) => ({ default: m.MarkupsPage }))
);
const PunchListPage = lazy(() =>
  import('@/features/punchlist/PunchListPage').then((m) => ({ default: m.PunchListPage }))
);
const FieldReportsPage = lazy(() =>
  import('@/features/fieldreports/FieldReportsPage').then((m) => ({ default: m.FieldReportsPage }))
);
const FinancePage = lazy(() =>
  import('@/features/finance/FinancePage').then((m) => ({ default: m.FinancePage }))
);
const ProcurementPage = lazy(() =>
  import('@/features/procurement/ProcurementPage').then((m) => ({ default: m.ProcurementPage }))
);
const SafetyPage = lazy(() =>
  import('@/features/safety/SafetyPage').then((m) => ({ default: m.SafetyPage }))
);
const ContactsPage = lazy(() =>
  import('@/features/contacts/ContactsPage').then((m) => ({ default: m.ContactsPage }))
);
const TasksPage = lazy(() =>
  import('@/features/tasks/TasksPage').then((m) => ({ default: m.TasksPage }))
);
const RFIPage = lazy(() =>
  import('@/features/rfi/RFIPage').then((m) => ({ default: m.RFIPage }))
);
const SubmittalsPage = lazy(() =>
  import('@/features/submittals/SubmittalsPage').then((m) => ({ default: m.SubmittalsPage }))
);
const CorrespondencePage = lazy(() =>
  import('@/features/correspondence/CorrespondencePage').then((m) => ({ default: m.CorrespondencePage }))
);
const CDEPage = lazy(() =>
  import('@/features/cde/CDEPage').then((m) => ({ default: m.CDEPage }))
);
const TransmittalsPage = lazy(() =>
  import('@/features/transmittals/TransmittalsPage').then((m) => ({ default: m.TransmittalsPage }))
);
const MeetingsPage = lazy(() =>
  import('@/features/meetings/MeetingsPage').then((m) => ({ default: m.MeetingsPage }))
);
const InspectionsPage = lazy(() =>
  import('@/features/inspections/InspectionsPage').then((m) => ({ default: m.InspectionsPage }))
);
const NCRPage = lazy(() =>
  import('@/features/ncr/NCRPage').then((m) => ({ default: m.NCRPage }))
);
const ReportingPage = lazy(() =>
  import('@/features/reporting/ReportingPage').then((m) => ({ default: m.ReportingPage }))
);
const DwgTakeoffPage = lazy(() =>
  import('@/features/dwg-takeoff/DwgTakeoffPage').then((m) => ({ default: m.DwgTakeoffPage }))
);
const AssetsPage = lazy(() =>
  import('@/features/bim/AssetsPage').then((m) => ({ default: m.AssetsPage }))
);
const BIMPage = lazy(() =>
  import('@/features/bim/BIMPage').then((m) => ({ default: m.BIMPage }))
);
const UserManagementPage = lazy(() =>
  import('@/features/users/UserManagementPage').then((m) => ({ default: m.UserManagementPage }))
);

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-secondary">
      <div className="flex flex-col items-center gap-3 animate-fade-in">
        <Logo size="lg" animate />
        <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-secondary">
          <div className="h-full w-8 animate-shimmer rounded-full bg-oe-blue opacity-60" />
        </div>
      </div>
    </div>
  );
}

// Small inline loader for lazy page chunks — shown inside the main content
// area while the layout (sidebar + header) stays visible. Prevents the
// full-screen dark flash when navigating between code-split routes (e.g.
// clicking a notification that links to /tasks or /cde).
function PageLoadingInline() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-oe-blue border-t-transparent" />
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();
  if (!isAuthenticated) {
    // Preserve intended destination so the user lands where they wanted
    // after signing in (BUG-047). Avoids the "bookmarked /boq then sent
    // back to /" UX papercut.
    const next = `${location.pathname}${location.search}`;
    const qs = next && next !== '/' ? `?next=${encodeURIComponent(next)}` : '';
    return <Navigate to={`/login${qs}`} replace />;
  }
  return <>{children}</>;
}

function P({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppLayout title={title}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoadingInline />}>{children}</Suspense>
        </ErrorBoundary>
      </AppLayout>
    </RequireAuth>
  );
}

/** Mounts global keyboard shortcuts, the shortcuts help dialog, and the command palette. */
function GlobalShortcuts() {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const handleToggleShortcuts = useCallback(() => {
    setShortcutsOpen((prev) => !prev);
  }, []);

  // The `/` shortcut for search is already handled by Header's own keydown
  // listener, so we pass a no-op here to avoid duplicate triggers.
  const noop = useCallback(() => {}, []);

  useKeyboardShortcuts({
    onOpenSearch: noop,
    onToggleShortcutsDialog: handleToggleShortcuts,
  });

  // Ctrl+K / Cmd+K to open command palette
  // / to open command palette (when not typing)
  // Note: Ctrl+N / Ctrl+Shift+N are reserved by the browser (new window/incognito)
  // and cannot be intercepted reliably — use the `n p` two-key sequence instead.
  // Ctrl+Shift+V is reserved for Excel paste in BOQ Editor — don't bind it globally.

  const openGlobalSearch = useGlobalSearchStore((s) => s.openModal);
  const toggleGlobalSearch = useGlobalSearchStore((s) => s.toggleModal);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const isTextField =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Cmd/Ctrl+Shift+K → semantic search modal (cross-module vector search).
      // Bound BEFORE the plain Cmd+K branch so the shift modifier short-
      // circuits the navigation palette.  Works even from text fields so
      // estimators can trigger semantic search while editing a BOQ row.
      if (mod && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        toggleGlobalSearch();
        return;
      }

      if (isTextField) return;

      if (mod && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if (e.key === '/' && !mod) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggleGlobalSearch, openGlobalSearch]);

  return (
    <>
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <GlobalSearchModal />
    </>
  );
}

// Run once at module load — synchronous, before any render
useAuthStore.getState().loadFromStorage();
useThemeStore.getState().init();

// Initialize the anonymized error logger (global handlers for unhandled errors)
initErrorLogger();

// Inject DDC origin meta tags + subtle console banner. These provide
// provenance fingerprints: if someone clones the UI and serves it
// unmodified, the meta tags and console message are direct evidence of
// the origin. Removing them is not a functional break, but does prove
// the distribution was tampered with.
if (typeof document !== 'undefined') {
  ddcInjectMeta();
}
if (typeof window !== 'undefined' && typeof console !== 'undefined') {
  try {
    // eslint-disable-next-line no-console
    console.info(
      `%c${DDC_ORIGIN}%c · Artem Boiko · datadrivenconstruction.io`,
      'color:#0071E3;font-weight:700',
      'color:#64748b',
    );
  } catch { /* noop */ }
}

/** Keeps <html lang> in sync with the active i18n language. All supported
 *  languages (es, en, pt, fr) are LTR — dir is fixed to 'ltr'. */
function useDocumentDirection() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  useDocumentDirection();

  // DDC-CWICR-OE integrity verification
  if (typeof window !== 'undefined') {
    (window as any).__ddc_oe = ddcVerifyIntegrity();
  }

  // Dynamic routes from the module registry (lazy-loaded)
  const moduleRoutes = useModuleRouteElements({ Wrapper: P });

  return (
    <Suspense fallback={<LoadingScreen />}>
      {isAuthenticated && <GlobalShortcuts />}
      <Routes>
        {/* Auth — public */}
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} />
        <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />

        {/* Onboarding — full-screen, no layout */}
        <Route path="/onboarding" element={
          <RequireAuth><OnboardingWizard /></RequireAuth>
        } />

        {/* App — all protected, all real pages */}
        <Route path="/" element={<P title="Dashboard"><DashboardPage /></P>} />

        <Route path="/bim" element={<P title="BIM Viewer"><BIMPage /></P>} />
        <Route path="/assets" element={<P title="Asset Register"><AssetsPage /></P>} />
        <Route path="/bim/:modelId" element={<P title="BIM Viewer"><BIMPage /></P>} />
        <Route path="/projects/:projectId/bim" element={<P title="BIM Viewer"><BIMPage /></P>} />
        <Route path="/projects/:projectId/bim/:modelId" element={<P title="BIM Viewer"><BIMPage /></P>} />

        <Route path="/projects" element={<P title="Projects"><ProjectsPage /></P>} />
        <Route path="/projects/new" element={<P title="New Project"><CreateProjectPage /></P>} />
        <Route path="/projects/:projectId" element={<P title="Project"><ProjectDetailPage /></P>} />


        <Route path="/dwg-takeoff" element={<P title="DWG Takeoff"><DwgTakeoffPage /></P>} />

        <Route path="/schedule" element={<P title="4D Schedule"><SchedulePage /></P>} />


        <Route path="/reporting" element={<P title="Reporting Dashboards"><ReportingPage /></P>} />


        <Route path="/changeorders" element={<P title="Change Orders"><ChangeOrdersPage /></P>} />
        <Route path="/documents" element={<P title="Documents"><DocumentsPage /></P>} />
        <Route path="/photos" element={<P title="Project Photos"><PhotoGalleryPage /></P>} />

        <Route path="/risks" element={<P title="Risk Register"><RiskRegisterPage /></P>} />

        {/* requirements feature eliminated — redirect to /bim */}
        <Route path="/requirements" element={<Navigate to="/bim" replace />} />

        <Route path="/markups" element={<P title="Markups"><MarkupsPage /></P>} />
        <Route path="/punchlist" element={<P title="Punch List"><PunchListPage /></P>} />
        <Route path="/field-reports" element={<P title="Field Reports"><FieldReportsPage /></P>} />

        <Route path="/finance" element={<P title="Finance"><FinancePage /></P>} />
        <Route path="/projects/:projectId/finance" element={<P title="Finance"><FinancePage /></P>} />

        <Route path="/procurement" element={<P title="Procurement"><ProcurementPage /></P>} />
        <Route path="/projects/:projectId/procurement" element={<P title="Procurement"><ProcurementPage /></P>} />

        <Route path="/safety" element={<P title="Safety"><SafetyPage /></P>} />
        <Route path="/projects/:projectId/safety" element={<P title="Safety"><SafetyPage /></P>} />

        <Route path="/contacts" element={<P title="Contacts"><ContactsPage /></P>} />
        <Route path="/projects/:projectId/tasks" element={<P title="Tasks"><TasksPage /></P>} />
        <Route path="/tasks" element={<P title="Tasks"><TasksPage /></P>} />
        <Route path="/projects/:projectId/rfi" element={<P title="RFI"><RFIPage /></P>} />
        <Route path="/rfi" element={<P title="RFI"><RFIPage /></P>} />
        <Route path="/projects/:projectId/submittals" element={<P title="Submittals"><SubmittalsPage /></P>} />
        <Route path="/submittals" element={<P title="Submittals"><SubmittalsPage /></P>} />
        <Route path="/projects/:projectId/correspondence" element={<P title="Correspondence"><CorrespondencePage /></P>} />
        <Route path="/correspondence" element={<P title="Correspondence"><CorrespondencePage /></P>} />
        <Route path="/projects/:projectId/cde" element={<P title="CDE"><CDEPage /></P>} />
        <Route path="/cde" element={<P title="CDE"><CDEPage /></P>} />
        <Route path="/projects/:projectId/transmittals" element={<P title="Transmittals"><TransmittalsPage /></P>} />
        <Route path="/transmittals" element={<P title="Transmittals"><TransmittalsPage /></P>} />
        <Route path="/projects/:projectId/meetings" element={<P title="Meetings"><MeetingsPage /></P>} />
        <Route path="/meetings" element={<P title="Meetings"><MeetingsPage /></P>} />
        <Route path="/projects/:projectId/inspections" element={<P title="Inspections"><InspectionsPage /></P>} />
        <Route path="/inspections" element={<P title="Inspections"><InspectionsPage /></P>} />
        <Route path="/projects/:projectId/ncr" element={<P title="NCR"><NCRPage /></P>} />
        <Route path="/ncr" element={<P title="NCR"><NCRPage /></P>} />

        <Route path="/users" element={<P title="User Management"><UserManagementPage /></P>} />
        <Route path="/modules" element={<P title="Modules"><ModulesPage /></P>} />
        <Route path="/modules/developer-guide" element={<P title="Module Developer Guide"><ModuleDeveloperGuide /></P>} />

        <Route path="/setup/databases" element={<P title="Databases & Resources"><DatabaseSetupPage /></P>} />
        <Route path="/settings" element={<P title="Settings"><SettingsPage /></P>} />
        <Route path="/integrations" element={<P title="Integrations"><IntegrationsPage /></P>} />
        <Route path="/about" element={<P title="About"><AboutPage /></P>} />

        {/* Convenience route aliases — redirect to canonical paths */}
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/change-orders" element={<Navigate to="/changeorders" replace />} />
        <Route path="/punch-list" element={<Navigate to="/punchlist" replace />} />
        <Route path="/variations" element={<Navigate to="/changeorders" replace />} />
        <Route path="/profile" element={<Navigate to="/settings" replace />} />
        <Route path="/notifications" element={<Navigate to="/settings" replace />} />

        {/* Plugin module routes — lazy-loaded */}
        {moduleRoutes}

        {/* 404 — catch-all for unknown routes */}
        <Route path="*" element={isAuthenticated ? <P title="Not Found"><NotFoundPage /></P> : <Navigate to="/login" replace />} />
      </Routes>
      <ToastContainer />
      <FloatingQueuePanel />
      {/* DDC-CWICR-OE */}
      <span aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        {'\u200B\u200C\u200D\u200B\u200C\u200D\u200B'}
        DataDrivenConstruction·CWICR·OpenConstructionERP·2026
      </span>
    </Suspense>
  );
}
