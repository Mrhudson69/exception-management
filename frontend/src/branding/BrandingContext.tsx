import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { branding as brandingApi, Branding } from "../api/client";

const DEFAULT: Branding = {
  appName: "System Ops",
  productName: "OpsConsole",
  tagline: "Exception Management",
  logo: null,
};

interface BrandingState {
  branding: Branding;
  refresh: () => Promise<void>;
  setBranding: (b: Branding) => void;
}

const BrandingCtx = createContext<BrandingState>({ branding: DEFAULT, refresh: async () => {}, setBranding: () => {} });

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<Branding>(DEFAULT);

  async function refresh() {
    try {
      setBrand(await brandingApi.get());
    } catch {
      /* keep defaults */
    }
  }
  useEffect(() => {
    refresh();
    document.title = `${brand.productName} — ${brand.tagline}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the tab title in sync when branding changes.
  useEffect(() => {
    document.title = `${brand.productName} — ${brand.tagline}`;
  }, [brand.productName, brand.tagline]);

  return <BrandingCtx.Provider value={{ branding: brand, refresh, setBranding: setBrand }}>{children}</BrandingCtx.Provider>;
}

export const useBranding = () => useContext(BrandingCtx);
