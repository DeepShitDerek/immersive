import type { Bucket, Category } from "./model";

/**
 * Categories: a starter set for someone living alone in Canada with
 * family and money in India, and the tree helpers the pickers use.
 *
 * `bucket` is the 50/30/20 shape; `isEssential` is the runway question —
 * would this still be paid if income stopped tomorrow? Rent is both a need
 * and essential; a gym is a want and not; sending money home is a need for
 * many people and is left for the owner to decide (it is a `want` here only
 * because the default must be one of the two — the guide says to change it).
 */

export interface CategorySeed {
  name: string;
  bucket: Bucket;
  isEssential: boolean;
  children?: string[];
}

export const STARTER_CATEGORIES: readonly CategorySeed[] = [
  {
    name: "Salary",
    bucket: "income",
    isEssential: false,
    children: ["Paycheque", "Bonus"],
  },
  {
    name: "Other income",
    bucket: "income",
    isEssential: false,
    children: [
      "Interest",
      "Dividends",
      "Tax refund",
      "Gifts received",
      "Side work",
    ],
  },
  {
    name: "Housing",
    bucket: "need",
    isEssential: true,
    children: ["Rent", "Tenant insurance", "Hydro", "Internet", "Heat & gas"],
  },
  { name: "Groceries", bucket: "need", isEssential: true },
  {
    name: "Transport",
    bucket: "need",
    isEssential: true,
    children: ["Transit pass", "Fuel", "Car insurance", "Parking", "Rideshare"],
  },
  { name: "Phone", bucket: "need", isEssential: true },
  {
    name: "Health",
    bucket: "need",
    isEssential: true,
    children: ["Pharmacy", "Dental", "Vision", "Therapy"],
  },
  {
    name: "Debt payments",
    bucket: "need",
    isEssential: true,
    children: ["Loan interest", "Card interest"],
  },
  {
    name: "Immigration & documents",
    bucket: "need",
    isEssential: false,
    children: ["Permit & PR fees", "Passport & OCI", "Translations"],
  },
  { name: "Bank & transfer fees", bucket: "need", isEssential: false },
  {
    name: "Dining out",
    bucket: "want",
    isEssential: false,
    children: ["Restaurants", "Coffee", "Delivery"],
  },
  {
    name: "Shopping",
    bucket: "want",
    isEssential: false,
    children: ["Clothes", "Electronics", "Household"],
  },
  { name: "Subscriptions", bucket: "want", isEssential: false },
  {
    name: "Fun & fitness",
    bucket: "want",
    isEssential: false,
    children: ["Gym", "Events", "Hobbies"],
  },
  {
    name: "Travel",
    bucket: "want",
    isEssential: false,
    children: ["Flights home", "Trips"],
  },
  {
    name: "Family in India",
    bucket: "want",
    isEssential: false,
    children: ["Support for parents", "Gifts", "Festivals"],
  },
  { name: "Learning", bucket: "want", isEssential: false },
  {
    name: "Savings & investing",
    bucket: "save",
    isEssential: false,
    children: ["Emergency fund", "Retirement", "Down payment"],
  },
];

export interface CategoryOption {
  category: Category;
  /** "Housing › Rent". */
  label: string;
  depth: 0 | 1;
}

/**
 * Parents then their children, each group in sort order — the order a
 * picker lists them in. Archived categories are left out unless asked for;
 * a child of an archived parent is archived with it.
 */
export function categoryOptions(
  categories: readonly Category[],
  { includeArchived = false }: { includeArchived?: boolean } = {},
): CategoryOption[] {
  const byOrder = (a: Category, b: Category) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
  const visible = (c: Category) => includeArchived || !c.archivedAt;
  const parents = categories
    .filter((c) => !c.parentId && visible(c))
    .sort(byOrder);
  const options: CategoryOption[] = [];
  for (const parent of parents) {
    options.push({ category: parent, label: parent.name, depth: 0 });
    for (const child of categories
      .filter((c) => c.parentId === parent.id && visible(c))
      .sort(byOrder)) {
      options.push({
        category: child,
        label: `${parent.name} › ${child.name}`,
        depth: 1,
      });
    }
  }
  return options;
}

/** The top-level category a category rolls up to (itself for a parent). */
export function rootOf(
  categoryId: string,
  byId: ReadonlyMap<string, Category>,
): string {
  const category = byId.get(categoryId);
  return category?.parentId ?? categoryId;
}

export function categoryLabel(
  categoryId: string | null,
  byId: ReadonlyMap<string, Category>,
): string {
  if (!categoryId) return "Uncategorised";
  const category = byId.get(categoryId);
  if (!category) return "Unknown category";
  const parent = category.parentId ? byId.get(category.parentId) : undefined;
  return parent ? `${parent.name} › ${category.name}` : category.name;
}
