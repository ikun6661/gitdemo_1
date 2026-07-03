import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import {
  AuthRequiredError,
  PermissionDeniedError,
  requireStaff,
} from "@/server/auth/guards";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireStaff();
  } catch (error: unknown) {
    if (error instanceof AuthRequiredError || error instanceof PermissionDeniedError) {
      redirect("/login?callbackUrl=/dashboard");
    }

    throw error;
  }

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </>
  );
}
