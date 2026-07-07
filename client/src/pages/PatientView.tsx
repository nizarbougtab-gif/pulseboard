import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import {
  ArrowLeft, AlertTriangle, FileText, ListChecks, Heart,
  Eye, FolderOpen, Plus, CheckCircle, Clock, MoreVertical,
  LayoutGrid, BookOpen, User
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type PatientTab = "suivi" | "taches" | "vitaux" | "obs" | "fichiers";

export default function PatientView() {
  const { id } = useParams<{ id: string }>();
  const patientId = parseInt(id || "0");
  const [, navigate] = useLocation();
  const { isAuthenticated, loading, can } = useAuth();

  const [activeTab, setActiveTab] = useState<PatientTab>("suivi");
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteType, setNoteType] = useState<"dar" | "soap" | "libre">("dar");
  const [noteContent, setNoteContent] = useState("");
  const [showVitalsDialog, setShowVitalsDialog] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({ temperature: "", bloodPressure: "", heartRate: "", respiratoryRate: "", oxygenSaturation: "", gcs: "", pain: "" });
  const [showObsDialog, setShowObsDialog] = useState(false);
  const [obsContent, setObsContent] = useState("");
  const [obsCategory, setObsCategory] = useState<"clinique" | "infirmier" | "evolution" | "autre">("clinique");
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium" as string });

  const { data: patient, isLoading } = trpc.patients.get.useQuery({ id: patientId }, { enabled: patientId > 0 });
  const { data: notes = [] } = trpc.notes.byPatient.useQuery({ patientId }, { enabled: patientId > 0 });
  const { data: tasks = [] } = trpc.tasks.byPatient.useQuery({ patientId }, { enabled: patientId > 0 });
  const { data: vitals = [] } = trpc.vitals.byPatient.useQuery({ patientId }, { enabled: patientId > 0 });
  const { data: observations = [] } = trpc.observations.byPatient.useQuery({ patientId }, { enabled: patientId > 0 });

  const utils = trpc.useUtils();

  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.byPatient.invalidate({ patientId });
      setShowNoteDialog(false);
      setNoteContent("");
      toast.success("Note ajoutée");
    },
  });

  const createVitals = trpc.vitals.create.useMutation({
    onSuccess: () => {
      utils.vitals.byPatient.invalidate({ patientId });
      setShowVitalsDialog(false);
      setVitalsForm({ temperature: "", bloodPressure: "", heartRate: "", respiratoryRate: "", oxygenSaturation: "", gcs: "", pain: "" });
      toast.success("Constantes enregistrées");
    },
  });

  const createObs = trpc.observations.create.useMutation({
    onSuccess: () => {
      utils.observations.byPatient.invalidate({ patientId });
      setShowObsDialog(false);
      setObsContent("");
      toast.success("Observation ajoutée");
    },
  });

  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.byPatient.invalidate({ patientId });
      setShowTaskDialog(false);
      setTaskForm({ title: "", description: "", priority: "medium" });
      toast.success("Tâche ajoutée");
    },
  });

  const updateTaskStatus = trpc.tasks.updateStatus.useMutation({
    onSuccess: () => { utils.tasks.byPatient.invalidate({ patientId }); },
  });

  const updatePatient = trpc.patients.update.useMutation({
    onSuccess: () => { utils.patients.get.invalidate({ id: patientId }); toast.success("Patient mis à jour"); },
  });

  const dischargePatient = trpc.patients.discharge.useMutation({
    onSuccess: () => { toast.success("Patient sorti"); navigate(`/service/${patient?.serviceId}`); },
  });

  const getDaysSince = (date: Date | string) => Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-[var(--pulseboard-green)] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl(`/patient/${patientId}`);
    return null;
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <p>Patient introuvable</p>
        <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  const days = getDaysSince(patient.admissionDate);
  const pendingTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress");

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
            </button>
            <button onClick={() => navigate(`/timeline/${patient.serviceId}`)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-gray-100 text-sm">
              <BookOpen className="w-4 h-4" />
              Journal
            </button>
            <button onClick={() => navigate("/profile")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-gray-100 text-sm">
              <User className="w-4 h-4" />
              Profil
            </button>
          </div>
        </nav>
        <div className="px-4 py-3 text-[10px] text-muted-foreground border-t border-border/50">MEDBOARD &copy; 2026</div>
      </aside>

      {/* Main content */}
      <div className="medboard-main flex flex-col bg-[#f7f8f6]">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/service/${patient.serviceId}`)} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-semibold text-lg">{patient.firstName} {patient.lastName}</h1>
                <span className={`w-2.5 h-2.5 rounded-full ${patient.status === "critique" ? "bg-[var(--pulseboard-red)]" : patient.status === "modere" ? "bg-[var(--pulseboard-amber)]" : "bg-[var(--pulseboard-green)]"}`} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`day-badge ${days >= 10 ? "old" : days >= 5 ? "mid" : "fresh"}`}>J+{days}</span>
            <span className={`urg-tag ${patient.status}`}>
              {patient.status === "critique" ? "Critique" : patient.status === "modere" ? "Modéré" : "Stable"}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {can("patient.edit") && (
                  <DropdownMenuItem onClick={() => updatePatient.mutate({ id: patientId, dpsCompleted: true })} disabled={patient.dpsCompleted === true}>
                    {patient.dpsCompleted ? "DPS complétée ✓" : "Marquer DPS complétée"}
                  </DropdownMenuItem>
                )}
                {can("patient.status") && (<>
                  <DropdownMenuItem onClick={() => updatePatient.mutate({ id: patientId, status: "stable" })}>
                    Passer en Stable
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updatePatient.mutate({ id: patientId, status: "modere" })}>
                    Passer en Modéré
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => updatePatient.mutate({ id: patientId, status: "critique" })}>
                    Passer en Critique
                  </DropdownMenuItem>
                </>)}
                {can("patient.discharge") && (
                  <DropdownMenuItem className="text-[var(--pulseboard-red)]" onClick={() => {
                    if (confirm("Confirmer la sortie de ce patient ?")) dischargePatient.mutate({ id: patientId });
                  }}>
                    Sortie du patient
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Patient info badges */}
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <Badge variant="outline" className="text-xs bg-[var(--pulseboard-green-light)] border-[var(--pulseboard-green)]/20 text-[var(--pulseboard-green)]">
            {patient.bedNumber ? `Lit ${patient.bedNumber}` : "Sans lit"}
          </Badge>
          {patient.dateOfBirth && (
            <span className="text-xs text-muted-foreground">{patient.gender === "M" ? "♂" : "♀"} {patient.dateOfBirth}</span>
          )}
          {patient.diagnosis && (
            <span className="text-xs text-muted-foreground">Motif : {patient.diagnosis}</span>
          )}
        </div>

        {/* Alerts row */}
        <div className="flex items-center gap-3 mt-3">
          {!patient.dpsCompleted && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--pulseboard-amber-light)] text-[var(--pulseboard-amber)] text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              DPS non renseignée
            </div>
          )}
          {pendingTasks.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--pulseboard-blue-light)] text-[var(--pulseboard-blue)] text-xs font-medium">
              <ListChecks className="w-3 h-3" />
              {pendingTasks.length} tâche{pendingTasks.length > 1 ? "s" : ""}
            </div>
          )}
          {patient.allergies && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--pulseboard-red-light)] text-[var(--pulseboard-red)] text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              {patient.allergies}
            </div>
          )}
        </div>

        {/* Treatment */}
        {patient.antecedents && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Traitement habituel : {patient.antecedents}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6 flex items-center gap-4 shrink-0">
        {[
          { key: "suivi" as PatientTab, label: "Suivi", icon: FileText },
          { key: "taches" as PatientTab, label: "Tâches", icon: ListChecks },
          { key: "vitaux" as PatientTab, label: "Vitaux", icon: Heart },
          { key: "obs" as PatientTab, label: "Obs", icon: Eye },
          { key: "fichiers" as PatientTab, label: "Fichiers", icon: FolderOpen },
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

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* SUIVI TAB */}
        {activeTab === "suivi" && (
          <div className="max-w-2xl mx-auto">
            {notes.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white border border-border/50 flex items-center justify-center">
                  <FileText className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Première note d'admission</h3>
                <p className="text-xs text-muted-foreground mb-5">Documentez l'état initial du patient à son arrivée.</p>
                {can("note.create") && (
                  <div className="flex items-center justify-center gap-3">
                    <Button variant="outline" className="h-9" onClick={() => { setNoteType("dar"); setShowNoteDialog(true); }}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Note DAR
                    </Button>
                    <Button variant="outline" className="h-9" onClick={() => { setNoteType("soap"); setShowNoteDialog(true); }}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Note SOAP
                    </Button>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground mt-3">DAR = Données · Actions · Résultats<br/>format recommandé pour la relève</p>
              </div>
            ) : (
              <div className="space-y-4">
                {notes.map(note => (
                  <div key={note.id} className="bg-white rounded-xl p-4 border border-border/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold">{note.type}</Badge>
                        <span className="text-xs text-muted-foreground">{note.userName}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(note.createdAt).toLocaleDateString("fr-FR")} · {new Date(note.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed bg-[#f7f8f6] rounded-lg p-3">{note.content}</div>
                  </div>
                ))}
                {can("note.create") && (
                  <div className="flex justify-end">
                    <Button size="sm" className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white" onClick={() => setShowNoteDialog(true)}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Note
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TACHES TAB */}
        {activeTab === "taches" && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">Tâches ({tasks.length})</h2>
              {can("task.create") && (
                <Button size="sm" className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white h-8" onClick={() => setShowTaskDialog(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Tâche
                </Button>
              )}
            </div>
            {tasks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ListChecks className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Aucune tâche</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map(task => (
                  <div key={task.id} className="bg-white rounded-xl p-4 border border-border/50 flex items-start gap-3">
                    <button
                      onClick={() => updateTaskStatus.mutate({ id: task.id, status: task.status === "completed" ? "pending" : "completed" })}
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        task.status === "completed" ? "bg-[var(--pulseboard-green)] border-[var(--pulseboard-green)]" : "border-gray-300 hover:border-[var(--pulseboard-green)]"
                      }`}
                    >
                      {task.status === "completed" && <CheckCircle className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{task.title}</div>
                      {task.description && <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        {task.priority === "urgent" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--pulseboard-red-light)] text-[var(--pulseboard-red)] font-medium">Urgent</span>}
                        {task.priority === "high" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--pulseboard-amber-light)] text-[var(--pulseboard-amber)] font-medium">Haute</span>}
                        {task.dueDate && <span className="text-[10px] text-muted-foreground">{new Date(task.dueDate).toLocaleDateString("fr-FR")}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VITAUX TAB */}
        {activeTab === "vitaux" && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">Constantes vitales</h2>
              {can("vitals.create") && (
                <Button size="sm" className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white h-8" onClick={() => setShowVitalsDialog(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Constantes
                </Button>
              )}
            </div>
            {vitals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Heart className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Aucune constante enregistrée</p>
              </div>
            ) : (
              <div className="space-y-3">
                {vitals.map(v => (
                  <div key={v.id} className="bg-white rounded-xl p-4 border border-border/50">
                    <div className="text-[11px] text-muted-foreground mb-2">
                      {new Date(v.recordedAt).toLocaleDateString("fr-FR")} · {new Date(v.recordedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {v.temperature && <div><div className="text-[10px] text-muted-foreground">Temp.</div><div className="text-sm font-medium">{v.temperature}°C</div></div>}
                      {v.bloodPressure && <div><div className="text-[10px] text-muted-foreground">TA</div><div className="text-sm font-medium">{v.bloodPressure}</div></div>}
                      {v.heartRate && <div><div className="text-[10px] text-muted-foreground">FC</div><div className="text-sm font-medium">{v.heartRate}/min</div></div>}
                      {v.respiratoryRate && <div><div className="text-[10px] text-muted-foreground">FR</div><div className="text-sm font-medium">{v.respiratoryRate}/min</div></div>}
                      {v.oxygenSaturation && <div><div className="text-[10px] text-muted-foreground">SpO2</div><div className="text-sm font-medium">{v.oxygenSaturation}%</div></div>}
                      {v.gcs && <div><div className="text-[10px] text-muted-foreground">GCS</div><div className="text-sm font-medium">{v.gcs}/15</div></div>}
                      {v.pain && <div><div className="text-[10px] text-muted-foreground">Douleur</div><div className="text-sm font-medium">{v.pain}/10</div></div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* OBS TAB */}
        {activeTab === "obs" && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">Observations</h2>
              {can("note.create") && (
                <Button size="sm" className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white h-8" onClick={() => setShowObsDialog(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Observation
                </Button>
              )}
            </div>
            {observations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Eye className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Aucune observation</p>
              </div>
            ) : (
              <div className="space-y-3">
                {observations.map(obs => (
                  <div key={obs.id} className="bg-white rounded-xl p-4 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">{obs.category}</Badge>
                        <span className="text-xs text-muted-foreground">{obs.userName}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(obs.createdAt).toLocaleDateString("fr-FR")} · {new Date(obs.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{obs.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* FICHIERS TAB */}
        {activeTab === "fichiers" && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm">Fichiers et documents</h2>
            </div>
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white border border-border/50 flex items-center justify-center">
                <FolderOpen className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground">Aucun fichier attaché</p>
              <p className="text-xs text-muted-foreground mt-1">Les fichiers joints (résultats d'examens, imagerie) apparaîtront ici.</p>
            </div>
          </div>
        )}
      </div>

      {/* Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--pulseboard-green)]" />
              Ajouter une note
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Type de note</Label>
              <div className="flex gap-2 mt-1.5">
                {(["dar", "soap", "libre"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setNoteType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      noteType === t ? "bg-[var(--pulseboard-green)] text-white" : "bg-gray-100 text-muted-foreground hover:bg-gray-200"
                    }`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
              {noteType === "dar" && <p className="text-[11px] text-muted-foreground mt-2">DAR = Données · Actions · Résultats — format recommandé pour la relève</p>}
              {noteType === "soap" && <p className="text-[11px] text-muted-foreground mt-2">SOAP = Subjectif · Objectif · Analyse · Plan</p>}
            </div>
            <div>
              <Label className="text-xs">Contenu</Label>
              <Textarea
                placeholder={noteType === "dar" ? "Données:\n\nActions:\n\nRésultats:" : noteType === "soap" ? "Subjectif:\n\nObjectif:\n\nAnalyse:\n\nPlan:" : "Écrivez votre note..."}
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                className="mt-1 min-h-[200px] font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNoteDialog(false)}>Annuler</Button>
            <Button
              className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white"
              disabled={!noteContent.trim()}
              onClick={() => createNote.mutate({ patientId, serviceId: patient.serviceId, type: noteType, content: noteContent })}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vitals Dialog */}
      <Dialog open={showVitalsDialog} onOpenChange={setShowVitalsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-[var(--pulseboard-green)]" />
              Constantes vitales
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div><Label className="text-xs">Température (°C)</Label><Input placeholder="37.5" value={vitalsForm.temperature} onChange={e => setVitalsForm(p => ({ ...p, temperature: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">TA (mmHg)</Label><Input placeholder="120/80" value={vitalsForm.bloodPressure} onChange={e => setVitalsForm(p => ({ ...p, bloodPressure: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">FC (/min)</Label><Input placeholder="80" value={vitalsForm.heartRate} onChange={e => setVitalsForm(p => ({ ...p, heartRate: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">FR (/min)</Label><Input placeholder="16" value={vitalsForm.respiratoryRate} onChange={e => setVitalsForm(p => ({ ...p, respiratoryRate: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">SpO2 (%)</Label><Input placeholder="98" value={vitalsForm.oxygenSaturation} onChange={e => setVitalsForm(p => ({ ...p, oxygenSaturation: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">GCS (/15)</Label><Input placeholder="15" value={vitalsForm.gcs} onChange={e => setVitalsForm(p => ({ ...p, gcs: e.target.value }))} className="mt-1" /></div>
            <div><Label className="text-xs">Douleur (/10)</Label><Input placeholder="3" value={vitalsForm.pain} onChange={e => setVitalsForm(p => ({ ...p, pain: e.target.value }))} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowVitalsDialog(false)}>Annuler</Button>
            <Button className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white" onClick={() => createVitals.mutate({ patientId, serviceId: patient.serviceId, ...vitalsForm })}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Observation Dialog */}
      <Dialog open={showObsDialog} onOpenChange={setShowObsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-[var(--pulseboard-green)]" />
              Ajouter une observation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Catégorie</Label>
              <div className="flex gap-2 mt-1.5">
                {(["clinique", "infirmier", "evolution", "autre"] as const).map(c => (
                  <button key={c} onClick={() => setObsCategory(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${obsCategory === c ? "bg-[var(--pulseboard-green)] text-white" : "bg-gray-100 text-muted-foreground hover:bg-gray-200"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Observation</Label>
              <Textarea placeholder="Décrivez votre observation..." value={obsContent} onChange={e => setObsContent(e.target.value)} className="mt-1 min-h-[120px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowObsDialog(false)}>Annuler</Button>
            <Button className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white" disabled={!obsContent.trim()} onClick={() => createObs.mutate({ patientId, serviceId: patient.serviceId, content: obsContent, category: obsCategory })}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-[var(--pulseboard-green)]" />
              Ajouter une tâche
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Titre</Label>
              <Input placeholder="Ex: Bilan sanguin, Scanner..." value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Description (optionnel)</Label>
              <Textarea placeholder="Détails..." value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} className="mt-1" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Priorité</Label>
              <div className="flex gap-2 mt-1.5">
                {[{ key: "low", label: "Basse" }, { key: "medium", label: "Moyenne" }, { key: "high", label: "Haute" }, { key: "urgent", label: "Urgent" }].map(p => (
                  <button key={p.key} onClick={() => setTaskForm(prev => ({ ...prev, priority: p.key }))} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${taskForm.priority === p.key ? (p.key === "urgent" ? "bg-[var(--pulseboard-red)] text-white" : p.key === "high" ? "bg-[var(--pulseboard-amber)] text-white" : "bg-[var(--pulseboard-green)] text-white") : "bg-gray-100 text-muted-foreground hover:bg-gray-200"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTaskDialog(false)}>Annuler</Button>
            <Button className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white" disabled={!taskForm.title.trim()} onClick={() => createTask.mutate({ patientId, serviceId: patient.serviceId, title: taskForm.title, description: taskForm.description || undefined, priority: taskForm.priority as any })}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

