import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Clock3 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const plans = [
  { key: "free", name: "Essai gratuit", price: "0 FCFA", items: ["3 cas anonymisés", "1 rotation", "Lecture conservée après la limite"] },
  { key: "carnet_pro", name: "Carnet Pro", price: "3 500 FCFA/mois", annualPrice: "35 000 FCFA/an", items: ["Cas et rotations illimités", "Gestes, compétences et notes", "Exports du portfolio"] },
] as const;

export default function SubscriptionLaunch() {
  const [, navigate] = useLocation();
  const { data, refetch } = trpc.billing.status.useQuery();
  const request = trpc.billing.requestPayment.useMutation({
    onSuccess: response => {
      toast.success(response.message);
      if (response.paymentLink) window.open(response.paymentLink, "_blank", "noopener,noreferrer");
      refetch();
    },
    onError: error => toast.error(error.message),
  });

  return <main className="min-h-screen bg-[#f7f8f6] p-4 md:p-8"><div className="mx-auto max-w-5xl">
    <Button variant="ghost" onClick={() => navigate("/mon-stage")}><ArrowLeft className="mr-2 h-4 w-4"/>Retour au carnet</Button>
    <div className="my-7"><h1 className="text-3xl font-bold">Mon offre PulseBoard</h1><p className="mt-2 text-muted-foreground">Votre carnet reste consultable même lorsque la limite gratuite est atteinte.</p>{data && <div className="mt-4 flex flex-wrap gap-2"><Badge>Offre : {data.plan === "carnet_pro" ? "Carnet Pro" : "Essai gratuit"}</Badge><Badge variant="outline">{data.usage.cases}/3 cas gratuits utilisés</Badge></div>}</div>
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map(plan => <Card key={plan.key} className={data?.plan === plan.key ? "border-[var(--pulseboard-green)] ring-1 ring-[var(--pulseboard-green)]" : ""}><CardHeader><CardTitle>{plan.name}</CardTitle><p className="text-xl font-bold">{plan.price}</p>{"annualPrice" in plan && <p className="text-sm text-muted-foreground">ou {plan.annualPrice}</p>}</CardHeader><CardContent className="space-y-5"><ul className="space-y-2 text-sm">{plan.items.map(item => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pulseboard-green)]"/>{item}</li>)}</ul>{plan.key === "free" ? <Button variant="outline" className="w-full" disabled>Offre de départ</Button> : <div className="grid gap-2"><Button className="w-full" disabled={request.isPending} onClick={() => request.mutate({ plan: "carnet_pro", billingCycle: "monthly" })}>Choisir au mois</Button><Button variant="outline" className="w-full" disabled={request.isPending} onClick={() => request.mutate({ plan: "carnet_pro", billingCycle: "annual" })}>Choisir à l’année</Button></div>}</CardContent></Card>)}
      <Card className="border-amber-200 bg-amber-50/60"><CardHeader><div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-amber-800"><Clock3 className="h-4 w-4"/>Bientôt disponible</div><CardTitle>Hall + Carnet</CardTitle><p className="text-xl font-bold">6 000 FCFA/utilisateur/mois</p><p className="text-sm text-muted-foreground">ou 60 000 FCFA/utilisateur/an au lancement</p></CardHeader><CardContent className="space-y-5"><ul className="space-y-2 text-sm">{["Tout le Carnet Pro", "Espace collectif du service", "Gardes, relève et traçabilité"].map(item => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"/>{item}</li>)}</ul><Button variant="outline" className="w-full border-amber-300 bg-white" onClick={() => navigate("/hall")}>Rejoindre la liste d’attente</Button></CardContent></Card>
    </div>
    <p className="mt-6 text-xs text-muted-foreground">La demande Carnet Pro ouvre Wave uniquement lorsque le compte marchand est configuré. Aucun abonnement n’est activé sans confirmation du paiement.</p>
  </div></main>;
}
