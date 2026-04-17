import WithdrawForm from "@/components/WithdrawForm";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-6">MVola Withdrawal Demo</h1>
      <WithdrawForm />
    </main>
  );
}
