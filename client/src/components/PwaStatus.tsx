import { Download, Share2, WifiOff, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "pulseboard-install-dismissed";

export default function PwaStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "true");
  const [installed, setInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  };

  return (
    <>
      {!online && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-red-600 text-white px-4 py-2.5 text-center text-xs font-semibold shadow-md">
          <WifiOff className="w-4 h-4 inline mr-2" />
          Connexion Internet requise — les dossiers patients ne sont pas disponibles hors ligne.
        </div>
      )}

      {!installed && !dismissed && online && (installPrompt || isIos) && (
        <div className="fixed z-[90] bottom-20 md:bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-[390px] rounded-xl border bg-white p-3 shadow-xl">
          <button onClick={dismiss} className="absolute right-2 top-2 p-1 text-muted-foreground" aria-label="Fermer">
            <X className="w-4 h-4" />
          </button>
          <div className="flex gap-3 pr-5">
            <img src="/icons/icon-96.png" alt="PulseBoard" className="w-12 h-12 rounded-xl" />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Installer PulseBoard</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isIos && !installPrompt
                  ? "Dans Safari, touchez Partager puis « Sur l’écran d’accueil »."
                  : "Ajoutez PulseBoard à votre écran d’accueil pour l’ouvrir comme une application."}
              </p>
              {installPrompt ? (
                <button onClick={install} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--pulseboard-green)] px-3 py-1.5 text-xs font-semibold text-white">
                  <Download className="w-3.5 h-3.5" /> Installer
                </button>
              ) : (
                <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--pulseboard-green)]">
                  <Share2 className="w-3.5 h-3.5" /> Partager → Sur l’écran d’accueil
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
