import Navbar from "@/components/Navbar";
import WalletGenerator from "@/components/WalletGenerator";
import PortfolioDashboard from "@/components/PortfolioDashboard";
import SecurityCenter from "@/components/SecurityCenter";
import ConnectedWallets from "@/components/ConnectedWallets";

export default function Home() {
  return (
    <main className="max-w-7xl mx-auto flex flex-col gap-4 p-4 min-h-[92vh]">
      <Navbar />
      <WalletGenerator />
      <ConnectedWallets />
      <PortfolioDashboard />
      <SecurityCenter />
    </main>
  );
}
