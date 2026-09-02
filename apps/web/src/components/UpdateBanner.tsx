import { useRegisterSW } from 'virtual:pwa-register/react';

export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update(), 60 * 1000);
    },
  });

  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-3 bg-violet-deep px-4 py-2.5 text-white">
      <span className="text-sm">A new version of Scorer is available.</span>
      <button
        className="tap rounded bg-white px-3 py-1 text-sm font-bold text-violet-deep"
        onClick={() => updateServiceWorker(true)}
      >
        Update
      </button>
    </div>
  );
}
