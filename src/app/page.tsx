import CashOutForm from "@/components/CashOutForm";
import { WalletHeader } from "@/components/WalletHeader";

export default function Home() {
  return (
    <WalletHeader>
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold mb-6">MVola Cash-Out Demo</h1>
        <CashOutForm />
      </main>
    </WalletHeader>
  );
}
