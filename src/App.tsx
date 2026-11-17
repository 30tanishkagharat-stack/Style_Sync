import {
  Calendar,
  CloudSun,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shirt,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { AiStudioView } from './components/AiStudioView';
import { BrandLogo } from './components/BrandLogo';
import { DashboardView, type NavModule } from './components/DashboardView';
import { DesktopGoogleAuthView } from './components/DesktopGoogleAuthView';
import { DesktopInstallButton, OfflineIndicator } from './components/DesktopInstallButton';
import { FavouritesView } from './components/FavouritesView';
import { useFirebase } from './components/FirebaseProvider';
import { LoginView } from './components/LoginView';
import { SettingsView } from './components/SettingsView';
import { WardrobeView } from './components/WardrobeView';
import { WearCalendarView } from './components/WearCalendarView';
import { WeatherAssistantView } from './components/WeatherAssistantView';
import {
  syncCalendarEntryToFirestore,
  syncOutfitToFirestore,
  syncProfileToFirestore,
  syncWardrobeItemToFirestore,
} from './firestoreSync';
import type { AuthUser } from './types';

interface NavItem {
  id: NavModule;
  label: string;
  subtitle: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    subtitle: 'Wardrobe overview, daily look, and live weather',
    icon: LayoutDashboard,
  },
  {
    id: 'wardrobe',
    label: 'My Wardrobe',
    subtitle: 'Upload, categorize, search, and organize your garments',
    icon: Shirt,
  },
  {
    id: 'ai-studio',
    label: 'AI Studio',
    subtitle: 'Gemma clothing recognition, outfit styling, and fashion chat',
    icon: Sparkles,
  },
  {
    id: 'weather',
    label: 'Weather Assistant',
    subtitle: 'Live Open-Meteo conditions and weather-matched outfits',
    icon: CloudSun,
  },
  {
    id: 'favourites',
    label: 'Favourites',
    subtitle: 'Pinned staple garments and saved outfit combinations',
    icon: Heart,
  },
  {
    id: 'calendar',
    label: 'Wear & Calendar',
    subtitle: 'Usage analytics, wear history, and future outfit planning',
    icon: Calendar,
  },
  {
    id: 'settings',
    label: 'Settings',
    subtitle: 'Account, appearance, privacy & data, weather, and support',
    icon: Settings,
  },
];

export default function App() {
  const { firebaseUser, authReady, signOutFirebase, deleteFirebaseAccount } = useFirebase();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeModule, setActiveModule] = useState<NavModule>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return window.localStorage.getItem('stylesync_theme') === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const syncedUidRef = useRef<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      window.localStorage.setItem('stylesync_theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    let active = true;
    api
      .getMe()
      .then((res) => {
        if (active) setAuthUser(res.user);
      })
      .catch(() => {
        if (active) setAuthUser(null);
      })
      .finally(() => {
        if (active) setAuthChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authReady || !authUser || !firebaseUser || !firebaseUser.emailVerified) return;
    if (syncedUidRef.current === firebaseUser.uid) return;
    syncedUidRef.current = firebaseUser.uid;

    void (async () => {
      try {
        const [settingsRes, wardRes, outfitRes, calRes] = await Promise.all([
          api.getSettings(),
          api.listWardrobe(),
          api.listOutfits(),
          api.listCalendar(),
        ]);
        await syncProfileToFirestore(settingsRes.profile, settingsRes.settings);
        await Promise.all([
          ...wardRes.items.map((item) => syncWardrobeItemToFirestore(item)),
          ...outfitRes.outfits.map((outfit) => syncOutfitToFirestore(outfit)),
          ...calRes.entries.map((entry) => syncCalendarEntryToFirestore(entry)),
        ]);
      } catch {
        // Handled cleanly inside firestoreSync via handleFirestoreError
      }
    })();
  }, [authReady, authUser, firebaseUser]);

  const notify = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 4000);
  }, []);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeModule) || NAV_ITEMS[0];

  const handleSelectModule = (id: NavModule) => {
    setActiveModule(id);
    setMobileMenuOpen(false);
  };

  const handleLogout = async () => {
    syncedUidRef.current = null;
    await Promise.allSettled([api.logout(), signOutFirebase()]);
    setAuthUser(null);
    setMobileMenuOpen(false);
    setActiveModule('dashboard');
  };

  const handleDeleteAccount = async () => {
    syncedUidRef.current = null;
    await api.deleteAccount();
    await deleteFirebaseAccount().catch(() => {});
    setAuthUser(null);
    setMobileMenuOpen(false);
    setActiveModule('dashboard');
  };

  const desktopGoogleNonce =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('desktop_google_nonce')
      : null;

  if (desktopGoogleNonce) {
    return <DesktopGoogleAuthView nonce={desktopGoogleNonce} />;
  }

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#F7F3ED] flex items-center justify-center p-6">
        <div className="text-center flex flex-col items-center">
          <BrandLogo size="lg" />
          <p className="text-xs text-[#85817B] mt-2">Loading your wardrobe archive...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return <LoginView onSuccess={(user) => setAuthUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-[#F7F3ED] text-[#292929] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-[#FFFEFC] border-r border-[#E9DFD2]">
        <div className="px-5 py-5 border-b border-[#E9DFD2]">
          <BrandLogo size="md" subtitle="Personal AI Wardrobe" />
        </div>

        <nav aria-label="Primary navigation" className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectModule(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#292929] text-[#FFFEFC]'
                    : 'text-[#292929]/80 hover:bg-[#F7F3ED] hover:text-[#292929]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${active ? 'text-[#B76545]' : 'text-[#85817B]'}`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-[#E9DFD2] space-y-2.5">
          <div className="text-xs">
            <p className="font-semibold text-[#292929] truncate">{authUser.name}</p>
          </div>
          <DesktopInstallButton variant="sidebar" />
          <button
            type="button"
            onClick={handleLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#F7F3ED] border border-[#E9DFD2] text-[#292929] hover:border-[#B76545] transition-colors whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 text-[#B76545]" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-[#292929]/45"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] bg-[#FFFEFC] border-r border-[#E9DFD2] flex flex-col z-10">
            <div className="px-5 py-4 border-b border-[#E9DFD2] flex items-center justify-between">
              <BrandLogo size="sm" />
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation"
                className="p-1 text-[#85817B] hover:text-[#292929]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectModule(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#292929] text-[#FFFEFC]'
                        : 'text-[#292929]/80 hover:bg-[#F7F3ED]'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${active ? 'text-[#B76545]' : 'text-[#85817B]'}`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="px-4 py-4 border-t border-[#E9DFD2] space-y-2.5">
              <div className="text-xs">
                <p className="font-semibold text-[#292929] truncate">{authUser.name}</p>
              </div>
              <DesktopInstallButton variant="sidebar" />
              <button
                type="button"
                onClick={handleLogout}
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-[#F7F3ED] border border-[#E9DFD2] text-[#292929] whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5 text-[#B76545]" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-[#F7F3ED]/95 backdrop-blur-sm border-b border-[#E9DFD2] px-5 sm:px-8 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation"
                className="md:hidden p-2 rounded-lg border border-[#E9DFD2] bg-[#FFFEFC] text-[#292929]"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#292929] font-serif leading-none truncate">
                  {currentNav.label}
                </h1>
              </div>
            </div>
          </div>
        </header>

        {/* Toast Banner */}
        {toast && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm">
            <div
              role="status"
              className={`px-4 py-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 shadow-sm ${
                toast.type === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : 'bg-[#292929] border-[#292929] text-[#FFFEFC]'
              }`}
            >
              <span>{toast.message}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                aria-label="Dismiss notification"
                className="opacity-70 hover:opacity-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <OfflineIndicator />

        <main className="flex-1 px-5 sm:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            {activeModule === 'dashboard' && (
              <DashboardView onNavigate={handleSelectModule} onNotify={notify} />
            )}
            {activeModule === 'wardrobe' && <WardrobeView onNotify={notify} />}
            {activeModule === 'ai-studio' && <AiStudioView onNotify={notify} />}
            {activeModule === 'weather' && <WeatherAssistantView onNotify={notify} />}
            {activeModule === 'favourites' && <FavouritesView onNotify={notify} />}
            {activeModule === 'calendar' && <WearCalendarView onNotify={notify} />}
            {activeModule === 'settings' && (
              <SettingsView
                onNotify={notify}
                accountEmail={authUser.email}
                theme={theme}
                onThemeChange={setTheme}
                onLogout={handleLogout}
                onAccountDeleted={handleDeleteAccount}
                onUserUpdated={(gender, name) =>
                  setAuthUser((prev) => (prev ? { ...prev, gender, name } : prev))
                }
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
