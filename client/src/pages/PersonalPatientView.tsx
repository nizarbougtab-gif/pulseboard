import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, FileText, ListChecks, Heart, Eye, Plus, CheckCircle, Clock, Lock } from "lucide-react";
import BottomNav from "@/components/BottomNav";

type Tab = "notes" | "taches" | "vitaux" | "obs";

export default function PersonalPatientView() {
  const { id } = useParams<{ id: string }>();
  const patientId = Number(id);
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("notes");
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showVitalsDialog, setShowVitalsDialog] = useState(false);
  const [showObsDialog, setShowObsDialog] = useState(false);

  const [noteForm, setNoteForm] = useState({ type: "dar" as "dar" | "soap" | "libre", content: "" });
  const [taskForm, setTaskForm] = useState({ title: "", description: "", priority: "medium" as "low" | "medium" | "high" | "urgent" });
  const [vitalsForm, setVitalsForm] = useState({ temperature: "", bloodPressure: "", heartRate: "", respiratoryRate: "", oxygenSaturation: "", gcs: "", pain: "", notes: "" });
  const [obsForm, setObsForm] = useState({ content: "", category: "clinique" as "clinique" | "infirmier" | "evolution" | "autre" });

  const utils = trpc.useUtils();
  const { data: patient, isLoading } = trpc.personalPatients.get.useQuery({ id: patientId });
  const { data: notes = [] } = trpc.personalPatients.notes.useQuery({ personalPatientId: patientId });
  const { data: tasks = [] } = trpc.personalPatients.tasks.useQuery({ personalPatientId: patientId });
  const { data: vitals = [] } = trpc.personalPatients.vitals.useQuery({ personalPatientId: patientId });
  const { data: observations = [] } = trpc.personalPatients.observations.useQuery({ personalPatientId: patientId });

  const addNote = trpc.personalPatients.addNote.useMutation({
    onSuccess: () => { utils.personalPatients.notes.invalidate(); setShowNoteDialog(false); setNoteForm({ type: "dar", content: "" }); toast.success("Note ajoutée"); },
  });
  const addTask = trpc.personalPatients.addTask.useMutation({
    onSuccess: () => { utils.personalPatients.tasks.invalidate(); setShowTaskDialog(false); setTaskForm({ title: "", description: "", priority: "medium" }); toast.success("Tâche ajoutée"); },
  });
  const completeTask = trpc.personalPatients.completeTask.useMutation({
    onSuccess: () => { utils.personalPatients.tasks.invalidate(); },
  });
  const deleteTask = trpc.personalPatients.deleteTask.useMutation({
    onSuccess: () => { utils.personalPatients.tasks.invalidate(); },
  });
  const addVitals = trpc.personalPatients.addVitals.useMutation({
    onSuccess: () => { utils.personalPatients.vitals.invalidate(); setShowVitalsDialog(false); setVitalsForm({ temperature: "", bloodPressure: "", heartRate: "", respiratoryRate: "", oxygenSaturation: "", gcs: "", pain: "", notes: "" }); toast.success("Vitaux enregistrés"); },
  });
  const addObs = trpc.personalPatients.addObservation.useMutation({
    onSuccess: () => { utils.personalPatients.observations.invalidate(); setShowObsDialog(false); setObsForm({ content: "", category: "clinique" }); toast.success("Observation ajoutée"); },
  });
  const updateStatus = trpc.personalPatients.update.useMutation({
    onSuccess: () => { utils.personalPatients.get.invalidate(); toast.success("Statut mis à jour"); },
  });
  const discharge = trpc.personalPatients.update.useMutation({
    onSuccess: () => { toast.success("Patient sorti"); navigate("/mon-stage"); },
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-[var(--pulseboard-green)] border-t-transparent rounded-full animate-spin" /></div>;
  if (!patient) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Patient introuvable</div>;

  const statusColor = patient.status === "critique" ? "text-[var(--pulseboard-red)]" : patient.status === "modere" ? "text-[var(--pulseboard-amber)]" : "text-[var(--pulseboard-green)]";
  const statusLabel = patient.status === "critique" ? "Critique" : patient.status === "modere" ? "Modéré" : "Stable";

  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: "notes", icon: FileText, label: "Notes" },
    { id: "taches", icon: ListChecks, label: "Tâches" },
    { id: "vitaux", icon: Heart, label: "Vitaux" },
    { id: "obs", icon: Eye, label: "Obs." },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col pb-16 md:pb-0">
      {/* Header */}
      <div className="bg-white border-b border-border/50 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate("/mon-stage")} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-base truncate">{patient.firstName} {patient.lastName}</h1>
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase">
              <Lock className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Personnel</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{patient.diagnosis || "Diagnostic en cours"} · <span className={statusColor}>{statusLabel}</span></p>
        </div>
        <Select value={patient.status} onValueChange={(v) => updateStatus.mutate({ id: patientId, status: v as any })}>
          <SelectTrigger className="w-28 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stable">Stable</SelectItem>
            <SelectItem value="modere">Modéré</SelectItem>
            <SelectItem value="critique">Critique</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-border/50 flex">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors ${activeTab === id ? "border-[var(--pulseboard-green)] text-[var(--pulseboard-green)]" : "border-transparent text-muted-foreground"}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">

        {/* NOTES */}
        {activeTab === "notes" && (
          <>
            <Button size="sm" onClick={() => setShowNoteDialog(true)} className="w-full bg-[var(--pulseboard-green)] text-white hover:bg-[var(--pulseboard-green-dark)]">
              <Plus className="w-3.5 h-3.5 mr-1" /> Nouvelle note
            </Button>
            {notes.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Aucune note</p>}
            {notes.map(n => (
              <div key={n.id} className="bg-white rounded-xl p-4 border border-border/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--pulseboard-green)]">{n.type}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleDateString("fr-FR")}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{n.content}</p>
              </div>
            ))}
          </>
        )}

        {/* TÂCHES */}
        {activeTab === "taches" && (
          <>
            <Button size="sm" onClick={() => setShowTaskDialog(true)} className="w-full bg-[var(--pulseboard-green)] text-white hover:bg-[var(--pulseboard-green-dark)]">
              <Plus className="w-3.5 h-3.5 mr-1" /> Nouvelle tâche
            </Button>
            {tasks.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Aucune tâche</p>}
            {tasks.map(t => (
              <div key={t.id} className="bg-white rounded-xl p-4 border border-border/50 flex items-center gap-3">
                <button onClick={() => t.status === "pending" && completeTask.mutate({ id: t.id })}>
                  {t.status === "completed" ? <CheckCircle className="w-5 h-5 text-[var(--pulseboard-green)]" /> : <Clock className="w-5 h-5 text-muted-foreground" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${t.status === "completed" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </div>
                <button onClick={() => deleteTask.mutate({ id: t.id })} className="text-muted-foreground hover:text-[var(--pulseboard-red)] text-xs">✕</button>
              </div>
            ))}
          </>
        )}

        {/* VITAUX */}
        {activeTab === "vitaux" && (
          <>
            <Button size="sm" onClick={() => setShowVitalsDialog(true)} className="w-full bg-[var(--pulseboard-green)] text-white hover:bg-[var(--pulseboard-green-dark)]">
              <Plus className="w-3.5 h-3.5 mr-1" /> Enregistrer vitaux
            </Button>
            {vitals.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Aucun relevé</p>}
            {vitals.map(v => (
              <div key={v.id} className="bg-white rounded-xl p-4 border border-border/50">
                <p className="text-[10px] text-muted-foreground mb-2">{new Date(v.recordedAt).toLocaleString("fr-FR")}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {v.temperature && <span>🌡️ {v.temperature}°C</span>}
                  {v.bloodPressure && <span>💓 {v.bloodPressure}</span>}
                  {v.heartRate && <span>❤️ {v.heartRate} bpm</span>}
                  {v.oxygenSaturation && <span>🫁 SpO2 {v.oxygenSaturation}%</span>}
                  {v.respiratoryRate && <span>💨 FR {v.respiratoryRate}/min</span>}
                  {v.gcs && <span>🧠 GCS {v.gcs}</span>}
                </div>
                {v.notes && <p className="text-xs text-muted-foreground mt-2">{v.notes}</p>}
              </div>
            ))}
          </>
        )}

        {/* OBSERVATIONS */}
        {activeTab === "obs" && (
          <>
            <Button size="sm" onClick={() => setShowObsDialog(true)} className="w-full bg-[var(--pulseboard-green)] text-white hover:bg-[var(--pulseboard-green-dark)]">
              <Plus className="w-3.5 h-3.5 mr-1" /> Nouvelle observation
            </Button>
            {observations.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">Aucune observation</p>}
            {observations.map(o => (
              <div key={o.id} className="bg-white rounded-xl p-4 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold uppercase text-[var(--pulseboard-green)]">{o.category}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(o.createdAt).toLocaleDateString("fr-FR")}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{o.content}</p>
              </div>
            ))}
          </>
        )}

        {/* Sortie patient */}
        <button onClick={() => discharge.mutate({ id: patientId, discharged: true })}
          className="w-full text-xs text-muted-foreground hover:text-[var(--pulseboard-red)] py-3 transition-colors">
          Marquer comme sorti
        </button>
      </div>

      {/* Note dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouvelle note</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={noteForm.type} onValueChange={(v) => setNoteForm(p => ({ ...p, type: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dar">DAR</SelectItem>
                <SelectItem value="soap">SOAP</SelectItem>
                <SelectItem value="libre">Libre</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Contenu de la note..." value={noteForm.content} onChange={e => setNoteForm(p => ({ ...p, content: e.target.value }))} rows={5} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNoteDialog(false)}>Annuler</Button>
            <Button className="bg-[var(--pulseboard-green)] text-white" disabled={!noteForm.content.trim()} onClick={() => addNote.mutate({ personalPatientId: patientId, ...noteForm })}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouvelle tâche</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Titre de la tâche" value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} />
            <Input placeholder="Description (optionnel)" value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} />
            <Select value={taskForm.priority} onValueChange={(v) => setTaskForm(p => ({ ...p, priority: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="medium">Moyen</SelectItem>
                <SelectItem value="high">Élevé</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTaskDialog(false)}>Annuler</Button>
            <Button className="bg-[var(--pulseboard-green)] text-white" disabled={!taskForm.title.trim()} onClick={() => addTask.mutate({ personalPatientId: patientId, ...taskForm })}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vitals dialog */}
      <Dialog open={showVitalsDialog} onOpenChange={setShowVitalsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Enregistrer les vitaux</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "temperature", label: "Température (°C)" },
              { key: "bloodPressure", label: "Tension (mmHg)" },
              { key: "heartRate", label: "FC (bpm)" },
              { key: "oxygenSaturation", label: "SpO2 (%)" },
              { key: "respiratoryRate", label: "FR (/min)" },
              { key: "gcs", label: "GCS" },
              { key: "pain", label: "Douleur /10" },
            ].map(({ key, label }) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input className="mt-1 h-8 text-sm" value={(vitalsForm as any)[key]} onChange={e => setVitalsForm(p => ({ ...p, [key]: e.target.value }))} />
              </div>
            ))}
            <div className="col-span-2">
              <Label className="text-xs">Notes</Label>
              <Input className="mt-1 h-8 text-sm" value={vitalsForm.notes} onChange={e => setVitalsForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowVitalsDialog(false)}>Annuler</Button>
            <Button className="bg-[var(--pulseboard-green)] text-white" onClick={() => addVitals.mutate({ personalPatientId: patientId, ...vitalsForm })}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Observation dialog */}
      <Dialog open={showObsDialog} onOpenChange={setShowObsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouvelle observation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={obsForm.category} onValueChange={(v) => setObsForm(p => ({ ...p, category: v as any }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clinique">Clinique</SelectItem>
                <SelectItem value="infirmier">Infirmier</SelectItem>
                <SelectItem value="evolution">Évolution</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Observation..." value={obsForm.content} onChange={e => setObsForm(p => ({ ...p, content: e.target.value }))} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowObsDialog(false)}>Annuler</Button>
            <Button className="bg-[var(--pulseboard-green)] text-white" disabled={!obsForm.content.trim()} onClick={() => addObs.mutate({ personalPatientId: patientId, ...obsForm })}>Ajouter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
