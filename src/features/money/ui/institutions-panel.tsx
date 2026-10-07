"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/providers/confirm-dialog-provider";
import { getErrorMessage } from "@/lib/utils";
import type { Institution } from "../domain/model";
import { useDeleteInstitutionMutation } from "../data/money-api";
import { countryLabel } from "./labels";
import { useMoney } from "./money-context";

/**
 * The banks and institutions accounts are held at. They are added from an
 * account; this is where one that was mistyped or is no longer used is
 * removed. Its accounts stay, with no institution.
 */
export function InstitutionsPanel() {
  const { institutions, accounts } = useMoney();
  const confirm = useConfirm();
  const [remove] = useDeleteInstitutionMutation();

  if (institutions.length === 0) return null;

  const held = (institution: Institution) =>
    accounts.filter((a) => a.institutionId === institution.id).length;

  const destroy = async (institution: Institution) => {
    const count = held(institution);
    const ok = await confirm({
      title: `Remove ${institution.name}?`,
      description:
        count === 0
          ? "No account is held there."
          : `${count} account${count === 1 ? " is" : "s are"} held there. ${count === 1 ? "It stays" : "They stay"}, with no institution.`,
      confirmText: "Remove",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await remove(institution.id).unwrap();
      toast.success(`${institution.name} removed`);
    } catch (error) {
      toast.error("Couldn't remove it", {
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <section aria-labelledby="institutions-heading" className="space-y-3">
      <div>
        <h2
          id="institutions-heading"
          className="font-heading text-lg font-semibold"
        >
          Banks and institutions
        </h2>
        <p className="text-sm text-muted-foreground">
          Added when you set up an account. Remove one you no longer use.
        </p>
      </div>
      <ul className="divide-y rounded-surface border bg-card text-sm">
        {[...institutions]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((institution) => {
            const count = held(institution);
            return (
              <li
                key={institution.id}
                className="flex items-center gap-3 px-4 py-2"
              >
                <span className="min-w-0 flex-1 truncate font-medium">
                  {institution.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {countryLabel(institution.country)} · {count} account
                  {count === 1 ? "" : "s"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${institution.name}`}
                  onClick={() => destroy(institution)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            );
          })}
      </ul>
    </section>
  );
}
