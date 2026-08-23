import Navbar from "@/components/Navbar";
import WalletGenerator from "@/components/WalletGenerator";
import DynamicDashboard from "@/components/DynamicDashboard";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-[92vh] max-w-7xl flex-col gap-4 p-4">
      <Navbar />
      <WalletGenerator />
      <DynamicDashboard />
    </main>
  );
}
