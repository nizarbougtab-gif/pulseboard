import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Bed, Search, Plus, AlertCircle, Clock, ClipboardList,
  Users, CheckCircle, Activity, ArrowLeft,
  Stethoscope, ChevronRight, LayoutGrid, BookOpen, User, Copy, Check, UserCheck, X
} from "lucide-react";
import { getLoginUrl } from "@/const";
import AdmitPatientDialog from "@/components/AdmitPatientDialog";
import ConsultationDetailDialog from "@/components/ConsultationDetailDialog";
import BottomNav from "@/components/BottomNav";
import ServiceChat from "@/components/ServiceChat";
import RelevePanel from "@/components/RelevePanel";

type TabType = "lits" | "garde" | "messages" | "consult" | "releve";
type FilterType = "tous" | "urgents" | "sortie_prevue" | "sortis";

export default function ServiceView() {
  const { id } = useParams<{ id: string }>();
  const serviceId = parseInt(id || "0");
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading, can } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: getLoginUrl(`/service/${serviceId}`),
  });

  const [activeTab, setActiveTab] = useState<TabType>("lits");
  const [filter, setFilter] = useState<FilterType>("tous");
  const [search, setSearch] = useState("");
  const [showAdmitDialog, setShowAdmitDialog] = useState(false);
  const [showConsultDialog, setShowConsultDialog] = useState(false);
  const [showAlertsDialog, setShowAlertsDialog] = useState(false);
  const [selectedConsult, setSelectedConsult] = useState<any>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [consultForm, setConsultForm] = useState({ firstName: "", lastName: "", motif: "", notes: "" });
  const [showGuardDialog, setShowGuardDialog] = useState(false);
  const [guardForm, setGuardForm] = useState({ startsAt: "", endsAt: "", supervisorId: "" });
  const [guardAssignment, setGuardAssignment] = useState({ guardId: "", patientId: "", assignedToId: "", notes: "" });

  const { data: service, isLoading: serviceLoading } = trpc.services.get.useQuery({ id: serviceId }, { enabled: serviceId > 0 });
  const { data: patients = [], isLoading: patientsLoading } = trpc.patients.list.useQuery({ serviceId, filter }, { enabled: serviceId > 0 });
  const { data: alerts = [] } = trpc.alerts.byService.useQuery({ serviceId, onlyActive: true }, { enabled: serviceId > 0 });
  const { data: consultations = [] } = trpc.consultations.list.useQuery({ serviceId }, { enabled: serviceId > 0 });
  const { data: decisionProposals = [] } = trpc.decisionProposals.list.useQuery(
    { serviceId, pendingOnly: true },
    { enabled: serviceId > 0 }
  );
  const { data: hospitals = [] } = trpc.hospitals.list.useQuery();
  const { data: isChef } = trpc.membership.isChef.useQuery({ serviceId }, { enabled: serviceId > 0 });
  const { data: memberRole } = trpc.membership.myRole.useQuery({ serviceId }, { enabled: serviceId > 0 });
  const hasConfirmedRole = memberRole !== undefined && memberRole !== "stagiaire";
  const { data: pendingRequests = [] } = trpc.membership.pendingRequests.useQuery({ serviceId }, { enabled: !!isChef });
  const { data: members = [] } = trpc.services.members.useQuery({ serviceId }, { enabled: serviceId > 0 });
  const { data: guards = [] } = trpc.guards.list.useQuery({ serviceId }, { enabled: serviceId > 0 });

  const utils = trpc.useUtils();

  const { data: searchResults = [] } = trpc.patients.search.useQuery(
    { query: patientSearch },
    { enabled: patientSearch.length >= 2 }
  );

  const leaveService = trpc.services.leave.useMutation({
    onSuccess: () => { utils.services.list.invalidate(); navigate("/dashboard"); toast.success("Vous avez quitté le service"); },
  });

  const resolveRequest = trpc.membership.resolve.useMutation({
    onSuccess: (_, vars) => {
      utils.membership.pendingRequests.invalidate({ serviceId });
      toast.success(vars.approved ? "Membre accepté avec ses autorisations" : "Demande refusée");
    },
  });

  const createConsultation = trpc.consultations.create.useMutation({
    onSuccess: () => {
      utils.consultations.list.invalidate({ serviceId });
      setShowConsultDialog(false);
      setConsultForm({ firstName: "", lastName: "", motif: "", notes: "" });
      setPatientSearch("");
      toast.success("Consultation ajoutée");
    },
  });

  const updateConsultStatus = trpc.consultations.updateStatus.useMutation({
    onSuccess: () => {
      utils.consultations.list.invalidate({ serviceId });
      toast.success("Statut mis à jour");
    },
  });

  const resolveAlert = trpc.alerts.resolve.useMutation({
    onSuccess: () => {
      utils.alerts.byService.invalidate({ serviceId, onlyActive: true });
      toast.success("Alerte marquée comme traitée");
    },
  });

  const reviewDecision = trpc.decisionProposals.review.useMutation({
    onSuccess: (_, variables) => {
      utils.decisionProposals.list.invalidate({ serviceId, pendingOnly: true });
      utils.patients.list.invalidate({ serviceId });
      utils.consultations.list.invalidate({ serviceId });
      toast.success(variables.approved ? "Décision validée" : "Proposition refusée");
    },
    onError: error => toast.error(error.message),
  });
  const createGuard = trpc.guards.create.useMutation({
    onSuccess: () => { utils.guards.list.invalidate({ serviceId }); setShowGuardDialog(false); setGuardForm({ startsAt: "", endsAt: "", supervisorId: "" }); toast.success("Garde planifiée"); },
    onError: error => toast.error(error.message),
  });
  const setGuardStatus = trpc.guards.setStatus.useMutation({
    onSuccess: () => { utils.guards.list.invalidate({ serviceId }); toast.success("Garde mise à jour"); },
    onError: error => toast.error(error.message),
  });
  const assignGuardPatient = trpc.guards.assignPatient.useMutation({
    onSuccess: () => { utils.guards.list.invalidate({ serviceId }); setGuardAssignment({ guardId: "", patientId: "", assignedToId: "", notes: "" }); toast.success("Patient attribué pour la garde"); },
    onError: error => toast.error(error.message),
  });

  const hospital = useMemo(() => {
    if (!service || !hospitals.length) return null;
    return hospitals.find(h => h.id === service.hospitalId);
  }, [service, hospitals]);

  const filteredPatients = useMemo(() => {
    if (!search) return patients;
    const q = search.toLowerCase();
    return patients.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
      p.diagnosis?.toLowerCase().includes(q) ||
      `lit ${p.bedNumber}`.includes(q)
    );
  }, [patients, search]);

  const stats = useMemo(() => {
    const critiques = patients.filter(p => p.status === "critique").length;
    const moderes = patients.filter(p => p.status === "modere").length;
    const stables = patients.filter(p => p.status === "stable").length;
    return { critiques, moderes, stables, total: patients.length };
  }, [patients]);

  const getDaysSince = (date: Date | string) => {
    const d = new Date(date);
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getDayClass = (days: number) => {
    if (days >= 10) return "old";
    if (days >= 5) return "mid";
    return "fresh";
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-[var(--pulseboard-green)] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (serviceLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Service introuvable</p>
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="medboard-sidebar">
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--pulseboard-green)] flex items-center justify-center">
              <Plus className="w-4 h-4 text-white rotate-45" />
            </div>
            <span className="font-bold text-base tracking-tight">PulseBoard</span>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 mb-3">Menu principal</p>
          <div className="space-y-1">
            <button onClick={() => navigate("/dashboard")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--pulseboard-green-light)] text-[var(--pulseboard-green)] font-medium text-sm">
              <LayoutGrid className="w-4 h-4" />
              Services
              {alerts.length > 0 && <span className="ml-auto w-2 h-2 rounded-full bg-[var(--pulseboard-red)] animate-pulse" />}
            </button>
            <button onClick={() => navigate(`/timeline/${serviceId}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-gray-100 text-sm">
              <BookOpen className="w-4 h-4" />
              Journal
            </button>
            <button onClick={() => navigate("/profile")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-gray-100 text-sm">
              <User className="w-4 h-4" />
              Profil
            </button>
          </div>
        </nav>
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--pulseboard-green)] flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || "Utilisateur"}</p>
              <p className="text-[11px] text-muted-foreground uppercase">Médecin</p>
            </div>
          </div>
        </div>
        <div className="p-3 border-t border-border/50">
          {!isChef && (
            <button
              onClick={() => { if (confirm("Quitter ce service ?")) leaveService.mutate({ serviceId }); }}
              className="w-full text-xs text-muted-foreground hover:text-[var(--pulseboard-red)] py-1.5 transition-colors"
            >
              Quitter le service
            </button>
          )}
        </div>
        <div className="px-4 py-2 text-[10px] text-muted-foreground border-t border-border/50">PULSEBOARD &copy; 2026</div>
      </aside>

      {/* Main content */}
      <div className="medboard-main flex flex-col">
      {/* Top bar */}
      <div className="border-b bg-white px-6 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-all duration-200">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Stethoscope className="w-4 h-4 text-[var(--pulseboard-green)]" />
              <h1 className="font-semibold text-base">{service.name}</h1>
              {(service as any).code && hasConfirmedRole && (
                <button
                  onClick={() => { navigator.clipboard.writeText((service as any).code); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-xs font-mono text-muted-foreground transition-colors"
                  title="Copier le code"
                >
                  {(service as any).code}
                  {codeCopied ? <Check className="w-3 h-3 text-[var(--pulseboard-green)]" /> : <Copy className="w-3 h-3" />}
                </button>
              )}
              {(service as any).code && hasConfirmedRole && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/dashboard?join=${(service as any).code}`);
                    toast.success("Lien d’invitation copié");
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--pulseboard-green-light)] hover:opacity-80 text-xs text-[var(--pulseboard-green)] transition-colors"
                  title="Copier le lien d’invitation"
                >
                  <Users className="w-3 h-3" /> Inviter
                </button>
              )}
              {pendingRequests.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--pulseboard-amber-light)] text-[var(--pulseboard-amber)] text-xs font-semibold">
                  <UserCheck className="w-3 h-3" /> {pendingRequests.length} demande{pendingRequests.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{hospital?.name} · {service.specialty} · {service.totalBeds} lits</p>
            {pendingRequests.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {pendingRequests.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs bg-[var(--pulseboard-amber-light)] rounded-lg px-3 py-2">
                    <span className="flex-1 font-medium">
                      {r.userName}
                      <span className="ml-1 text-muted-foreground font-normal">
                        ({r.medicalRole === "externe" ? "Étudiant / Externe" : r.medicalRole === "interne" ? "Interne" : r.medicalRole === "resident" ? "Résident" : "Médecin"}) demande à rejoindre
                      </span>
                    </span>
                    <button onClick={() => resolveRequest.mutate({ requestId: r.id, approved: true })} className="text-[var(--pulseboard-green)] hover:opacity-70"><Check className="w-4 h-4" /></button>
                    <button onClick={() => resolveRequest.mutate({ requestId: r.id, approved: false })} className="text-[var(--pulseboard-red)] hover:opacity-70"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {alerts.length > 0 && (
          <button
            type="button"
            onClick={() => setShowAlertsDialog(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--pulseboard-red-light)] text-[var(--pulseboard-red)] text-xs font-semibold animate-pulse-alert transition-colors hover:bg-red-100"
            aria-label={`Afficher les ${alerts.length} alertes actives`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{alerts.length} alerte{alerts.length > 1 ? "s" : ""} — voir le détail</span>
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un patient..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-8 w-52 text-sm"
            />
          </div>
          {can("patient.admit") && hasConfirmedRole && (
            <Button
              size="sm"
              className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white h-8"
              onClick={() => setShowAdmitDialog(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Admettre
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b bg-white px-6 flex items-center gap-6 shrink-0">
        {[
          { key: "lits" as TabType, label: "Lits", icon: Bed },
          { key: "garde" as TabType, label: "Garde", icon: Clock },
          { key: "messages" as TabType, label: `Messages${decisionProposals.length ? ` · ${decisionProposals.length}` : ""}`, icon: Users },
          { key: "consult" as TabType, label: "Consult.", icon: ClipboardList },
          { key: "releve" as TabType, label: "Relève", icon: ClipboardList },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 py-3 px-1 text-sm border-b-2 transition-all duration-200 ${
              activeTab === tab.key
                ? "border-[var(--pulseboard-green)] text-[var(--pulseboard-green)] font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#f7f8f6]">
        {activeTab === "lits" && (
          <div className="p-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="bg-white rounded-xl p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-[var(--pulseboard-red-light)] flex items-center justify-center">
                    <AlertCircle className="w-3.5 h-3.5 text-[var(--pulseboard-red)]" />
                  </div>
                </div>
                <div className="text-xl font-bold text-[var(--pulseboard-red)]">{stats.critiques}</div>
                <div className="text-[11px] text-muted-foreground">Critiques</div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-[var(--pulseboard-amber-light)] flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5 text-[var(--pulseboard-amber)]" />
                  </div>
                </div>
                <div className="text-xl font-bold text-[var(--pulseboard-amber)]">{stats.moderes}</div>
                <div className="text-[11px] text-muted-foreground">Modérés</div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-[var(--pulseboard-green-light)] flex items-center justify-center">
                    <CheckCircle className="w-3.5 h-3.5 text-[var(--pulseboard-green)]" />
                  </div>
                </div>
                <div className="text-xl font-bold text-[var(--pulseboard-green)]">{stats.stables}</div>
                <div className="text-[11px] text-muted-foreground">Stables</div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-lg bg-[var(--pulseboard-blue-light)] flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-[var(--pulseboard-blue)]" />
                  </div>
                </div>
                <div className="text-xl font-bold">{stats.total}</div>
                <div className="text-[11px] text-muted-foreground">Total</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 mb-4">
              {(["tous", "urgents", "sortie_prevue", "sortis"] as FilterType[]).map(f => {
                const labels: Record<FilterType, string> = { tous: "Tous", urgents: "Urgents", sortie_prevue: "Sortie prévue", sortis: "Sortis" };
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                      filter === f
                        ? "bg-[var(--pulseboard-green)] text-white"
                        : "bg-white text-muted-foreground hover:bg-gray-100 border border-border/50"
                    }`}
                  >
                    {labels[f]}
                  </button>
                );
              })}
            </div>

            {/* Patient list */}
            {patientsLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Aucun patient trouvé</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPatients.map(patient => {
                  const days = getDaysSince(patient.admissionDate);
                  return (
                    <div
                      key={patient.id}
                      onClick={() => navigate(`/patient/${patient.id}`)}
                      className="bg-white rounded-xl p-4 border border-border/50 hover:border-[var(--pulseboard-green)]/30 hover:shadow-sm transition-all duration-200 cursor-pointer flex items-center gap-4"
                    >
                      <div className="w-12 text-center">
                        <div className="text-[11px] text-muted-foreground">Lit</div>
                        <div className="font-bold text-sm">{patient.bedNumber || "—"}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{patient.firstName} {patient.lastName}</span>
                          <span className={`day-badge ${getDayClass(days)}`}>J+{days}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {patient.diagnosis || "Diagnostic en cours"}
                          {patient.expectedDischarge && <span className="ml-2 text-[var(--pulseboard-amber)]">· Sortie prévue</span>}
                          {patient.actualDischarge && (
                            <span className="ml-2 text-[var(--pulseboard-blue)]">
                              · {patient.dischargeDisposition === "refere" ? `Référé${patient.referralDestination ? ` vers ${patient.referralDestination}` : ""}` : "Sorti"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {patient.allergies && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--pulseboard-red-light)] text-[var(--pulseboard-red)] font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {patient.allergies.split(",")[0]}
                          </span>
                        )}
                        <span className={`urg-tag ${patient.status}`}>
                          {patient.status === "critique" ? "Critique" : patient.status === "modere" ? "Modéré" : "Stable"}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "garde" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between"><div><h2 className="font-semibold">Organisation des gardes</h2><p className="text-xs text-muted-foreground">Horaires, superviseur, équipe et patients attribués.</p></div>{can("guard.manage") && hasConfirmedRole && <Button size="sm" className="bg-[var(--pulseboard-green)] text-white" onClick={() => setShowGuardDialog(true)}><Plus className="w-4 h-4 mr-1" /> Planifier</Button>}</div>
            {guards.length === 0 ? <div className="bg-white border border-dashed rounded-xl py-12 text-center text-muted-foreground"><Clock className="w-10 h-10 mx-auto mb-3 opacity-30" /><p className="text-sm">Aucune garde planifiée</p></div> : guards.map(guard => (
              <div key={guard.id} className={`bg-white rounded-xl border p-4 ${guard.status === "active" ? "border-[var(--pulseboard-green)]" : "border-border/50"}`}>
                <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="font-semibold text-sm">Garde du {new Date(guard.startsAt).toLocaleDateString("fr-FR")}</h3><Badge className={guard.status === "active" ? "bg-[var(--pulseboard-green-light)] text-[var(--pulseboard-green)]" : guard.status === "ended" ? "bg-gray-100 text-gray-700" : "bg-amber-100 text-amber-800"}>{guard.status === "active" ? "En cours" : guard.status === "ended" ? "Terminée" : "Planifiée"}</Badge></div><p className="text-xs text-muted-foreground mt-1">{new Date(guard.startsAt).toLocaleString("fr-FR")} → {new Date(guard.endsAt).toLocaleString("fr-FR")}</p></div>{can("guard.manage") && hasConfirmedRole && guard.status !== "ended" && <div className="flex gap-2">{guard.status === "scheduled" && <Button size="sm" className="bg-[var(--pulseboard-green)] text-white" onClick={() => setGuardStatus.mutate({ id: guard.id, status: "active" })}>Commencer la garde</Button>}{guard.status === "active" && <Button size="sm" variant="outline" onClick={() => { const summary = prompt("Résumé obligatoire de fin de garde :"); if (summary?.trim()) setGuardStatus.mutate({ id: guard.id, status: "ended", summary }); }}>Terminer la garde</Button>}</div>}</div>
                <div className="mt-3"><p className="text-xs font-semibold mb-1">Équipe</p><div className="flex flex-wrap gap-1">{guard.members.map((m:any) => <Badge key={m.id} variant="outline">{m.userName || `Membre #${m.userId}`} · {m.dutyRole === "student" ? "Étudiant" : m.dutyRole === "supervisor" ? "Superviseur" : "Clinicien"}</Badge>)}</div></div>
                <div className="mt-3"><p className="text-xs font-semibold mb-1">Patients attribués</p>{guard.assignments.length ? guard.assignments.map((a:any) => <div key={a.id} className="text-xs bg-gray-50 rounded-lg p-2 mb-1">Lit {a.bedNumber || "—"} · {a.patientFirstName} {a.patientLastName} → membre #{a.assignedToId}{a.notes ? ` · ${a.notes}` : ""}</div>) : <p className="text-xs text-muted-foreground">Aucun patient attribué.</p>}</div>
                {can("guard.manage") && hasConfirmedRole && guard.status !== "ended" && <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-3"><Select value={guardAssignment.guardId === String(guard.id) ? guardAssignment.patientId || "none" : "none"} onValueChange={v => setGuardAssignment(f => ({ ...f, guardId: String(guard.id), patientId: v === "none" ? "" : v }))}><SelectTrigger><SelectValue placeholder="Patient" /></SelectTrigger><SelectContent><SelectItem value="none">Choisir patient</SelectItem>{patients.filter(p=>!p.actualDischarge).map(p=><SelectItem key={p.id} value={String(p.id)}>Lit {p.bedNumber || "—"} · {p.firstName} {p.lastName}</SelectItem>)}</SelectContent></Select><Select value={guardAssignment.guardId === String(guard.id) ? guardAssignment.assignedToId || "none" : "none"} onValueChange={v => setGuardAssignment(f => ({ ...f, guardId: String(guard.id), assignedToId: v === "none" ? "" : v }))}><SelectTrigger><SelectValue placeholder="Membre" /></SelectTrigger><SelectContent><SelectItem value="none">Choisir membre</SelectItem>{guard.members.map((m:any)=><SelectItem key={m.userId} value={String(m.userId)}>{m.userName || `Membre #${m.userId}`}</SelectItem>)}</SelectContent></Select><Input placeholder="Consigne" value={guardAssignment.guardId === String(guard.id) ? guardAssignment.notes : ""} onChange={e => setGuardAssignment(f => ({ ...f, guardId: String(guard.id), notes: e.target.value }))} /><Button disabled={guardAssignment.guardId !== String(guard.id) || !guardAssignment.patientId || !guardAssignment.assignedToId || assignGuardPatient.isPending} onClick={() => assignGuardPatient.mutate({ guardId: guard.id, patientId: Number(guardAssignment.patientId), assignedToId: Number(guardAssignment.assignedToId), notes: guardAssignment.notes || undefined })}>Attribuer</Button></div>}
                {guard.summary && <div className="mt-3 text-xs bg-[var(--pulseboard-green-light)] rounded-lg p-3"><b>Résumé :</b> {guard.summary}</div>}
              </div>
            ))}
          </div>
        )}

        {activeTab === "messages" && (
          <div className="p-6">
            {decisionProposals.length > 0 && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h2 className="text-sm font-semibold text-amber-900">Décisions en attente</h2>
                    <p className="text-xs text-amber-800">Propositions de l'équipe à vérifier avant application.</p>
                  </div>
                  <Badge className="bg-amber-100 text-amber-800">{decisionProposals.length}</Badge>
                </div>
                <div className="space-y-2">
                  {decisionProposals.map(proposal => (
                    <div key={proposal.id} className="rounded-lg border border-amber-200 bg-white p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {proposal.decisionType === "sortie" ? "Sortie" : proposal.decisionType === "refere" ? "Référence" : "Hospitalisation"}
                          {` · ${proposal.subjectName}${proposal.subjectBedNumber ? ` · lit ${proposal.subjectBedNumber}` : ""}`}
                          {proposal.urgency === "urgent" && <Badge className="ml-2 bg-red-100 text-red-700">Urgent</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Proposé par {proposal.proposerName || "un membre"} · {new Date(proposal.createdAt).toLocaleString("fr-FR")}
                        </p>
                        {proposal.destination && <p className="text-xs mt-1">Destination : {proposal.destination}</p>}
                        {proposal.reason && <p className="text-xs text-muted-foreground truncate">Motif : {proposal.reason}</p>}
                      </div>
                      {can("decision.review") && hasConfirmedRole ? (
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" variant="outline" disabled={reviewDecision.isPending} onClick={() => { const reviewNote = prompt("Pourquoi refusez-vous cette proposition ? (obligatoire)"); if (reviewNote?.trim()) reviewDecision.mutate({ id: proposal.id, approved: false, reviewNote }); }}>
                            <X className="w-3.5 h-3.5 mr-1" /> Refuser
                          </Button>
                          <Button size="sm" className="bg-[var(--pulseboard-green)] text-white" disabled={reviewDecision.isPending} onClick={() => reviewDecision.mutate({ id: proposal.id, approved: true })}>
                            <Check className="w-3.5 h-3.5 mr-1" /> Valider
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline">Validation senior requise</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <ServiceChat serviceId={serviceId} isOpen={true} onClose={() => setActiveTab("lits")} inline />
          </div>
        )}

        {activeTab === "consult" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-sm">Consultations du jour</h2>
            </div>

            {/* Consultation list */}
            <div className="space-y-2 mb-4">
              {consultations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">Aucune consultation</p>
                </div>
              ) : (
                consultations.map(c => (
                  <div key={c.id}
                    onClick={() => setSelectedConsult({ ...c, serviceId })}
                    className="bg-white rounded-xl p-4 border border-border/50 flex items-center gap-4 cursor-pointer hover:border-[var(--pulseboard-green)]/30 transition-all">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      c.status === "vu" ? "bg-[var(--pulseboard-green-light)]" : c.status === "reporte" ? "bg-[var(--pulseboard-red-light)]" : "bg-[var(--pulseboard-amber-light)]"
                    }`}>
                      {c.status === "vu" ? (
                        <CheckCircle className="w-3.5 h-3.5 text-[var(--pulseboard-green)]" />
                      ) : c.status === "reporte" ? (
                        <AlertCircle className="w-3.5 h-3.5 text-[var(--pulseboard-red)]" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-[var(--pulseboard-amber)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{c.patientFirstName} {c.patientLastName}</span>
                        <Badge variant="outline" className={`text-[10px] ${c.status === "vu" ? "text-[var(--pulseboard-green)] border-[var(--pulseboard-green)]/30" : c.status === "reporte" ? "text-[var(--pulseboard-red)] border-[var(--pulseboard-red)]/30" : "text-[var(--pulseboard-amber)] border-[var(--pulseboard-amber)]/30"}`}>
                          {c.status === "vu" ? "Vu" : c.status === "reporte" ? "Reporté" : "En attente"}
                        </Badge>
                        {c.disposition && (
                          <Badge className={`text-[10px] ${c.disposition === "hospitalise" ? "bg-[var(--pulseboard-green-light)] text-[var(--pulseboard-green)]" : c.disposition === "refere" ? "bg-[var(--pulseboard-blue-light)] text-[var(--pulseboard-blue)]" : "bg-gray-100 text-gray-700"}`}>
                            {c.disposition === "hospitalise" ? "Hospitalisé" : c.disposition === "refere" ? "Référé" : "Sorti"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{c.motif}</p>
                      {c.rendezVous && <p className="text-xs text-[var(--pulseboard-amber)]">📅 RDV : {new Date(c.rendezVous).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
                      {c.examensPara && <p className="text-xs text-[var(--pulseboard-green)] truncate">🔬 {c.examensPara.replace(/\|/g, ", ")}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                ))
              )}
            </div>

            {/* Add consultation button */}
            <button
              onClick={() => setShowConsultDialog(true)}
              className="w-full py-3 rounded-xl border-2 border-dashed border-border/60 text-sm text-muted-foreground hover:border-[var(--pulseboard-green)]/40 hover:text-[var(--pulseboard-green)] transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Ajouter une consultation
            </button>
          </div>
        )}

        {activeTab === "releve" && (
          <div className="p-6">
            <RelevePanel serviceId={serviceId} isOpen={true} onClose={() => setActiveTab("lits")} inline />
          </div>
        )}
      </div>

      {/* Admit patient dialog */}
      <Dialog open={showAlertsDialog} onOpenChange={setShowAlertsDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[var(--pulseboard-red)]" />
              Alertes actives du service
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Les alertes critiques sont affichées en rouge. Les alertes orange signalent une action à effectuer, sans forcément indiquer que le patient est critique.
          </div>

          <div className="space-y-3 overflow-y-auto py-1">
            {alerts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <CheckCircle className="mx-auto mb-2 h-8 w-8 text-[var(--pulseboard-green)]" />
                Aucune alerte active
              </div>
            ) : (
              alerts.map(alert => {
                const isCritical = alert.type === "critical_patient";
                const typeLabel = alert.type === "critical_patient"
                  ? "Patient critique"
                  : alert.type === "no_bed"
                    ? "Lit non assigné"
                    : alert.type === "dps_missing"
                      ? "Dossier incomplet"
                      : "Tâche en retard";

                return (
                  <div
                    key={alert.id}
                    className={`rounded-xl border p-3 ${
                      isCritical
                        ? "border-red-200 bg-red-50"
                        : "border-amber-200 bg-amber-50/60"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isCritical ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className={`text-xs font-bold uppercase tracking-wide ${
                            isCritical ? "text-red-700" : "text-amber-700"
                          }`}>
                            {typeLabel}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(alert.createdAt).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium text-foreground">{alert.message}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {alert.patientId && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setShowAlertsDialog(false);
                                navigate(`/patient/${alert.patientId}`);
                              }}
                            >
                              <User className="mr-1 h-3.5 w-3.5" /> Voir le patient
                            </Button>
                          )}
                          {can("alert.resolve") && <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-[var(--pulseboard-green)]"
                            disabled={resolveAlert.isPending}
                            onClick={() => resolveAlert.mutate({ id: alert.id })}
                          >
                            <CheckCircle className="mr-1 h-3.5 w-3.5" /> Marquer comme traitée
                          </Button>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showGuardDialog} onOpenChange={setShowGuardDialog}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Planifier une garde</DialogTitle></DialogHeader><div className="space-y-3"><div><Label>Début *</Label><Input type="datetime-local" value={guardForm.startsAt} onChange={e => setGuardForm(f => ({ ...f, startsAt: e.target.value }))} /></div><div><Label>Fin *</Label><Input type="datetime-local" value={guardForm.endsAt} onChange={e => setGuardForm(f => ({ ...f, endsAt: e.target.value }))} /></div><div><Label>Superviseur</Label><Select value={guardForm.supervisorId || "none"} onValueChange={v => setGuardForm(f => ({ ...f, supervisorId: v === "none" ? "" : v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">À définir</SelectItem>{members.filter((m:any)=>m.role!=="stagiaire").map((m:any)=><SelectItem key={m.userId} value={String(m.userId)}>{m.userName} · {m.medicalRole}</SelectItem>)}</SelectContent></Select></div><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setShowGuardDialog(false)}>Annuler</Button><Button className="flex-1 bg-[var(--pulseboard-green)] text-white" disabled={!guardForm.startsAt || !guardForm.endsAt || createGuard.isPending} onClick={() => createGuard.mutate({ serviceId, startsAt: guardForm.startsAt, endsAt: guardForm.endsAt, supervisorId: guardForm.supervisorId ? Number(guardForm.supervisorId) : undefined, memberIds: members.map((m:any)=>m.userId) })}>Planifier</Button></div></div></DialogContent>
      </Dialog>

      <AdmitPatientDialog
        open={showAdmitDialog}
        onOpenChange={setShowAdmitDialog}
        serviceId={serviceId}
        onCreated={(path) => setActiveTab(path === "consultation" ? "consult" : "lits")}
      />

      {selectedConsult && (
        <ConsultationDetailDialog
          open={!!selectedConsult}
          onOpenChange={(v) => { if (!v) setSelectedConsult(null); }}
          consultation={selectedConsult}
        />
      )}

      {/* Add consultation dialog */}
      <Dialog open={showConsultDialog} onOpenChange={setShowConsultDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[var(--pulseboard-green)]" />
              Ajouter une consultation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Recherche patient hospitalisé */}
            <div>
              <Label className="text-xs">Rechercher un patient hospitalisé (optionnel)</Label>
              <div className="relative mt-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Nom ou prénom..."
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>
              {patientSearch.length >= 2 && searchResults.length > 0 && (
                <div className="mt-1 border rounded-lg overflow-hidden bg-white shadow-sm">
                  {searchResults.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setConsultForm(f => ({ ...f, firstName: p.firstName, lastName: p.lastName }));
                        setPatientSearch("");
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left border-b last:border-0"
                    >
                      <div className="w-7 h-7 rounded-full bg-[var(--pulseboard-green-light)] flex items-center justify-center text-[var(--pulseboard-green)] text-xs font-bold shrink-0">
                        {p.firstName[0]}{p.lastName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{p.firstName} {p.lastName}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.diagnosis || "Diagnostic en cours"} · {p.serviceName || "Service inconnu"}</p>
                      </div>
                      <span className={`text-xs font-semibold ${p.status === "critique" ? "text-[var(--pulseboard-red)]" : p.status === "modere" ? "text-[var(--pulseboard-amber)]" : "text-[var(--pulseboard-green)]"}`}>
                        {p.status === "critique" ? "Critique" : p.status === "modere" ? "Modéré" : "Stable"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {patientSearch.length >= 2 && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Aucun patient trouvé — entrez le nom manuellement</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Prénom</Label>
                <Input
                  placeholder="Prénom"
                  value={consultForm.firstName}
                  onChange={e => setConsultForm(p => ({ ...p, firstName: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Nom</Label>
                <Input
                  placeholder="Nom"
                  value={consultForm.lastName}
                  onChange={e => setConsultForm(p => ({ ...p, lastName: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Motif de consultation</Label>
              <Input
                placeholder="Ex: Otalgie, Céphalées..."
                value={consultForm.motif}
                onChange={e => setConsultForm(p => ({ ...p, motif: e.target.value }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Notes (optionnel)</Label>
              <Textarea
                placeholder="Notes supplémentaires..."
                value={consultForm.notes}
                onChange={e => setConsultForm(p => ({ ...p, notes: e.target.value }))}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowConsultDialog(false)}>Annuler</Button>
            <Button
              className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white"
              disabled={!consultForm.firstName || !consultForm.lastName || !consultForm.motif}
              onClick={() => {
                createConsultation.mutate({
                  serviceId,
                  patientFirstName: consultForm.firstName,
                  patientLastName: consultForm.lastName,
                  motif: consultForm.motif,
                  notes: consultForm.notes || undefined,
                });
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BottomNav serviceId={serviceId} />
    </div>
    </div>
  );
}
