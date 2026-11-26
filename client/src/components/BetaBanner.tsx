import { AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { BETA_MODE } from "@/lib/features";

export default function BetaBanner() {
  if (!BETA_MODE) return null;

  return (
    <div
      role="status"
      aria-label="Avertissement version bêta"
      className="fixed inset-x-0 top-0 z-[100] flex h-12 items-center justify-center gap-2 border-b border-amber-300 bg-amber-100 px-3 text-center text-[11px] font-semibold text-amber-950 shadow-sm sm:text-sm"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Version bêta — patients entièrement fictifs uniquement. Ne saisissez aucune donnée d’un patient réel.</span>
      <Link href="/privacy" className="shrink-0 underline underline-offset-2 hover:text-amber-700">
        Règles
      </Link>
    </div>
  );
}
