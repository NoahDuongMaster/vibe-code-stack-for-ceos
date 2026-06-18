// Web3 route group — add blockchain providers here when needed
// Example: Solana wallet, Wagmi/RainbowKit for EVM, etc.
// This layout wraps ONLY routes inside (web3)/ — root layout stays clean

export default function Web3Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
