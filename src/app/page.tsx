import { WalletHeader } from "@/components/WalletHeader";
import { TabbedLayout } from "@/components/TabbedLayout";
import { DepositForm } from "@/components/DepositForm";
import { CoinFlipGame } from "@/components/CoinFlipGame";
import CashOutForm from "@/components/CashOutForm";
import { TransactionHistory } from "@/components/TransactionHistory";

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <WalletHeader>
        <TabbedLayout
          tabs={[
            { label: "Deposit", content: <DepositForm /> },
            { label: "Play", content: <CoinFlipGame /> },
            { label: "Cash-out", content: <CashOutForm /> },
            { label: "History", content: <TransactionHistory /> },
          ]}
        />
      </WalletHeader>
    </main>
  );
}
