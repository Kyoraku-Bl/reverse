import type { Metadata } from "next";
import { getCategories } from "@/lib/data";
import { FavouritesBrowser } from "@/components/FavouritesBrowser";

export const metadata: Metadata = {
  title: "Your favourites",
  description: "The prompts you saved, stored in your browser only. No account, nothing uploaded.",
  robots: { index: false, follow: true },
};

export default function FavouritesPage() {
  return <FavouritesBrowser categories={getCategories()} />;
}
