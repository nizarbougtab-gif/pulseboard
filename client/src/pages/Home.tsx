import { useAuth } from "@/_core/hooks/useAuth";
import PulseBoardBrand, { PulseBoardMark } from "@/components/PulseBoardBrand";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  ArrowRight, Bed, BookOpen, Check, CheckCircle2, ClipboardCheck,
  Clock3, FileClock, MessageSquareText, ShieldCheck, Smartphone,
  Sparkles, Stethoscope, Users2,
} from "lucide-react";

const features = [
  { icon: Bed, title: "Le service en un regard", text: "Lits, consultations, patients critiques et sorties prévues réunis dans une vue mobile." },
  { icon: FileClock, title: "Une relève qui garde la mémoire", text: "Les événements de la garde sont structurés, horodatés et préparés pour l’équipe suivante." },
  { icon: MessageSquareText, title: "Des échanges reliés au patient", text: "Messages, alertes et décisions restent dans le contexte clinique au lieu de se perdre dans une conversation générale." },
  { icon: BookOpen, title: "Un carnet de stage personnel", text: "Cas anonymisés, gestes, notes et progression restent séparés du dossier collectif du service." },
  { icon: ClipboardCheck, title: "Des décisions traçables", text: "Les propositions, validations, refus et tâches terminées conservent leur auteur et leur date." },
  { icon: ShieldCheck, title: "Des droits selon le rôle", text: "Externe, interne, résident et médecin n’ont accès qu’aux actions correspondant à leurs responsabilités." },
];

const plans = [
  {
    name: "Essai gratuit",
    price: "0 FCFA",
    period: "",
    description: "Pour découvrir le carnet sans engagement et commencer à documenter son stage.",
    features: ["3 cas anonymisés maximum", "1 service ou rotation", "Notes et gestes", "Lecture permanente des cas enregistrés", "Accès mobile PWA"],
    action: "Commencer gratuitement",
  },
  {
    name: "Carnet Pro",
    price: "3 000 FCFA",
    period: "/ mois",
    description: "Pour les étudiants et professionnels qui veulent construire un carnet complet sans limite.",
    features: ["Cas anonymisés illimités", "Services et rotations multiples", "Gestes, notes et compétences", "Exports PDF et Excel", "Sauvegarde continue du carnet", "30 000 FCFA par an"],
    action: "Choisir Carnet Pro",
    highlighted: true,
  },
  {
    name: "Hall + Carnet",
    price: "5 000 FCFA",
    period: "/ utilisateur / mois",
    description: "Pour travailler avec l’équipe médicale tout en conservant son carnet personnel.",
    features: ["Tout le forfait Carnet Pro", "Hall collectif et gestion des lits", "Consultations, gardes et relèves", "Messagerie et alertes cliniques", "Journal des décisions", "Traçabilité des tâches"],
    action: "Choisir Hall + Carnet",
  },
];

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const isLocalPreview = typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);
  const appUrl = isAuthenticated
    ? "/dashboard"
    : isLocalPreview
      ? "https://pulseboardsn.com/login"
      : getLoginUrl("/dashboard");

  return (
    <div className="min-h-screen bg-[#f7faf8] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-white/90 backdrop-blur-xl">
        <div className="container flex h-18 items-center justify-between py-3">
          <PulseBoardBrand />
          <nav className="hidden items-center gap-7 text-sm text-slate-600 md:flex">
            <a href="#produit" className="hover:text-emerald-800">Le produit</a>
            <a href="#carnet" className="hover:text-emerald-800">Carnet de stage</a>
            <a href="#tarifs" className="hover:text-emerald-800">Tarifs</a>
          </nav>
          <div className="flex items-center gap-2">
            {!isAuthenticated && <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild><a href={appUrl}>Connexion</a></Button>}
            <Button size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800" onClick={() => isAuthenticated ? navigate("/dashboard") : window.location.assign(appUrl)}>
              {isAuthenticated ? "Ouvrir PulseBoard" : "Essayer gratuitement"}<ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-emerald-950/10 bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(16,185,129,.13),transparent_30%),radial-gradient(circle_at_10%_75%,rgba(245,158,11,.08),transparent_25%)]" />
          <div className="container relative grid gap-14 py-20 lg:grid-cols-[1.03fr_.97fr] lg:items-center lg:py-28">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                <Smartphone className="h-3.5 w-3.5" /> Conçu pour les équipes médicales sur le terrain
              </div>
              <h1 className="max-w-3xl text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-6xl lg:text-7xl">
                Le service avance.<br/><span className="text-emerald-700">La relève ne perd rien.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
                PulseBoard réunit le suivi collectif des patients, les gardes, les décisions et le carnet de stage personnel dans une application mobile simple.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="h-12 bg-emerald-700 px-7 text-white hover:bg-emerald-800" asChild><a href={appUrl}>Commencer gratuitement<ArrowRight className="ml-2 h-4 w-4" /></a></Button>
                <Button size="lg" variant="outline" className="h-12 px-7" asChild><a href="#produit">Découvrir le produit</a></Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-700"/>3 cas anonymisés gratuits</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-700"/>Installation PWA</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-700"/>Sans carte bancaire</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-xl">
              <div className="absolute -inset-5 rounded-[2rem] bg-emerald-200/35 blur-3xl" />
              <div className="relative overflow-hidden rounded-[1.75rem] border border-emerald-950/10 bg-[#f4f7f5] p-4 shadow-2xl shadow-emerald-950/15 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div><p className="text-sm font-bold">Urgences adultes</p><p className="text-xs text-slate-500">Garde en cours · 4 membres</p></div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800">EN DIRECT</span>
                </div>
                <div className="grid grid-cols-3 gap-2 py-4">
                  {[['18/24','Lits occupés'],['2','Critiques'],['4','Consultations']].map(([value,label])=><div key={label} className="rounded-xl border bg-white p-3"><p className="text-xl font-bold text-emerald-800">{value}</p><p className="mt-1 text-[10px] text-slate-500">{label}</p></div>)}
                </div>
                <div className="space-y-2">
                  <PatientRow bed="04" initials="M.D." detail="Surveillance respiratoire" status="Critique" critical />
                  <PatientRow bed="11" initials="A.N." detail="Contrôle glycémie à 09:00" status="Stable" />
                  <PatientRow bed="—" initials="C.S." detail="En attente d’un lit" status="Admis" />
                </div>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-900 p-3 text-white">
                  <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-emerald-300"/><div><p className="text-xs font-semibold">Résumé de garde prêt</p><p className="text-[10px] text-slate-400">5 événements · 3 points à transmettre</p></div></div>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="produit" className="container py-20 lg:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-700">Un seul fil de travail</p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Du premier patient à la relève du matin</h2>
            <p className="mt-4 text-slate-600">Chaque information reste au bon endroit, avec les actions autorisées selon le rôle de chacun.</p>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map(feature=><article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><feature.icon className="h-5 w-5"/></span><h3 className="mt-5 font-bold">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{feature.text}</p></article>)}
          </div>
        </section>

        <section id="carnet" className="border-y border-emerald-950/10 bg-slate-950 py-20 text-white lg:py-24">
          <div className="container grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300"><BookOpen className="h-6 w-6"/></span>
              <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">Le carnet qui se construit pendant que vous travaillez.</h2>
              <p className="mt-5 max-w-xl leading-7 text-slate-300">Importez un cas sous forme anonymisée, documentez les gestes réalisés et gardez vos apprentissages dans un espace personnel séparé du service.</p>
              <ul className="mt-8 space-y-4 text-sm text-slate-200">
                {['Initiales uniquement dans le carnet personnel','Gestes observés, supervisés ou réalisés en autonomie','Notes de stage et cas cliniques structurés','Historique personnel conservé entre les rotations'].map(item=><li key={item} className="flex gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300"/>{item}</li>)}
              </ul>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur sm:p-7">
              <div className="flex items-center justify-between"><div><p className="text-sm font-bold">Mon carnet</p><p className="text-xs text-slate-400">Rotation · Urgences adultes</p></div><span className="rounded-full bg-violet-400/15 px-3 py-1 text-[10px] font-bold text-violet-200">PRIVÉ</span></div>
              <div className="mt-6 grid grid-cols-3 gap-2"><MiniStat value="12" label="Cas"/><MiniStat value="18" label="Gestes"/><MiniStat value="7/10" label="Compétences"/></div>
              <div className="mt-4 space-y-2"><PortfolioRow initials="A.N." title="Paludisme grave" text="Ponction lombaire documentée"/><PortfolioRow initials="M.D." title="Détresse respiratoire" text="2 gestes · 1 note réflexive"/></div>
            </div>
          </div>
        </section>

        <section id="tarifs" className="container py-20 lg:py-28">
          <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-700">Lancement Sénégal</p><h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Commencez gratuitement, payez selon votre usage</h2><p className="mt-4 text-slate-600">Testez le carnet avec 3 cas anonymisés. Passez ensuite au carnet illimité ou rejoignez le hall collectif de votre service.</p></div>
          <div className="mx-auto mt-14 grid max-w-5xl gap-5 lg:grid-cols-3">
            {plans.map(plan=><article key={plan.name} className={`relative flex flex-col rounded-2xl border p-6 ${plan.highlighted?'border-emerald-700 bg-emerald-800 text-white shadow-xl shadow-emerald-900/15':'border-slate-200 bg-white'}`}>{plan.highlighted&&<span className="absolute -top-3 left-6 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-950">Recommandé</span>}<h3 className="text-lg font-bold">{plan.name}</h3><p className={`mt-2 min-h-12 text-sm ${plan.highlighted?'text-emerald-100':'text-slate-600'}`}>{plan.description}</p><div className="mt-6"><span className="text-3xl font-bold">{plan.price}</span><span className={`ml-1 text-xs ${plan.highlighted?'text-emerald-100':'text-slate-500'}`}>{plan.period}</span></div><ul className="my-7 flex-1 space-y-3">{plan.features.map(item=><li key={item} className="flex gap-2 text-sm"><Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlighted?'text-emerald-200':'text-emerald-700'}`}/>{item}</li>)}</ul><Button className={plan.highlighted?'bg-white text-emerald-800 hover:bg-emerald-50':'bg-emerald-700 text-white hover:bg-emerald-800'} asChild><a href={appUrl}>{plan.action}</a></Button></article>)}
          </div>
          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-slate-500">La limite gratuite bloque uniquement l’ajout d’un quatrième cas : les trois cas déjà enregistrés restent consultables. Les tarifs sont des offres de lancement et pourront évoluer pour les nouveaux abonnés.</p>
        </section>

        <section className="border-t border-emerald-950/10 bg-emerald-50 py-16">
          <div className="container flex flex-col items-center justify-between gap-7 text-center md:flex-row md:text-left"><div><h2 className="text-2xl font-bold">Commencez par un service pilote.</h2><p className="mt-2 text-slate-600">Invitez l’équipe, testez une garde et mesurez ce que PulseBoard vous fait gagner.</p></div><Button size="lg" className="bg-emerald-700 text-white hover:bg-emerald-800" asChild><a href={appUrl}>Lancer l’essai<ArrowRight className="ml-2 h-4 w-4"/></a></Button></div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-10"><div className="container flex flex-col items-center justify-between gap-6 md:flex-row"><PulseBoardBrand/><p className="text-center text-xs text-slate-500">© 2026 PulseBoard · Outil de coordination et de formation clinique</p><div className="flex gap-5 text-xs text-slate-500"><a href="#tarifs">Tarifs</a><a href="mailto:contact@pulseboardsn.com">Contact</a></div></div></footer>
    </div>
  );
}

function PatientRow({ bed, initials, detail, status, critical=false }: { bed:string; initials:string; detail:string; status:string; critical?:boolean }) { return <div className="flex items-center gap-3 rounded-xl border bg-white p-3"><div className="w-9 rounded-lg bg-slate-100 py-1 text-center text-[9px] text-slate-500">Lit<strong className="block text-sm text-slate-900">{bed}</strong></div><div className="min-w-0 flex-1"><p className="text-xs font-bold">{initials}</p><p className="truncate text-[10px] text-slate-500">{detail}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${critical?'bg-red-100 text-red-700':'bg-emerald-100 text-emerald-700'}`}>{status}</span></div> }
function MiniStat({ value,label }:{value:string;label:string}) { return <div className="rounded-xl bg-white/7 p-3"><p className="text-xl font-bold text-emerald-200">{value}</p><p className="text-[10px] text-slate-400">{label}</p></div> }
function PortfolioRow({initials,title,text}:{initials:string;title:string;text:string}) { return <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-violet-400/15 text-xs font-bold text-violet-200">{initials}</span><div><p className="text-xs font-semibold">{title}</p><p className="mt-0.5 text-[10px] text-slate-400">{text}</p></div></div> }
