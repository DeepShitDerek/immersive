import portfolioConfig from "../../portfolio.config";

/**
 * Foliokit as a product: whether this site sells it, and on what terms.
 *
 * Read from `portfolio.config.ts` at build time — it is the owner's offer, not
 * site content a visitor edits, so it does not live in the database. A site
 * built *with* Foliokit sets `show: false` and loses /kit. The "Built with
 * Foliokit" line is not part of this: the build adds it to every public page
 * (scripts/finalize-export.mjs).
 */

export interface ProductPlan {
  name: string;
  /** As the owner wants it shown: "Free", "$49", "Let's talk". */
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  highlighted?: boolean;
}

export interface ProductConfig {
  show: boolean;
  name: string;
  repoUrl: string;
  plans: ProductPlan[];
}

const configured = (
  portfolioConfig as unknown as {
    product?: Partial<ProductConfig>;
  }
).product;

export const PRODUCT: ProductConfig = {
  show: configured?.show ?? false,
  name: configured?.name?.trim() || "Foliokit",
  repoUrl: configured?.repoUrl ?? "",
  plans: configured?.plans ?? [],
};
