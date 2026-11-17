import { Download, FolderOpen, Monitor, X } from 'lucide-react';
import { useState } from 'react';
import { useDesktopApp } from '../hooks/useDesktopApp';

interface DesktopInstallButtonProps {
  variant?: 'sidebar' | 'settings';
}

export function DesktopInstallButton({ variant = 'sidebar' }: DesktopInstallButtonProps) {
  const { isElectron, isInstallable, isInstalled, isIOS, installDesktopApp, openDataFolder } =
    useDesktopApp();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isElectron) {
    if (variant === 'sidebar') return null;
    return (
      <button
        type="button"
        onClick={() => void openDataFolder()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-[#292929] text-[#FFFEFC] hover:opacity-90 transition-opacity whitespace-nowrap"
      >
        <FolderOpen className="w-3.5 h-3.5 text-[#B76545]" />
        Open Local Data Folder
      </button>
    );
  }

  if (isInstalled && variant === 'sidebar') {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void installDesktopApp()}
        className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
          variant === 'sidebar'
            ? 'w-full bg-[#292929] text-[#FFFEFC] hover:opacity-90'
            : 'bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 px-4'
        }`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        Install Desktop App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuideModal(true)}
          className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-[#E9DFD2] bg-[#F7F3ED] text-[#292929] hover:border-[#B76545] transition-colors whitespace-nowrap ${
            variant === 'sidebar' ? 'w-full' : 'px-4'
          }`}
        >
          <Monitor className="w-3.5 h-3.5 text-[#B76545]" />
          Install App
        </button>

        {showGuideModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292929]/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-[#FFFEFC] border border-[#E9DFD2] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#292929] font-serif">
                  Install StyleSync App
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  aria-label="Close"
                  className="p-1 text-[#85817B] hover:text-[#292929]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-[#85817B] leading-relaxed">
                1. Tap the <strong>Share</strong> button in Safari&apos;s toolbar.
                <br />
                2. Select <strong>Add to Home Screen</strong> to launch StyleSync in its own window.
              </p>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2 rounded-lg text-xs font-medium bg-[#292929] text-[#FFFEFC]"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}

export function OfflineIndicator() {
  const { isOnline } = useDesktopApp();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-lg bg-[#292929] border border-[#E9DFD2]/30 px-3.5 py-2 text-xs font-medium text-[#FFFEFC] shadow-sm">
      <span className="h-2 w-2 rounded-full bg-[#B76545] animate-pulse" />
      Offline Mode — Local cached assets active
    </div>
  );
}
