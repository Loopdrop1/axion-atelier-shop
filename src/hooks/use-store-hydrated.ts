import { useEffect, useState } from "react";
interface PersistState {
  hasHydrated: () => boolean;
  onHydrate: (fn: () => void) => () => void;
  onFinishHydration: (fn: () => void) => () => void;
}
export function useStoreHydrated(persist: PersistState) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const start = persist.onHydrate(() => setHydrated(false));
    const finish = persist.onFinishHydration(() => setHydrated(true));
    setHydrated(persist.hasHydrated());
    return () => {
      start();
      finish();
    };
  }, [persist]);
  return hydrated;
}
