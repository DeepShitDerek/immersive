import { MfaSetup } from "@/features/admin-auth/mfa-setup";

export const metadata = { title: "Set up two-factor authentication" };

export default function Page() {
  return <MfaSetup />;
}
