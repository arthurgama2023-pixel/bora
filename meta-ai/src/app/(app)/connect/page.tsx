import { Suspense } from "react";
import { ConnectView } from "@/components/connect/connect-view";

// Suspense necessário: ConnectView usa useSearchParams (feedback do OAuth).
export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectView />
    </Suspense>
  );
}
