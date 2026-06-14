import { useEffect, useState } from "react";

export default function ProductionBadge() {
  const [isProduction, setIsProduction] = useState(false);

  useEffect(() => {
    // Check if we're running on Vercel by looking for Vercel environment variables
    const isVercelEnv =
      typeof window !== "undefined" &&
      (window.location.hostname.includes("vercel.app") ||
        window.location.hostname.includes(".vercel.sh"));

    setIsProduction(isVercelEnv);
  }, []);

  if (!isProduction) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider"
      style={{
        background: "rgba(34, 197, 94, 0.15)",
        border: "1px solid rgba(34, 197, 94, 0.4)",
        color: "rgb(34, 197, 94)",
        backdropFilter: "blur(8px)",
      }}
    >
      PRODUCTION
    </div>
  );
}
