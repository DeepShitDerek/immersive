import { MfaChallenge } from "@/features/admin-auth/mfa-challenge";

export const metadata = { title: "Two-factor check" };

export default function Page() {
  return <MfaChallenge />;
}
