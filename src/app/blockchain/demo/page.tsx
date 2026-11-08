import { OwnershipDemoEntry } from "@/components/ownership-demo/ownership-demo-entry";

export const metadata = {
  title: "Blockchain demo & testnet proof | Aarvasa",
  description: "Explore Aarvasa's interactive property prototype and read-only Base Sepolia evidence. Synthetic assets only; no real investment or property ownership.",
  robots: { index: false, follow: true },
};
export default function BlockchainDemoPage() {
  return <OwnershipDemoEntry />;
}
