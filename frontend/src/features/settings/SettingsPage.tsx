import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getIntlLocale } from '@/shared/lib/formatters';
import { TranslationManager } from './TranslationManager';
import { BackupRestore } from './BackupRestore';
import { RegionalSettings } from './RegionalSettings';
import VectorStatusCard from './VectorStatusCard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Loader2,
  Sun,
  Moon,
  Monitor,
  Pencil,
  Save,
  Lock,
} from 'lucide-react';
import { Card, CardHeader, CardContent, Button, Badge, Skeleton, Breadcrumb } from '@/shared/ui';
import { UpdateNotification } from '@/shared/ui/UpdateChecker';
import { apiGet, apiPatch, apiPost } from '@/shared/lib/api';
import { SUPPORTED_LANGUAGES } from '@/app/i18n';
import { useAuthStore } from '@/stores/useAuthStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useToastStore } from '@/stores/useToastStore';
import { useViewModeStore } from '@/stores/useViewModeStore';

// ── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  locale: string;
  is_active: boolean;
  created_at: string;
}

// ── Appearance Card ─────────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: 'light' as const, icon: Sun, labelKey: 'settings.theme_light', defaultLabel: 'Light' },
  { value: 'dark' as const, icon: Moon, labelKey: 'settings.theme_dark', defaultLabel: 'Dark' },
  { value: 'system' as const, icon: Monitor, labelKey: 'settings.theme_system', defaultLabel: 'System' },
];

function InterfaceModeCard({ animationDelay }: { animationDelay: string }) {
  const { t } = useTranslation();
  const mode = useViewModeStore((s) => s.mode);
  const setMode = useViewModeStore((s) => s.setMode);
  const isAdvanced = mode === 'advanced';

  return (
    <Card className="animate-card-in" style={{ animationDelay }}>
      <CardHeader
        title={t('settings.interface_mode_title', { defaultValue: 'Interface Mode' })}
        subtitle={t('settings.interface_mode_subtitle', { defaultValue: 'Control which features are visible in the navigation' })}
      />
      <CardContent>
        <div className="flex gap-3">
          <button
            onClick={() => setMode('simple')}
            aria-pressed={!isAdvanced}
            aria-label={t('nav.mode_simple', { defaultValue: 'Simple' })}
            className={`flex-1 flex flex-col items-center gap-2 rounded-xl px-4 py-4 border-2 transition-all ${
              !isAdvanced
                ? 'border-oe-blue bg-oe-blue-subtle text-oe-blue'
                : 'border-transparent hover:bg-surface-secondary text-content-secondary hover:text-content-primary'
            }`}
          >
            <span className="text-sm font-semibold">{t('nav.mode_simple', { defaultValue: 'Simple' })}</span>
            <span className="text-xs text-center leading-snug">{t('settings.mode_simple_detail', { defaultValue: 'Essential estimation tools. Clean interface for focused work.' })}</span>
            <span className={`mt-1 inline-flex h-5 items-center rounded-full px-2 text-2xs font-bold tracking-wide ${
              !isAdvanced ? 'bg-oe-blue/15 text-oe-blue' : 'bg-surface-tertiary text-content-tertiary'
            }`}>STD</span>
          </button>
          <button
            onClick={() => setMode('advanced')}
            aria-pressed={isAdvanced}
            aria-label={t('nav.mode_advanced', { defaultValue: 'Advanced' })}
            className={`flex-1 flex flex-col items-center gap-2 rounded-xl px-4 py-4 border-2 transition-all ${
              isAdvanced
                ? 'border-oe-blue bg-oe-blue-subtle text-oe-blue'
                : 'border-transparent hover:bg-surface-secondary text-content-secondary hover:text-content-primary'
            }`}
          >
            <span className="text-sm font-semibold">{t('nav.mode_advanced', { defaultValue: 'Advanced' })}</span>
            <span className="text-xs text-center leading-snug">{t('settings.mode_advanced_detail', { defaultValue: 'Full professional toolset with all modules and features visible.' })}</span>
            <span className={`mt-1 inline-flex h-5 items-center rounded-full px-2 text-2xs font-bold tracking-wide ${
              isAdvanced ? 'bg-oe-blue/15 text-oe-blue' : 'bg-surface-tertiary text-content-tertiary'
            }`}>PRO</span>
          </button>
        </div>
        <Link
          to="/modules"
          className="mt-4 flex items-center gap-2.5 rounded-lg border border-border-light bg-surface-secondary/40 px-4 py-3 text-left transition-all hover:bg-surface-secondary hover:border-border"
        >
          <Package size={16} className="shrink-0 text-oe-blue" />
          <div className="min-w-0">
            <span className="text-sm font-medium text-content-primary">
              {t('settings.modules_link_title', { defaultValue: 'Modules' })}
            </span>
            <p className="text-xs text-content-tertiary mt-0.5">
              {t('settings.modules_link_desc', { defaultValue: 'Enable, disable, and configure individual modules in the Modules section.' })}
            </p>
          </div>
          <span className="ml-auto shrink-0 text-content-quaternary">&rarr;</span>
        </Link>
      </CardContent>
    </Card>
  );
}

function AppearanceCard({ animationDelay }: { animationDelay: string }) {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <Card className="animate-card-in" style={{ animationDelay }}>
      <CardHeader
        title={t('settings.appearance_title', { defaultValue: 'Appearance' })}
        subtitle={t('settings.appearance_subtitle', {
          defaultValue: 'Choose your preferred color scheme',
        })}
      />
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map((option) => {
            const isActive = theme === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => setTheme(option.value)}
                aria-pressed={isActive}
                aria-label={t(option.labelKey, { defaultValue: option.defaultLabel })}
                className={`flex flex-col items-center gap-2.5 rounded-xl px-4 py-4 text-center transition-all duration-normal ease-oe ${
                  isActive
                    ? 'bg-oe-blue-subtle border-2 border-oe-blue text-oe-blue'
                    : 'border-2 border-transparent hover:bg-surface-secondary text-content-secondary hover:text-content-primary'
                }`}
              >
                <Icon size={22} strokeWidth={1.75} />
                <span className="text-sm font-medium">
                  {t(option.labelKey, { defaultValue: option.defaultLabel })}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Settings Page ───────────────────────────────────────────────────────

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const logout = useAuthStore((s) => s.logout);
  const setTokens = useAuthStore((s) => s.setTokens);
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '' });

  const { data: profile, isPending: profileLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/v1/users/me/'),
    retry: false,
  });

  const profileMutation = useMutation({
    mutationFn: (data: { full_name: string }) =>
      apiPatch<UserProfile>('/v1/users/me/', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setEditingProfile(false);
      addToast({ type: 'success', title: t('toasts.profile_updated', { defaultValue: 'Profile updated' }) });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: t('toasts.error', { defaultValue: 'Error' }), message: error.message });
    },
  });

  // ── Change password ──────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: '', new_: '', confirm: '' });
  const [showPwFields, setShowPwFields] = useState(false);

  const pwMutation = useMutation({
    mutationFn: (body: { current_password: string; new_password: string }) =>
      apiPost<{ access_token: string; refresh_token: string }>('/v1/users/me/change-password/', body),
    onSuccess: (data) => {
      const remember = localStorage.getItem('oe_remember') === '1';
      const email = useAuthStore.getState().userEmail ?? undefined;
      setTokens(data.access_token, data.refresh_token, remember, email);
      setPwForm({ current: '', new_: '', confirm: '' });
      setShowPwFields(false);
      addToast({ type: 'success', title: t('settings.password_changed', { defaultValue: 'Password changed successfully' }) });
    },
    onError: (error: Error) => {
      addToast({ type: 'error', title: t('toasts.error', { defaultValue: 'Error' }), message: error.message });
    },
  });

  const pwValid = pwForm.current.length >= 8 && pwForm.new_.length >= 8 && pwForm.new_ === pwForm.confirm;

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <Breadcrumb items={[
        { label: t('nav.dashboard', 'Dashboard'), to: '/' },
        { label: t('nav.settings', 'Settings') },
      ]} className="mb-2" />

      {/* Update notification — surfaced in Settings so users see new
          versions even if they dismissed the sidebar widget for the session. */}
      <div className="-mx-4 sm:-mx-7">
        <UpdateNotification forceShow hideDismiss />
      </div>


      <div className="animate-card-in" style={{ animationDelay: '0ms' }}>
        <h1 className="text-2xl font-bold text-content-primary">{t('nav.settings', 'Settings')}</h1>
        <p className="mt-1 text-sm text-content-secondary">{t('settings.subtitle', { defaultValue: 'Manage your account and preferences' })}</p>
      </div>

      {/* ── Masonry-style two-column layout ──────────────────────────── */}
      <div className="columns-1 xl:columns-2 gap-6 space-y-6 [&>*]:break-inside-avoid">

      {/* Profile */}
      <Card className="animate-card-in" style={{ animationDelay: '100ms' }}>
        <CardHeader title={t('settings.profile_title', { defaultValue: 'Profile' })} subtitle={t('settings.profile_subtitle', { defaultValue: 'Your personal information' })} />
        <CardContent>
          {profile ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-oe-blue text-xl font-bold text-white" aria-hidden="true">
                  {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  {editingProfile ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={profileForm.full_name}
                        onChange={(e) => setProfileForm({ full_name: e.target.value })}
                        className="text-base font-semibold text-content-primary bg-surface-secondary rounded-lg px-3 py-1.5 border border-border-light focus:outline-none focus:ring-2 focus:ring-oe-blue/30 w-48"
                        placeholder={t('settings.full_name', { defaultValue: 'Full name' })}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') profileMutation.mutate({ full_name: profileForm.full_name });
                          if (e.key === 'Escape') setEditingProfile(false);
                        }}
                      />
                      <button
                        onClick={() => profileMutation.mutate({ full_name: profileForm.full_name })}
                        disabled={!profileForm.full_name.trim() || profileMutation.isPending}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-oe-blue hover:bg-oe-blue-subtle transition-colors disabled:opacity-50"
                        title={t('common.save')}
                      >
                        <Save size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="text-base font-semibold text-content-primary">{profile.full_name}</div>
                      <button
                        onClick={() => {
                          setProfileForm({ full_name: profile.full_name || '' });
                          setEditingProfile(true);
                        }}
                        disabled={profileMutation.isPending}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-content-tertiary hover:bg-surface-secondary hover:text-content-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={t('settings.edit_profile', { defaultValue: 'Edit profile name' })}
                        title={t('common.edit')}
                      >
                        <Pencil size={12} />
                      </button>
                    </div>
                  )}
                  <div className="text-sm text-content-secondary">{profile.email}</div>
                  <Badge variant="blue" size="sm" className="mt-1">{profile.role}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border-light">
                <div>
                  <span className="text-xs text-content-tertiary">{t('settings.member_since', { defaultValue: 'Member since' })}</span>
                  <div className="text-sm text-content-primary">{new Date(profile.created_at).toLocaleDateString(getIntlLocale())}</div>
                </div>
                <div>
                  <span className="text-xs text-content-tertiary">{t('settings.status', { defaultValue: 'Status' })}</span>
                  <div><Badge variant={profile.is_active ? 'success' : 'error'} size="sm" dot>{profile.is_active ? t('settings.active', { defaultValue: 'Active' }) : t('settings.inactive', { defaultValue: 'Inactive' })}</Badge></div>
                </div>
              </div>
            </div>
          ) : profileLoading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-content-secondary">{t('settings.profile_error', { defaultValue: 'Could not load profile' })}</p>
          )}
        </CardContent>
      </Card>

      {/* Interface Mode */}
      <InterfaceModeCard animationDelay="150ms" />

      {/* Language */}
      <Card className="animate-card-in" style={{ animationDelay: '250ms' }}>
        <CardHeader title={t('settings.language_title', { defaultValue: 'Language & Region' })} subtitle={t('settings.language_subtitle', { defaultValue: 'Choose your preferred language' })} />
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = i18n.language === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => {
                    i18n.changeLanguage(lang.code);
                    apiPatch('/v1/users/me/', { locale: lang.code }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['me'] });
                    }).catch(() => {});
                  }}
                  aria-pressed={isActive}
                  aria-label={`${lang.name} (${lang.code})`}
                  className={`flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-center transition-all duration-normal ease-oe ${
                    isActive
                      ? 'bg-oe-blue-subtle border-2 border-oe-blue text-oe-blue'
                      : 'border-2 border-transparent hover:bg-surface-secondary text-content-secondary hover:text-content-primary'
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="text-2xs font-medium truncate w-full" title={lang.name}>{lang.name}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Translation Manager */}
      <div className="animate-card-in" style={{ animationDelay: '350ms' }}>
        <TranslationManager />
      </div>

      {/* Regional Settings */}
      <RegionalSettings animationDelay="280ms" />

      {/* Appearance */}
      <AppearanceCard animationDelay="330ms" />

      {/* Backup & Restore */}
      <div className="animate-card-in" style={{ animationDelay: '370ms' }}>
        <BackupRestore />
      </div>

      {/* Semantic Search status — per-collection vector store health */}
      <VectorStatusCard />

      {/* Databases & Resources */}
      <Card className="animate-card-in" style={{ animationDelay: '400ms' }}>
        <CardHeader
          title={t('settings.databases_title', { defaultValue: 'Databases & Resources' })}
          subtitle={t('settings.databases_subtitle', { defaultValue: 'Load cost databases, resource catalogs, and demo projects' })}
        />
        <CardContent>
          <Link to="/setup/databases">
            <Button variant="secondary">
              {t('settings.open_databases', { defaultValue: 'Open Databases & Resources' })}
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Setup Wizard */}
      <Card className="animate-card-in" style={{ animationDelay: '430ms' }}>
        <CardHeader
          title={t('settings.setup_wizard_title', { defaultValue: 'Setup Wizard' })}
          subtitle={t('settings.setup_wizard_subtitle', { defaultValue: 'Re-run the initial setup to change language, install databases, catalogs, or demo projects' })}
        />
        <CardContent>
          <Button
            variant="secondary"
            onClick={() => {
              try { localStorage.removeItem('oe_onboarding_completed'); } catch {}
              window.location.href = '/onboarding';
            }}
          >
            {t('settings.restart_onboarding', { defaultValue: 'Open Setup Wizard' })}
          </Button>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card className="animate-card-in" style={{ animationDelay: '480ms' }}>
        <CardHeader
          title={t('settings.change_password_title', { defaultValue: 'Change Password' })}
          subtitle={t('settings.change_password_subtitle', { defaultValue: 'Update your account password' })}
        />
        <CardContent>
          {showPwFields ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (pwValid && !pwMutation.isPending) {
                  pwMutation.mutate({ current_password: pwForm.current, new_password: pwForm.new_ });
                }
              }}
            >
              <div>
                <label htmlFor="pw-current" className="block text-sm font-medium text-content-secondary mb-1">
                  {t('settings.current_password', { defaultValue: 'Current password' })}
                </label>
                <input
                  id="pw-current"
                  type="password"
                  autoComplete="current-password"
                  className="w-full rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-oe-blue/40"
                  value={pwForm.current}
                  onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="pw-new" className="block text-sm font-medium text-content-secondary mb-1">
                  {t('settings.new_password', { defaultValue: 'New password' })}
                </label>
                <input
                  id="pw-new"
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-oe-blue/40"
                  placeholder={t('settings.password_min_hint', { defaultValue: 'Minimum 8 characters' })}
                  value={pwForm.new_}
                  onChange={(e) => setPwForm((f) => ({ ...f, new_: e.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="pw-confirm" className="block text-sm font-medium text-content-secondary mb-1">
                  {t('settings.confirm_new_password', { defaultValue: 'Confirm new password' })}
                </label>
                <input
                  id="pw-confirm"
                  type="password"
                  autoComplete="new-password"
                  className="w-full rounded-md border border-border bg-surface-secondary px-3 py-2 text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none focus:ring-2 focus:ring-oe-blue/40"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                />
                {pwForm.confirm && pwForm.new_ !== pwForm.confirm && (
                  <p className="mt-1 text-xs text-semantic-error">{t('settings.passwords_mismatch', { defaultValue: 'Passwords do not match' })}</p>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={!pwValid || pwMutation.isPending}>
                  {pwMutation.isPending ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />{t('common.saving', { defaultValue: 'Saving...' })}</>
                  ) : (
                    t('settings.update_password', { defaultValue: 'Update Password' })
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setPwForm({ current: '', new_: '', confirm: '' }); setShowPwFields(false); }}
                >
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="secondary" onClick={() => setShowPwFields(true)}>
              <Lock className="mr-1.5 h-4 w-4" />
              {t('settings.change_password', { defaultValue: 'Change Password' })}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Integrations link */}
      <Card className="animate-card-in" style={{ animationDelay: '500ms' }}>
        <CardHeader title={t('integrations.title', { defaultValue: 'Integrations' })} subtitle={t('integrations.desc', { defaultValue: 'Connect Teams, Slack, Telegram, Discord, Webhooks' })} />
        <CardContent>
          <button
            onClick={() => window.location.href = '/integrations'}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-oe-blue/20 bg-oe-blue/[0.04] text-oe-blue text-sm font-medium hover:bg-oe-blue/10 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6m0 8v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24"/></svg>
            {t('integrations.configure', { defaultValue: 'Configure Integrations' })}
          </button>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="animate-card-in border-semantic-error/20" style={{ animationDelay: '520ms' }}>
        <CardHeader title={t('settings.account_title', { defaultValue: 'Account' })} subtitle={t('settings.account_subtitle', { defaultValue: 'Sign out or manage your account' })} />
        <CardContent>
          <Button
            variant="danger"
            onClick={() => { logout(); window.location.href = '/login'; }}
          >
            {t('settings.sign_out', { defaultValue: 'Sign Out' })}
          </Button>
        </CardContent>
      </Card>

      </div>{/* End masonry columns */}

      {/* About link */}
      <div className="mt-2 text-center">
        <Link to="/about" className="text-sm text-content-tertiary hover:text-oe-blue transition-colors">
          {t('settings.about_link', { defaultValue: 'About OpenConstructionERP' })} →
        </Link>
      </div>
    </div>
  );
}
