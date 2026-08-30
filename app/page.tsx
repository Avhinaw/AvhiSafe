import Navbar from "@/components/Navbar";
import WalletGenerator from "@/components/WalletGenerator";
import DynamicDashboard from "@/components/DynamicDashboard";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[92vh] w-full max-w-7xl flex-col gap-4 overflow-x-hidden px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
      <Navbar />
      <WalletGenerator />
      <DynamicDashboard />
    </main>
  );
}
