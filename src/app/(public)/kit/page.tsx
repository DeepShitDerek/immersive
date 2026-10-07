import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRODUCT } from "@/lib/product";
import { ProductPage } from "@/features/product/product-page";

export const metadata: Metadata = {
  title: PRODUCT.name,
  description: `${PRODUCT.name} — a developer portfolio and a private workspace in one repo. Static hosting for free; connect Supabase for the workspace.`,
};

/** /kit — the product page for Foliokit, when this site sells it. */
export default function Page() {
  if (!PRODUCT.show) notFound();
  return <ProductPage />;
}
