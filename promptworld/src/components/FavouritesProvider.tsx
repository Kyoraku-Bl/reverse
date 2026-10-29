"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useFavourites, type Favourites } from "@/lib/favourites";

const FavouritesContext = createContext<Favourites | null>(null);

export function FavouritesProvider({ children }: { children: ReactNode }) {
  const value = useFavourites();
  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
}

export function useFavouritesContext(): Favourites {
  const value = useContext(FavouritesContext);
  if (!value) {
    // Outside the provider (unit tests, stray renders) behave as an empty store
    // rather than throwing — favourites are never essential to the page.
    return { slugs: [], set: new Set(), has: () => false, toggle: () => {}, clear: () => {}, ready: true };
  }
  return value;
}
