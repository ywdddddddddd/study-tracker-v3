import { AppSidebar } from "@/components/layout/sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-4 lg:p-6 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
