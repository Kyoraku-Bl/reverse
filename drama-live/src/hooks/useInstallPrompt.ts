import { useCallback, useEffect, useRef, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** Exposes the PWA install prompt when the browser offers one. */
export function useInstallPrompt() {
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches ?? false);
  const eventRef = useRef<InstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      eventRef.current = event as InstallPromptEvent;
      setAvailable(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setAvailable(false);
      eventRef.current = null;
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const prompt = useCallback(async () => {
    const event = eventRef.current;
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setAvailable(false);
  }, []);

  return { available, installed, prompt };
}
