import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await isAuthenticated();

  if (!authenticated) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-[#06060E] relative overflow-hidden">
      {/* Decorative background blurs */}
      <div className="absolute top-[-20%] right-[-20%] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle,rgba(45,212,191,0.03)_0%,rgba(0,0,0,0)_70%)] pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] left-[-20%] w-[60vw] h-[60vw] rounded-full bg-[radial-gradient(circle,rgba(240,160,32,0.03)_0%,rgba(0,0,0,0)_70%)] pointer-events-none z-0" />

      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto relative z-10">
        {children}
      </main>
    </div>
  );
}
