import {
  AlertTriangle,
  Check,
  Database,
  Eye,
  EyeOff,
  HelpCircle,
  Info,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Monitor,
  Moon,
  Palette,
  Shield,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDesktopApp } from '../hooks/useDesktopApp';
import type {
  ClothingItem,
  GenderOption,
  StorageInfo,
  UserProfile,
  UserSettings,
} from '../types';
import { DesktopInstallButton } from './DesktopInstallButton';
import { useFirebase } from './FirebaseProvider';

interface SettingsViewProps {
  onNotify: (message: string, type?: 'success' | 'error') => void;
  onUserUpdated?: (gender: GenderOption, name: string) => void;
  accountEmail?: string;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onLogout: () => Promise<void> | void;
  onAccountDeleted: () => Promise<void> | void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function SettingsView({
  onNotify,
  onUserUpdated,
  accountEmail,
  theme,
  onThemeChange,
  onLogout,
  onAccountDeleted,
}: SettingsViewProps) {
  const { firebaseUser } = useFirebase();
  const { isElectron, isInstalled, isInstallable } = useDesktopApp();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [wardrobeItems, setWardrobeItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Privacy & Data image management state
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  // Logout & Delete account state
  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const [settingsRes, wardrobeRes] = await Promise.all([
        api.getSettings(),
        api.listWardrobe({ sort: 'recent' }),
      ]);
      setProfile(settingsRes.profile);
      setSettings(settingsRes.settings);
      setStorage(settingsRes.storage);
      setWardrobeItems(wardrobeRes.items);
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const refreshStorageAndWardrobe = async () => {
    const [settingsRes, wardrobeRes] = await Promise.all([
      api.getSettings(),
      api.listWardrobe({ sort: 'recent' }),
    ]);
    setStorage(settingsRes.storage);
    setWardrobeItems(wardrobeRes.items);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !settings) return;
    if (!profile.name.trim()) {
      onNotify('Display name cannot be empty.', 'error');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await api.updateSettings({
        profile: {
          ...profile,
          name: profile.name.trim(),
        },
        settings,
      });
      setProfile(res.profile);
      setSettings(res.settings);
      setStorage(res.storage);
      onUserUpdated?.(res.profile.gender, res.profile.name);
      onNotify('Profile and preferences saved.', 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      onNotify('Please complete all password fields.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      onNotify('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      onNotify('New password and confirmation do not match.', 'error');
      return;
    }

    setChangingPassword(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onNotify('Password updated successfully.', 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteImage = async (item: ClothingItem) => {
    setDeletingItemId(item.id);
    try {
      await api.deleteClothingItem(item.id);
      setWardrobeItems((prev) => prev.filter((x) => x.id !== item.id));
      await refreshStorageAndWardrobe();
      onNotify(`Removed "${item.name}" from your wardrobe.`, 'success');
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setDeletingItemId(null);
    }
  };

  const handleClearAllImages = async () => {
    setClearingAll(true);
    try {
      const res = await api.clearAllWardrobeImages();
      setWardrobeItems([]);
      setConfirmClearAll(false);
      await refreshStorageAndWardrobe();
      onNotify(
        res.deletedCount > 0
          ? `Removed ${res.deletedCount} wardrobe image${res.deletedCount === 1 ? '' : 's'}.`
          : 'Wardrobe storage is already empty.',
        'success'
      );
    } catch (err) {
      onNotify((err as Error).message, 'error');
    } finally {
      setClearingAll(false);
    }
  };

  const handleLogoutClick = async () => {
    setLoggingOut(true);
    try {
      await onLogout();
    } catch (err) {
      onNotify((err as Error).message, 'error');
      setLoggingOut(false);
    }
  };

  const handleDeleteAccountConfirm = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      onNotify('Type DELETE to confirm permanent account deletion.', 'error');
      return;
    }
    setDeletingAccount(true);
    try {
      await onAccountDeleted();
    } catch (err) {
      onNotify((err as Error).message, 'error');
      setDeletingAccount(false);
    }
  };

  if (loading || !profile || !settings) {
    return (
      <div className="space-y-6 max-w-4xl animate-pulse">
        <div className="h-64 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl" />
        <div className="h-44 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl" />
        <div className="h-56 bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl" />
      </div>
    );
  }

  const resolvedEmail = profile.email || accountEmail || firebaseUser?.email || '';
  const isGoogleUser = Boolean(
    firebaseUser?.providerData?.some((provider) => provider.providerId === 'google.com')
  );
  const isGuestAccount = resolvedEmail.endsWith('@stylesync.local');

  return (
    <div className="space-y-6 max-w-4xl pb-8">
      {/* 1. Account */}
      <section className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#E9DFD2]">
          <User className="w-4 h-4 text-[#B76545]" />
          <div>
            <h2 className="text-xl font-semibold text-[#292929] font-serif">Account</h2>
          </div>
        </div>

        {/* Profile & Weather Preferences Form */}
        <form id="account-profile-form" onSubmit={handleSaveAccount} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#292929] mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                placeholder="Your name"
                className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg focus:outline-none focus:border-[#B76545]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#292929] mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={resolvedEmail}
                readOnly
                aria-readonly="true"
                className="w-full px-3 py-2 text-sm bg-[#F7F3ED]/60 border border-[#E9DFD2] rounded-lg text-[#85817B] cursor-not-allowed focus:outline-none"
              />
              <p className="text-[11px] text-[#85817B] mt-1">
                Your account email is locked and cannot be modified.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E9DFD2] space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#292929]">
              <MapPin className="w-3.5 h-3.5 text-[#B76545]" />
              <span>Weather Preferences</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#292929] mb-1">
                  Preferred City
                </label>
                <input
                  type="text"
                  value={settings.preferred_city}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      preferred_city: e.target.value,
                      preferred_lat: null,
                      preferred_lon: null,
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg focus:outline-none focus:border-[#B76545]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#292929] mb-1">
                  Temperature Unit
                </label>
                <select
                  value={settings.temperature_unit}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      temperature_unit: e.target.value === 'F' ? 'F' : 'C',
                    })
                  }
                  className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg focus:outline-none focus:border-[#B76545]"
                >
                  <option value="C">Celsius (°C)</option>
                  <option value="F">Fahrenheit (°F)</option>
                </select>
              </div>
            </div>
          </div>

        </form>

        {/* Change Password */}
        <div className="pt-5 border-t border-[#E9DFD2] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#B76545]" />
              <h3 className="text-sm font-semibold text-[#292929]">Change Password</h3>
            </div>
            {!isGoogleUser && !isGuestAccount && (
              <button
                type="button"
                onClick={() => setShowPasswords((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs text-[#85817B] hover:text-[#292929]"
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPasswords ? 'Hide' : 'Show'}
              </button>
            )}
          </div>

          {isGoogleUser ? (
            <div className="px-4 py-3 rounded-lg bg-[#F7F3ED] border border-[#E9DFD2] text-xs text-[#85817B]">
              You are signed in with Google. Password changes are managed directly through your Google Account security settings.
            </div>
          ) : isGuestAccount ? (
            <div className="px-4 py-3 rounded-lg bg-[#F7F3ED] border border-[#E9DFD2] text-xs text-[#85817B]">
              Guest sessions do not use a password. Create a registered account on the sign-in screen to set a password.
            </div>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1">
                    Current Password
                  </label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Current password"
                    autoComplete="current-password"
                    className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg focus:outline-none focus:border-[#B76545]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1">
                    New Password
                  </label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg focus:outline-none focus:border-[#B76545]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#292929] mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    className="w-full px-3 py-2 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg focus:outline-none focus:border-[#B76545]"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[#292929] text-[#FFFEFC] hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  <KeyRound className="w-3.5 h-3.5 text-[#B76545]" />
                  {changingPassword ? 'Updating Password...' : 'Update Password'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* 2. Appearance */}
      <section className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#E9DFD2]">
          <Palette className="w-4 h-4 text-[#B76545]" />
          <div>
            <h2 className="text-xl font-semibold text-[#292929] font-serif">Appearance</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
          <button
            type="button"
            onClick={() => onThemeChange('light')}
            className={`flex items-center justify-between p-4 rounded-xl border text-left transition-colors ${
              theme === 'light'
                ? 'bg-[#292929] text-[#FFFEFC] border-[#292929]'
                : 'bg-[#F7F3ED] text-[#292929] border-[#E9DFD2] hover:bg-[#E9DFD2]/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sun className={`w-4 h-4 ${theme === 'light' ? 'text-[#B76545]' : 'text-[#85817B]'}`} />
              <div>
                <p className="text-sm font-medium">Light Mode</p>
                <p
                  className={`text-[11px] ${
                    theme === 'light' ? 'text-[#FFFEFC]/75' : 'text-[#85817B]'
                  }`}
                >
                  Warm editorial parchment palette
                </p>
              </div>
            </div>
            {theme === 'light' && <Check className="w-4 h-4 text-[#B76545]" />}
          </button>

          <button
            type="button"
            onClick={() => onThemeChange('dark')}
            className={`flex items-center justify-between p-4 rounded-xl border text-left transition-colors ${
              theme === 'dark'
                ? 'bg-[#292929] text-[#FFFEFC] border-[#292929]'
                : 'bg-[#F7F3ED] text-[#292929] border-[#E9DFD2] hover:bg-[#E9DFD2]/60'
            }`}
          >
            <div className="flex items-center gap-3">
              <Moon className={`w-4 h-4 ${theme === 'dark' ? 'text-[#B76545]' : 'text-[#85817B]'}`} />
              <div>
                <p className="text-sm font-medium">Dark Mode</p>
                <p
                  className={`text-[11px] ${
                    theme === 'dark' ? 'text-[#FFFEFC]/75' : 'text-[#85817B]'
                  }`}
                >
                  Low-glare charcoal evening theme
                </p>
              </div>
            </div>
            {theme === 'dark' && <Check className="w-4 h-4 text-[#B76545]" />}
          </button>
        </div>
      </section>

      {/* 3. Privacy & Data */}
      <section className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E9DFD2]">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-[#B76545]" />
            <div>
              <h2 className="text-xl font-semibold text-[#292929] font-serif">
                Privacy &amp; Data
              </h2>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F7F3ED] border border-[#E9DFD2] text-xs text-[#292929] tabular-nums">
            <Database className="w-3.5 h-3.5 text-[#B76545]" />
            <span>
              {wardrobeItems.length} {wardrobeItems.length === 1 ? 'garment' : 'garments'} ·{' '}
              {formatBytes(storage?.uploadsSizeBytes ?? 0)}
            </span>
          </div>
        </div>

        {wardrobeItems.length === 0 ? (
          <div className="py-8 px-4 rounded-xl bg-[#F7F3ED] border border-[#E9DFD2] text-center">
            <p className="text-sm font-medium text-[#292929]">No wardrobe images stored</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
              {wardrobeItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#F7F3ED] border border-[#E9DFD2]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.image_path}
                      alt={item.name}
                      className="w-12 h-12 rounded-lg object-cover border border-[#E9DFD2] shrink-0 bg-[#FFFEFC]"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#292929] truncate">{item.name}</p>
                      <p className="text-[11px] text-[#85817B] capitalize truncate">
                        {item.category} · {item.color}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={deletingItemId === item.id}
                    onClick={() => handleDeleteImage(item)}
                    aria-label={`Delete ${item.name}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-[#E9DFD2] bg-[#FFFEFC] text-red-700 hover:bg-red-50 hover:border-red-200 disabled:opacity-50 shrink-0 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    {deletingItemId === item.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#E9DFD2] flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#85817B]">
                Removing images deletes the stored photos and garment records from your wardrobe.
              </p>

              {!confirmClearAll ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete All Wardrobe Images
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-red-700">
                    Delete all {wardrobeItems.length} images?
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    disabled={clearingAll}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#E9DFD2] bg-[#F7F3ED] text-[#292929]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllImages}
                    disabled={clearingAll}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {clearingAll ? 'Clearing...' : 'Confirm Delete All'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* 4. About */}
      <section className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E9DFD2]">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-[#B76545]" />
            <h2 className="text-xl font-semibold text-[#292929] font-serif">About</h2>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-[#F7F3ED] border border-[#E9DFD2] text-[11px] font-mono text-[#292929]">
            Version 1.0.0
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[#F7F3ED] border border-[#E9DFD2] space-y-2">
            <p className="text-sm font-semibold text-[#292929]">StyleSync Personal Wardrobe</p>
            <p className="text-xs text-[#85817B] leading-relaxed">
              StyleSync helps you digitize your closet, organize garments by category and season,
              plan weekly looks on your wear calendar, and build weather-matched outfits every day.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F3ED] border border-[#E9DFD2] space-y-2">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#B76545]" />
              <p className="text-sm font-semibold text-[#292929]">Help &amp; Support</p>
            </div>
            <p className="text-xs text-[#85817B] leading-relaxed">
              Need help organizing your wardrobe, managing saved outfits, or troubleshooting your
              account? Reach out anytime.
            </p>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#292929] pt-1">
              <Mail className="w-3.5 h-3.5 text-[#B76545]" />
              <span>support@stylesync.app</span>
            </div>
          </div>
        </div>

        {/* Desktop Application Mode */}
        <div className="p-4 rounded-xl bg-[#F7F3ED] border border-[#E9DFD2] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-[#B76545]" />
              <p className="text-sm font-semibold text-[#292929]">
                Desktop Software Application
              </p>
            </div>
            <p className="text-xs text-[#85817B] leading-relaxed">
              {isElectron
                ? 'Running natively as a desktop software application with local SQLite and image storage.'
                : isInstalled
                  ? 'Running in standalone desktop app mode.'
                  : isInstallable
                    ? 'Install StyleSync directly to your desktop as a standalone window app, or build native Windows (.exe), macOS (.dmg), and Linux (.AppImage) packages via Electron.'
                    : 'Use your browser menu ("Install StyleSync" / "Add to Dock") to launch as a standalone desktop window, or package native installers with npm run desktop:win / desktop:mac.'}
            </p>
          </div>
          <div className="shrink-0">
            <DesktopInstallButton variant="settings" />
          </div>
        </div>
      </section>

      {/* 5. Log Out & 6. Delete Account */}
      <section className="bg-[#FFFEFC] border border-[#E9DFD2] rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E9DFD2]">
          <div>
            <h2 className="text-xl font-semibold text-[#292929] font-serif">Log Out</h2>
            <p className="text-xs text-[#85817B] mt-0.5">
              Sign out of your StyleSync account on this device. Your wardrobe remains saved.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogoutClick}
            disabled={loggingOut}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-medium bg-[#292929] text-[#FFFEFC] hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 text-[#B76545]" />
            {loggingOut ? 'Signing Out...' : 'Log Out'}
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <h2 className="text-xl font-semibold text-red-700 font-serif">Delete Account</h2>
              </div>
              <p className="text-xs text-[#85817B] mt-0.5">
                Permanently delete your account, profile, saved outfits, calendar plans, and all
                wardrobe images. This action cannot be undone.
              </p>
            </div>
            {!confirmDeleteOpen && (
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-medium border border-red-300 bg-red-50 text-red-700 hover:bg-red-100 whitespace-nowrap transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Account
              </button>
            )}
          </div>

          {confirmDeleteOpen && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50/70 space-y-3">
              <p className="text-xs font-medium text-red-900">
                To confirm permanent account deletion, type <span className="font-mono font-semibold">DELETE</span> below:
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="flex-1 px-3 py-2 text-sm bg-white border border-red-200 rounded-lg text-[#292929] focus:outline-none focus:border-red-500"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmDeleteOpen(false);
                      setDeleteConfirmText('');
                    }}
                    disabled={deletingAccount}
                    className="px-4 py-2 rounded-lg text-xs font-medium border border-[#E9DFD2] bg-[#FFFEFC] text-[#292929]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccountConfirm}
                    disabled={
                      deletingAccount || deleteConfirmText.trim().toUpperCase() !== 'DELETE'
                    }
                    className="px-4 py-2 rounded-lg text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 whitespace-nowrap"
                  >
                    {deletingAccount ? 'Deleting Account...' : 'Confirm Permanent Deletion'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          form="account-profile-form"
          disabled={savingProfile}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 disabled:opacity-60 transition-colors"
        >
          <Check className="w-3.5 h-3.5" />
          {savingProfile ? 'Saving Profile...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
}
