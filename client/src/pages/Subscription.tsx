import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const plans = [
  { key: "free", name: "Essai gratuit", price: "0 FCFA", items: ["3 cas anonymisés", "1 rotation", "Lecture conservée après la limite"] },
  { key: "carnet_pro", name: "Carnet Pro", price: "3 000 FCFA/mois", items: ["Cas et rotations illimités", "Gestes, compétences et notes", "Exports du portfolio"] },
  { key: "hall_carnet", name: "Hall + Carnet", price: "5 000 FCFA/utilisateur/mois", items: ["Tout le Carnet Pro", "Espace collectif du service", "Gardes, relève et traçabilité"] },
] as const;

export default function Subscription() {
  const [, navigate] = useLocation();
  const { data, refetch } = trpc.billing.status.useQuery();
  const request = trpc.billing.requestPayment.useMutation({ onSuccess: response => { toast.success(response.message); if (response.paymentLink) window.open(response.paymentLink, "_blank", "noopener,noreferrer"); refetch(); }, onError: error => toast.error(error.message) });
  return <main className="min-h-screen bg-[#f7f8f6] p-4 md:p-8"><div className="max-w-5xl mx-auto"><Button variant="ghost" onClick={() => navigate("/profile")}><ArrowLeft className="w-4 h-4 mr-2" />Retour</Button><div className="my-7"><h1 className="text-3xl font-bold">Mon offre PulseBoard</h1><p className="text-muted-foreground mt-2">Votre carnet reste consultable même lorsque la limite gratuite est atteinte.</p>{data && <div className="mt-4 flex gap-2 flex-wrap"><Badge>Offre : {data.plan}</Badge><Badge variant="outline">{data.usage.cases}/3 cas gratuits utilisés</Badge></div>}</div><div className="grid md:grid-cols-3 gap-4">{plans.map(plan => <Card key={plan.key} className={data?.plan === plan.key ? "border-[var(--pulseboard-green)] ring-1 ring-[var(--pulseboard-green)]" : ""}><CardHeader><CardTitle>{plan.name}</CardTitle><p className="text-xl font-bold">{plan.price}</p></CardHeader><CardContent className="space-y-5"><ul className="space-y-2 text-sm">{plan.items.map(item => <li key={item} className="flex gap-2"><Check className="w-4 h-4 text-[var(--pulseboard-green)] shrink-0 mt-0.5" />{item}</li>)}</ul>{plan.key === "free" ? <Button variant="outline" className="w-full" disabled>Offre de départ</Button> : <Button className="w-full" disabled={request.isPending} onClick={() => request.mutate({ plan: plan.key, billingCycle: "monthly" })}>Choisir cette offre</Button>}</CardContent></Card>)}</div><p className="text-xs text-muted-foreground mt-6">Le bouton enregistre une demande et ouvre Wave uniquement lorsque le compte marchand est configuré. Aucun abonnement n'est activé sans confirmation du paiement.</p></div></main>;
}
