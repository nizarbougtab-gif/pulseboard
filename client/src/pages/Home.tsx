import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Activity, Shield, Clock, Users, Bed, AlertTriangle,
  MessageSquare, FileText, ChevronRight, Heart, Building2,
  Stethoscope, Star, CheckCircle, Zap, Phone
} from "lucide-react";

const hospitals = [
  { name: "CHU Aristide Le Dantec", city: "Dakar" },
  { name: "CHU de Fann", city: "Dakar" },
  { name: "Hôpital Principal de Dakar", city: "Dakar" },
  { name: "CHR de Thiès", city: "Thiès" },
  { name: "Hôpital de Ziguinchor", city: "Ziguinchor" },
  { name: "Hôpital de Tambacounda", city: "Tambacounda" },
  { name: "Centre de Santé de Pikine", city: "Pikine" },
  { name: "Hôpital Abass Ndao", city: "Dakar" },
];

const roles = [
  {
    title: "Externe",
    description: "Apprenez les bases en participant à la prise en charge des patients. Consultez les fiches, suivez les évolutions.",
    icon: "🎓",
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "Interne",
    description: "Gérez vos 20 patients du service, rédigez vos notes DAR/SOAP et préparez la relève en un tap.",
    icon: "🩺",
    color: "bg-green-50 text-green-600",
  },
  {
    title: "Résident",
    description: "Supervisez l'équipe, validez les décisions critiques et assurez la continuité des soins entre les gardes.",
    icon: "📋",
    color: "bg-purple-50 text-purple-600",
  },
  {
    title: "Chef de service",
    description: "Vue d'ensemble sur tous vos services, indicateurs de qualité et communication centralisée avec votre équipe.",
    icon: "👨‍⚕️",
    color: "bg-amber-50 text-amber-600",
  },
];

const features = [
  {
    title: "Tableau de bord intelligent",
    description: "Vue instantanée de vos lits, alertes actives et états des patients. Tout ce qu'il faut voir, dès l'ouverture.",
    icon: Activity,
  },
  {
    title: "Gestion des lits en temps réel",
    description: "Chaque patient, son lit, son statut. Visualisez l'occupation du service d'un seul regard.",
    icon: Bed,
  },
  {
    title: "Alertes automatiques",
    description: "DPS manquante, allergie non documentée, sortie prévue — rien ne vous échappe même à 3h du matin.",
    icon: AlertTriangle,
  },
  {
    title: "Relève en 10 secondes",
    description: "Générée automatiquement par priorité (Critiques → Modérés → Stables). Copie WhatsApp et export PDF médico-légal.",
    icon: FileText,
  },
  {
    title: "Messagerie d'équipe sécurisée",
    description: "Chat interne lié au service. Logs automatiques des admissions et décisions cliniques horodatées.",
    icon: MessageSquare,
  },
  {
    title: "Données protégées",
    description: "Accès limité à votre équipe. Zéro données sur des serveurs non sécurisés, zéro WhatsApp avec des noms de patients.",
    icon: Shield,
  },
];

const problems = [
  {
    icon: "📓",
    title: "Le carnet papier perdu",
    description: "Vous retrouvez le carnet de l'interne de nuit sous une pile de bilans. Les décisions de 2h du matin sont illisibles.",
    fix: "Fiche patient numérique, synchronisée, lisible par toute l'équipe.",
  },
  {
    icon: "📱",
    title: "WhatsApp groupe du service",
    description: "\"Lit 7 allergie pénicilline\" entre les blagues et les vidéos. Un message critique noyé dans 200 autres.",
    fix: "Messagerie dédiée avec logs cliniques automatiques et alertes visuelles.",
  },
  {
    icon: "🔄",
    title: "La relève chaotique",
    description: "45 minutes à rassembler les feuilles, interroger tout le monde, répéter les mêmes infos. La garde suivante repart dans le flou.",
    fix: "Relève structurée générée automatiquement. Copiée sur WhatsApp en 1 tap.",
  },
  {
    icon: "⚠️",
    title: "L'allergie oubliée",
    description: "Le patient de Oumar Ndiaye est allergique à l'amoxicilline. L'interne de remplacement ne le sait pas. Le dossier était en cardiologie.",
    fix: "Bandeau rouge d'allergie visible sur toutes les fiches, impossible à rater.",
  },
];

const testimonials = [
  {
    quote: "Avant PulseBoard, notre relève durait 1h. Maintenant en 10 minutes c'est bouclé. Les internes arrivent préparés, les patients sont mieux pris en charge.",
    name: "Dr. Aminata Sow",
    role: "Chef de Service Cardiologie",
    hospital: "CHU de Fann, Dakar",
    initials: "AS",
  },
  {
    quote: "J'ai perdu un carnet de garde avec les allergies de 15 patients en pleine semaine chargée. Depuis PulseBoard, c'est une situation qui ne peut plus arriver.",
    name: "Dr. Moussa Ndiaye",
    role: "Interne en Médecine Interne",
    hospital: "CHU Aristide Le Dantec",
    initials: "MN",
  },
  {
    quote: "La fonction relève m'a sauvé la mise plusieurs fois. On envoie le PDF au chef avant même qu'il arrive dans le service.",
    name: "Dr. Fatou Diallo",
    role: "Résidente en Neurologie",
    hospital: "Hôpital Principal de Dakar",
    initials: "FD",
  },
];

const stats = [
  { value: "60%", label: "des erreurs médicales surviennent lors d'une mauvaise transmission de relève" },
  { value: "45min", label: "de relève orale économisées par garde grâce à la génération automatique" },
  { value: "10s", label: "pour générer et transmettre une relève complète structurée" },
];

const pricingPlans = [
  {
    name: "Gratuit",
    price: "0 FCFA",
    period: "pour toujours",
    description: "Pour découvrir PulseBoard et les petits services",
    features: ["Jusqu'à 3 patients actifs", "1 service", "Relève basique", "Messagerie d'équipe"],
    cta: "Commencer gratuitement",
    highlight: false,
  },
  {
    name: "Service",
    price: "15 000 FCFA",
    period: "/ mois",
    description: "Pour les services avec une équipe active",
    features: ["Patients illimités", "Lits illimités", "Relève IA + PDF officiel", "Messagerie avancée", "Journal de garde", "Alertes en temps réel", "Export médico-légal"],
    cta: "Essayer 30 jours gratuit",
    highlight: true,
  },
  {
    name: "Hôpital",
    price: "Sur devis",
    period: "",
    description: "Déploiement complet pour un établissement",
    features: ["Services illimités", "Administration centrale", "Intégration DSP", "Formation des équipes", "Support prioritaire 24/7"],
    cta: "Nous contacter",
    highlight: false,
  },
];

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <PulseBoardLogo />
            <span className="font-bold text-lg tracking-tight">PulseBoard</span>
            <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 bg-muted rounded-full">Sénégal</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#problemes" className="hover:text-foreground transition-colors">Problèmes</a>
            <a href="#fonctionnalites" className="hover:text-foreground transition-colors">Fonctionnalités</a>
            <a href="#temoignages" className="hover:text-foreground transition-colors">Témoignages</a>
            <a href="#tarifs" className="hover:text-foreground transition-colors">Tarifs</a>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button onClick={() => navigate("/dashboard")} size="sm" className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white">
                Tableau de bord <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <a href={getLoginUrl("/dashboard")}>Se connecter</a>
                </Button>
                <Button size="sm" className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white" asChild>
                  <a href={getLoginUrl("/dashboard")}>Commencer <ChevronRight className="w-4 h-4 ml-1" /></a>
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--pulseboard-green)]/5 to-transparent pointer-events-none" />
        <div className="container relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--pulseboard-green)]/10 text-[var(--pulseboard-green)] text-sm font-medium mb-8">
              <Building2 className="w-4 h-4" />
              Utilisé dans les hôpitaux sénégalais
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
              Ton service,{" "}
              <span className="text-[var(--pulseboard-green)]">dans ta poche.</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-4">
              Tu gères 25 patients. Tu n'as pas dormi depuis 22h.
              La relève commence dans 10 minutes.
            </p>
            <p className="text-lg font-semibold text-foreground max-w-xl mx-auto mb-10">
              PulseBoard s'en souvient pour toi.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="text-base px-8 h-12 bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white"
                asChild
              >
                <a href={getLoginUrl("/dashboard")}>
                  Essayer gratuitement <ChevronRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
              <Button variant="outline" size="lg" className="text-base px-8 h-12" asChild>
                <a href="#fonctionnalites">Voir les fonctionnalités</a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--pulseboard-green)]" />
                Gratuit pour commencer
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--pulseboard-green)]" />
                2 minutes pour démarrer
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--pulseboard-green)]" />
                Fonctionne hors ligne
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Hospitals ticker */}
      <section className="py-12 border-y border-border/50 bg-muted/30 overflow-hidden">
        <div className="container">
          <p className="text-center text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-8">
            Adopté dans les établissements sénégalais de référence
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12">
            {hospitals.map((h) => (
              <div key={h.name} className="flex items-center gap-2.5 text-muted-foreground hover:text-foreground transition-colors">
                <Building2 className="w-4 h-4 text-[var(--pulseboard-green)]/70 shrink-0" />
                <span className="font-medium text-sm whitespace-nowrap">{h.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stats.map((stat, i) => (
              <div key={i} className="text-center p-8 rounded-2xl bg-card border border-border/50 shadow-sm">
                <div className="text-4xl font-bold text-[var(--pulseboard-green)] mb-3">{stat.value}</div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problems */}
      <section id="problemes" className="py-20 bg-muted/20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Tu connais ces situations ?</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Dans les services de Dakar, Thiès et Ziguinchor, on les vit tous les jours.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {problems.map((p, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border border-border/50 shadow-sm">
                <div className="text-3xl mb-3">{p.icon}</div>
                <h3 className="font-semibold text-base mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{p.description}</p>
                <div className="flex items-start gap-2 p-3 rounded-xl bg-[var(--pulseboard-green)]/8">
                  <CheckCircle className="w-4 h-4 text-[var(--pulseboard-green)] mt-0.5 shrink-0" />
                  <p className="text-sm text-[var(--pulseboard-green)] font-medium">{p.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="fonctionnalites" className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Tout ce dont ton service a besoin</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Un outil qui pense comme toi — et qui te libère pour soigner.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group p-6 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-[var(--pulseboard-green)]/30 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-xl bg-[var(--pulseboard-green)]/10 flex items-center justify-center mb-4 group-hover:bg-[var(--pulseboard-green)]/20 transition-colors">
                  <feature.icon className="w-5 h-5 text-[var(--pulseboard-green)]" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="py-20 bg-muted/20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Pour toute l'équipe médicale</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Externe, interne, résident ou médecin — PulseBoard s'adapte à ton rôle et à tes responsabilités.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {roles.map((role, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-card border border-border/50 shadow-sm text-center hover:shadow-md hover:-translate-y-1 transition-all duration-300"
              >
                <div className="text-4xl mb-4">{role.icon}</div>
                <h3 className="font-semibold mb-2">{role.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{role.description}</p>
                <Button variant="ghost" size="sm" className="mt-4 text-[var(--pulseboard-green)]" asChild>
                  <a href={getLoginUrl("/dashboard")}>
                    Commencer <ChevronRight className="w-4 h-4 ml-1" />
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="temoignages" className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Ce qu'en pensent les équipes</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Des médecins et internes sénégalais qui l'utilisent au quotidien.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="p-6 rounded-2xl bg-card border border-border/50 shadow-sm flex flex-col">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="text-sm text-muted-foreground leading-relaxed flex-1 mb-6">
                  "{t.quote}"
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[var(--pulseboard-green)] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                    <p className="text-xs text-[var(--pulseboard-green)]">{t.hospital}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="tarifs" className="py-20 bg-muted/20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Tarifs transparents</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Commencez gratuitement. Passez à la vitesse supérieure quand votre équipe en a besoin.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <div
                key={i}
                className={`p-6 rounded-2xl border shadow-sm flex flex-col ${
                  plan.highlight
                    ? "bg-[var(--pulseboard-green)] text-white border-[var(--pulseboard-green)]"
                    : "bg-card border-border/50"
                }`}
              >
                {plan.highlight && (
                  <div className="text-xs font-semibold uppercase tracking-widest text-white/70 mb-3">
                    Le plus populaire
                  </div>
                )}
                <h3 className={`font-bold text-xl mb-1 ${plan.highlight ? "text-white" : ""}`}>{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className={`text-3xl font-bold ${plan.highlight ? "text-white" : "text-[var(--pulseboard-green)]"}`}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className={`text-sm ${plan.highlight ? "text-white/70" : "text-muted-foreground"}`}>
                      {plan.period}
                    </span>
                  )}
                </div>
                <p className={`text-sm mb-6 ${plan.highlight ? "text-white/80" : "text-muted-foreground"}`}>
                  {plan.description}
                </p>
                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={`w-4 h-4 shrink-0 ${plan.highlight ? "text-white" : "text-[var(--pulseboard-green)]"}`} />
                      <span className={plan.highlight ? "text-white/90" : ""}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full ${
                    plan.highlight
                      ? "bg-white text-[var(--pulseboard-green)] hover:bg-white/90"
                      : "bg-[var(--pulseboard-green)] text-white hover:bg-[var(--pulseboard-green-dark)]"
                  }`}
                  asChild
                >
                  <a href={plan.name === "Hôpital" ? "mailto:contact@pulseboard.sn" : getLoginUrl("/dashboard")}>
                    {plan.cta}
                  </a>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 bg-[var(--pulseboard-green)]/5">
        <div className="container text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-[var(--pulseboard-green)]/10 flex items-center justify-center">
            <Zap className="w-8 h-8 text-[var(--pulseboard-green)]" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-4">Prêt à transformer ta garde ?</h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            Rejoins les équipes soignantes sénégalaises qui utilisent PulseBoard pour améliorer la prise en charge de leurs patients.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="text-base px-8 h-12 bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white"
              asChild
            >
              <a href={getLoginUrl("/dashboard")}>
                Commencer gratuitement <ChevronRight className="w-5 h-5 ml-2" />
              </a>
            </Button>
            <Button variant="outline" size="lg" className="text-base px-8 h-12" asChild>
              <a href="mailto:contact@pulseboard.sn">
                <Phone className="w-4 h-4 mr-2" /> Nous contacter
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <PulseBoardLogo />
              <span className="font-bold text-sm">PulseBoard</span>
              <span className="text-xs text-muted-foreground">Sénégal</span>
            </div>
            <div className="flex gap-8 text-sm text-muted-foreground">
              <a href="#fonctionnalites" className="hover:text-foreground transition-colors">Fonctionnalités</a>
              <a href="#tarifs" className="hover:text-foreground transition-colors">Tarifs</a>
              <a href="mailto:contact@pulseboard.sn" className="hover:text-foreground transition-colors">Contact</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 PulseBoard. Conçu pour les soignants sénégalais. 🇸🇳
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PulseBoardLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="8" fill="#00853F" />
      <polyline
        points="4,16 9,16 12,8 16,24 20,12 23,16 28,16"
        fill="none"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
