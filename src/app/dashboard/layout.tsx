import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { requireStaff } from "@/server/auth/guards";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireStaff();
  } catch {
    redirect("/login?callbackUrl=/dashboard");
  }

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </>
  );
}
