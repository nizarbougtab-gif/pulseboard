import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BellRing, CheckCircle2, Clock3, ShieldCheck, Users2 } from "lucide-react";
import PulseBoardBrand from "@/components/PulseBoardBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";

export default function HallComingSoon() {
  const [, navigate] = useLocation();
  const [sent, setSent] = useState(false);
  const [consent, setConsent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", medicalRole: "interne" as "externe" | "interne" | "resident" | "medecin", hospitalName: "", serviceName: "" });
  const waitlist = trpc.launch.joinHallWaitlist.useMutation({ onSuccess: () => setSent(true) });

  return <main className="min-h-screen bg-[#f7faf8] text-slate-950">
    <header className="border-b border-emerald-950/10 bg-white"><div className="container flex h-16 items-center justify-between"><PulseBoardBrand/><Button variant="ghost" onClick={() => navigate("/mon-stage")}><ArrowLeft className="mr-2 h-4 w-4"/>Mon carnet</Button></div></header>
    <section className="container grid gap-10 py-12 lg:grid-cols-[.9fr_1.1fr] lg:items-start lg:py-20">
      <div className="lg:sticky lg:top-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900"><Clock3 className="h-4 w-4"/>Bientôt disponible</span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">Le Hall de service se prépare.</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">PulseBoard développera un espace collectif pour les gardes, la relève et le suivi d’équipe. Le carnet personnel est déjà disponible aujourd’hui.</p>
        <div className="mt-8 space-y-4 text-sm text-slate-700">
          <p className="flex gap-3"><Users2 className="h-5 w-5 shrink-0 text-emerald-700"/>Coordination des internes, résidents et médecins d’un même service.</p>
          <p className="flex gap-3"><BellRing className="h-5 w-5 shrink-0 text-emerald-700"/>Relèves, tâches et alertes regroupées dans un fil traçable.</p>
          <p className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700"/>Ouverture progressive après validation du fonctionnement et de la protection des données.</p>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-emerald-950/5 sm:p-8">
        {sent ? <div className="py-12 text-center"><CheckCircle2 className="mx-auto h-14 w-14 text-emerald-700"/><h2 className="mt-5 text-2xl font-bold">Votre service est inscrit</h2><p className="mx-auto mt-3 max-w-md text-slate-600">Nous vous contacterons lorsque le Hall sera prêt pour les premiers services pilotes.</p><Button className="mt-7 bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => navigate("/mon-stage")}>Continuer dans mon carnet</Button></div> : <>
          <h2 className="text-2xl font-bold">Rejoindre la liste d’attente</h2><p className="mt-2 text-sm text-slate-600">Une seule inscription suffit par personne. Vous pourrez actualiser vos informations avec la même adresse e-mail.</p>
          <form className="mt-7 grid gap-5 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); waitlist.mutate({ ...form, phone: form.phone || undefined, consent: true }); }}>
            <div className="space-y-2 sm:col-span-2"><Label>Nom complet</Label><Input required minLength={2} value={form.name} onChange={event => setForm(current => ({...current,name:event.target.value}))}/></div>
            <div className="space-y-2"><Label>Adresse e-mail</Label><Input required type="email" value={form.email} onChange={event => setForm(current => ({...current,email:event.target.value}))}/></div>
            <div className="space-y-2"><Label>Téléphone (facultatif)</Label><Input type="tel" value={form.phone} onChange={event => setForm(current => ({...current,phone:event.target.value}))}/></div>
            <div className="space-y-2 sm:col-span-2"><Label>Profil</Label><Select value={form.medicalRole} onValueChange={(value:any) => setForm(current => ({...current,medicalRole:value}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="externe">Étudiant / Externe</SelectItem><SelectItem value="interne">Interne</SelectItem><SelectItem value="resident">Résident</SelectItem><SelectItem value="medecin">Médecin</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Hôpital</Label><Input required minLength={2} value={form.hospitalName} onChange={event => setForm(current => ({...current,hospitalName:event.target.value}))}/></div>
            <div className="space-y-2"><Label>Service</Label><Input required minLength={2} value={form.serviceName} onChange={event => setForm(current => ({...current,serviceName:event.target.value}))}/></div>
            <label className="flex items-start gap-3 text-xs leading-5 text-slate-600 sm:col-span-2"><Checkbox checked={consent} onCheckedChange={value => setConsent(value === true)} className="mt-0.5"/><span>J’accepte que PulseBoard utilise ces coordonnées uniquement pour me prévenir du lancement du Hall. Je peux demander leur suppression à tout moment.</span></label>
            {waitlist.error && <p className="text-sm text-red-700 sm:col-span-2">{waitlist.error.message}</p>}
            <Button type="submit" disabled={!consent || waitlist.isPending} className="h-11 bg-emerald-700 text-white hover:bg-emerald-800 sm:col-span-2">{waitlist.isPending ? "Inscription…" : "Prévenir mon service au lancement"}</Button>
          </form>
        </>}
      </div>
    </section>
  </main>;
}
