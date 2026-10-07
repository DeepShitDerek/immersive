import { AdminShell } from "@/features/admin-shell/admin-shell";

/** Guards every admin route and wraps it in the Personal OS shell. */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
