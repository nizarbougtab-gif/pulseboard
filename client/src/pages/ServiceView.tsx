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
import { toast } from "sonner";
import {
  Bed, Search, Plus, AlertCircle, Clock, ClipboardList,
  Users, CheckCircle, Activity, ArrowLeft,
  Stethoscope, ChevronRight, LayoutGrid, BookOpen, User, Copy, Check, UserCheck, X
} from "lucide-react";
import { getLoginUrl } from "@/const";
import AdmitPatientDialog from "@/components/AdmitPatientDialog";
import BottomNav from "@/components/BottomNav";
import ServiceChat from "@/components/ServiceChat";
import RelevePanel from "@/components/RelevePanel";

type TabType = "lits" | "garde" | "consult" | "releve";
type FilterType = "tous" | "urgents" | "sortie_prevue" | "sortis";

export default function ServiceView() {
  const { id } = useParams<{ id: string }>();
  const serviceId = parseInt(id || "0");
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading, can } = useAuth();

  const [activeTab, setActiveTab] = useState<TabType>("lits");
  const [filter, setFilter] = useState<FilterType>("tous");
  const [search, setSearch] = useState("");
  const [showAdmitDialog, setShowAdmitDialog] = useState(false);
  const [showConsultDialog, setShowConsultDialog] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [consultForm, setConsultForm] = useState({ firstName: "", lastName: "", motif: "", notes: "" });

  const { data: service, isLoading: serviceLoading } = trpc.services.get.useQuery({ id: serviceId }, { enabled: serviceId > 0 });
  const { data: patients = [], isLoading: patientsLoading } = trpc.patients.list.useQuery({ serviceId, filter }, { enabled: serviceId > 0 });
  const { data: alerts = [] } = trpc.alerts.byService.useQuery({ serviceId, onlyActive: true }, { enabled: serviceId > 0 });
  const { data: consultations = [] } = trpc.consultations.list.useQuery({ serviceId }, { enabled: serviceId > 0 });
  const { data: hospitals = [] } = trpc.hospitals.list.useQuery();
  const { data: isChef } = trpc.membership.isChef.useQuery({ serviceId }, { enabled: serviceId > 0 });
  const { data: pendingRequests = [] } = trpc.membership.pendingRequests.useQuery({ serviceId }, { enabled: !!isChef });

  const utils = trpc.useUtils();

  const resolveRequest = trpc.membership.resolve.useMutation({
    onSuccess: (_, vars) => {
      utils.membership.pendingRequests.invalidate({ serviceId });
      toast.success(vars.approved ? "Externe accepté" : "Demande refusée");
    },
  });

  const createConsultation = trpc.consultations.create.useMutation({
    onSuccess: () => {
      utils.consultations.list.invalidate({ serviceId });
      setShowConsultDialog(false);
      setConsultForm({ firstName: "", lastName: "", motif: "", notes: "" });
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
    onSuccess: () => { utils.alerts.byService.invalidate(); },
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
    window.location.href = getLoginUrl(`/service/${serviceId}`);
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
        <div className="px-4 py-3 text-[10px] text-muted-foreground border-t border-border/50">MEDBOARD &copy; 2026</div>
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
              {(service as any).code && isChef && (
                <button
                  onClick={() => { navigator.clipboard.writeText((service as any).code); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-xs font-mono text-muted-foreground transition-colors"
                  title="Copier le code"
                >
                  {(service as any).code}
                  {codeCopied ? <Check className="w-3 h-3 text-[var(--pulseboard-green)]" /> : <Copy className="w-3 h-3" />}
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
                    <span className="flex-1 font-medium">{r.userName} <span className="text-muted-foreground font-normal">demande à rejoindre</span></span>
                    <button onClick={() => resolveRequest.mutate({ requestId: r.id, approved: true })} className="text-[var(--pulseboard-green)] hover:opacity-70"><Check className="w-4 h-4" /></button>
                    <button onClick={() => resolveRequest.mutate({ requestId: r.id, approved: false })} className="text-[var(--pulseboard-red)] hover:opacity-70"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--pulseboard-red-light)] text-[var(--pulseboard-red)] text-xs font-semibold animate-pulse-alert">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{alerts.length} alerte{alerts.length > 1 ? "s" : ""}</span>
          </div>
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
          {can("patient.admit") && (
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
          <div className="p-6">
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
                  <div key={c.id} className="bg-white rounded-xl p-4 border border-border/50 flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
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
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{c.patientFirstName} {c.patientLastName}</span>
                        {c.status === "vu" && (
                          <Badge variant="outline" className="text-[10px] text-[var(--pulseboard-green)] border-[var(--pulseboard-green)]/30">Vu</Badge>
                        )}
                        {c.status === "en_attente" && (
                          <Badge variant="outline" className="text-[10px] text-[var(--pulseboard-amber)] border-[var(--pulseboard-amber)]/30">En attente</Badge>
                        )}
                        {c.status === "reporte" && (
                          <Badge variant="outline" className="text-[10px] text-[var(--pulseboard-red)] border-[var(--pulseboard-red)]/30">Reporté</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.motif}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.status !== "vu" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-[var(--pulseboard-green)]"
                          onClick={() => updateConsultStatus.mutate({ id: c.id, status: "vu" })}
                        >
                          Marquer vu
                        </Button>
                      )}
                      {c.status !== "reporte" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-[var(--pulseboard-red)]"
                          onClick={() => updateConsultStatus.mutate({ id: c.id, status: "reporte" })}
                        >
                          Retirer
                        </Button>
                      )}
                    </div>
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
      <AdmitPatientDialog open={showAdmitDialog} onOpenChange={setShowAdmitDialog} serviceId={serviceId} />

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

