"use client";

// Global client store — the small shared UI state (mobile nav, search panel,
// cart drawer, toast handoff) that lives across the storefront chrome.

import * as React from "react";

type StoreState = {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  searchOpen: boolean;
  setSearchSearchOpen: (open: boolean) => void;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  cartCount: number;
  setCartCount: (count: number) => void;
};

const StoreContext = React.createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [searchOpen, setSearchSearchOpen] = React.useState(false);
  const [cartDrawerOpen, setCartDrawerOpen] = React.useState(false);
  const [cartCount, setCartCount] = React.useState(0);

  // Lock body scroll while any overlay is open.
  React.useEffect(() => {
    const locked = mobileNavOpen || cartDrawerOpen;
    document.body.style.overflow = locked ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen, cartDrawerOpen]);

  // Hydration sentinel — the E2E suite waits for this attribute before
  // interacting, so clicks never race the React event wiring.
  React.useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);

  const value = React.useMemo<StoreState>(
    () => ({
      mobileNavOpen,
      setMobileNavOpen,
      searchOpen,
      setSearchSearchOpen,
      cartDrawerOpen,
      setCartDrawerOpen,
      cartCount,
      setCartCount,
    }),
    [mobileNavOpen, searchOpen, cartDrawerOpen, cartCount],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreState {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
