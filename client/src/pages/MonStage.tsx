import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { ROLE_LABELS, ROLE_COLORS, type MedicalRole } from "@/lib/permissions";
import { toast } from "sonner";
import {
  ArrowLeft, Plus, BookOpen, CheckCircle, Clock, FileText,
  Stethoscope, Award, BarChart2, ListChecks, ChevronRight, LogOut
} from "lucide-react";
import { useState } from "react";
import BottomNav from "@/components/BottomNav";

type StageTab = "apercu" | "rotations" | "competences" | "notes" | "patients";

const CAT_LABELS: Record<string, string> = {
  geste_technique: "Geste technique",
  diagnostic: "Diagnostic",
  therapeutique: "Thérapeutique",
  communication: "Communication",
  autre: "Autre",
};

const CAT_COLORS: Record<string, string> = {
  geste_technique: "bg-blue-100 text-blue-700",
  diagnostic: "bg-purple-100 text-purple-700",
  therapeutique: "bg-green-100 text-green-700",
  communication: "bg-amber-100 text-amber-700",
  autre: "bg-gray-100 text-gray-600",
};

export default function MonStage() {
  const { user, medicalRole, isAuthenticated, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<StageTab>("apercu");
  const [showRotationDialog, setShowRotationDialog] = useState(false);
  const [showCompDialog, setShowCompDialog] = useState(false);
  const [rotForm, setRotForm] = useState({ serviceName: "", hospitalName: "", supervisorName: "", startDate: "", endDate: "", notes: "" });
  const [compForm, setCompForm] = useState({ title: "", category: "geste_technique" as string, notes: "" });

  const [showAdmitDialog, setShowAdmitDialog] = useState(false);
  const [admitForm, setAdmitForm] = useState({ firstName: "", lastName: "", gender: "M" as "M" | "F", dateOfBirth: "", phone: "", status: "stable" as "stable" | "modere" | "critique", diagnosis: "", allergies: "", serviceName: "", bedNumber: "" });

  const utils = trpc.useUtils();
  const { data: stats } = trpc.personal.stats.useQuery();
  const { data: rotations = [] } = trpc.rotations.mine.useQuery();
  const { data: competences = [] } = trpc.competences.mine.useQuery();
  const { data: myNotes = [] } = trpc.personal.myNotes.useQuery();
  const { data: personalPatients = [] } = trpc.personalPatients.list.useQuery();

  const createRotation = trpc.rotations.create.useMutation({
    onSuccess: () => { utils.rotations.mine.invalidate(); utils.personal.stats.invalidate(); toast.success("Rotation ajoutée"); setShowRotationDialog(false); setRotForm({ serviceName: "", hospitalName: "", supervisorName: "", startDate: "", endDate: "", notes: "" }); },
  });

  const deleteRotation = trpc.rotations.delete.useMutation({
    onSuccess: () => { utils.rotations.mine.invalidate(); utils.personal.stats.invalidate(); },
  });

  const createComp = trpc.competences.create.useMutation({
    onSuccess: () => { utils.competences.mine.invalidate(); utils.personal.stats.invalidate(); toast.success("Compétence ajoutée"); setShowCompDialog(false); setCompForm({ title: "", category: "geste_technique", notes: "" }); },
  });

  const validateComp = trpc.competences.validate.useMutation({
    onSuccess: () => { utils.competences.mine.invalidate(); utils.personal.stats.invalidate(); toast.success("Compétence validée"); },
  });

  const deleteComp = trpc.competences.delete.useMutation({
    onSuccess: () => { utils.competences.mine.invalidate(); utils.personal.stats.invalidate(); },
  });

  const admitPersonalPatient = trpc.personalPatients.create.useMutation({
    onSuccess: () => { utils.personalPatients.list.invalidate(); setShowAdmitDialog(false); setAdmitForm({ firstName: "", lastName: "", gender: "M", dateOfBirth: "", phone: "", status: "stable", diagnosis: "", allergies: "", serviceName: "", bedNumber: "" }); toast.success("Patient ajouté"); },
  });

  const deletePersonalPatient = trpc.personalPatients.delete.useMutation({
    onSuccess: () => { utils.personalPatients.list.invalidate(); },
  });

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--pulseboard-green)] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isAuthenticated) { window.location.href = getLoginUrl(); return null; }

  const tabs = [
    { key: "apercu" as StageTab, label: "Aperçu", icon: BarChart2 },
    { key: "patients" as StageTab, label: "Patients", icon: ListChecks },
    { key: "rotations" as StageTab, label: "Rotations", icon: Stethoscope },
    { key: "competences" as StageTab, label: "Compétences", icon: Award },
    { key: "notes" as StageTab, label: "Notes", icon: FileText },
  ];

  const validatedComps = competences.filter(c => c.validated).length;
  const activeRotation = rotations.find(r => !r.endDate);

  return (
    <div className="min-h-screen bg-[#f7f8f6]">
      {/* Header */}
      <header className="bg-white border-b border-border/50 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--pulseboard-green)] flex items-center justify-center">
              <BookOpen className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">Mon Stage</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {medicalRole && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${ROLE_COLORS[medicalRole as MedicalRole]}`}>
              {ROLE_LABELS[medicalRole as MedicalRole]}
            </span>
          )}
          <button onClick={() => logout()} className="text-muted-foreground hover:text-[var(--pulseboard-red)] p-1">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* User info */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-lg font-bold">{user?.name || "Utilisateur"}</h1>
        {activeRotation && (
          <p className="text-sm text-muted-foreground mt-0.5">
            En stage · {activeRotation.serviceName} — {activeRotation.hospitalName}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 flex gap-1 overflow-x-auto pb-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? "bg-[var(--pulseboard-green)] text-white"
                : "bg-white text-muted-foreground border border-border/50 hover:border-[var(--pulseboard-green)]/30"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">

        {/* APERÇU */}
        {activeTab === "apercu" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Notes écrites", value: stats?.notes ?? 0, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Tâches créées", value: stats?.tasks ?? 0, icon: ListChecks, color: "text-amber-600", bg: "bg-amber-50" },
                { label: "Rotations", value: stats?.rotations ?? 0, icon: Stethoscope, color: "text-purple-600", bg: "bg-purple-50" },
                { label: "Compétences validées", value: `${validatedComps}/${stats?.competences ?? 0}`, icon: Award, color: "text-[var(--pulseboard-green)]", bg: "bg-[var(--pulseboard-green-light)]" },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl p-4 border border-border/50">
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Rotation active */}
            {activeRotation ? (
              <div className="bg-white rounded-xl p-4 border border-[var(--pulseboard-green)]/20">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--pulseboard-green)] animate-pulse" />
                  <span className="text-xs font-semibold text-[var(--pulseboard-green)] uppercase tracking-wide">Stage en cours</span>
                </div>
                <h3 className="font-semibold">{activeRotation.serviceName}</h3>
                <p className="text-sm text-muted-foreground">{activeRotation.hospitalName}</p>
                {activeRotation.supervisorName && <p className="text-xs text-muted-foreground mt-1">Chef : {activeRotation.supervisorName}</p>}
                <p className="text-xs text-muted-foreground mt-1">
                  Depuis le {new Date(activeRotation.startDate).toLocaleDateString("fr-FR")}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-5 border border-dashed border-border text-center">
                <Stethoscope className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm font-medium">Aucun stage en cours</p>
                <p className="text-xs text-muted-foreground mb-3">Commencez par ajouter votre rotation</p>
                <Button size="sm" className="bg-[var(--pulseboard-green)] text-white" onClick={() => setShowRotationDialog(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une rotation
                </Button>
              </div>
            )}

            {/* Notes récentes */}
            {myNotes.length > 0 && (
              <div className="bg-white rounded-xl border border-border/50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                  <span className="text-sm font-semibold">Notes récentes</span>
                  <button onClick={() => setActiveTab("notes")} className="text-xs text-[var(--pulseboard-green)]">Voir tout</button>
                </div>
                {myNotes.slice(0, 3).map(note => (
                  <div key={note.id} className="px-4 py-3 border-b border-border/50 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">{note.type}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(note.createdAt).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <p className="text-xs font-medium">{note.patientName} {note.patientLastName}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{note.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ROTATIONS */}
        {activeTab === "rotations" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Mes rotations ({rotations.length})</h2>
              <Button size="sm" className="bg-[var(--pulseboard-green)] text-white h-8" onClick={() => setShowRotationDialog(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Rotation
              </Button>
            </div>
            {rotations.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-border">
                <Stethoscope className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Aucune rotation enregistrée</p>
              </div>
            ) : (
              rotations.map(r => (
                <div key={r.id} className="bg-white rounded-xl p-4 border border-border/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{r.serviceName}</span>
                        {!r.endDate && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--pulseboard-green-light)] text-[var(--pulseboard-green)] font-semibold">En cours</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{r.hospitalName}</p>
                      {r.supervisorName && <p className="text-xs text-muted-foreground">Chef : {r.supervisorName}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(r.startDate).toLocaleDateString("fr-FR")}
                        {r.endDate ? ` → ${new Date(r.endDate).toLocaleDateString("fr-FR")}` : " → en cours"}
                      </p>
                      {r.notes && <p className="text-xs text-muted-foreground mt-1 italic">{r.notes}</p>}
                    </div>
                    <button
                      onClick={() => { if (confirm("Supprimer cette rotation ?")) deleteRotation.mutate({ id: r.id }); }}
                      className="text-muted-foreground hover:text-[var(--pulseboard-red)] text-xs px-2 py-1"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* COMPÉTENCES */}
        {activeTab === "competences" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Compétences ({validatedComps}/{competences.length} validées)</h2>
              <Button size="sm" className="bg-[var(--pulseboard-green)] text-white h-8" onClick={() => setShowCompDialog(true)}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Compétence
              </Button>
            </div>
            {/* Progress bar */}
            {competences.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-border/50">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">Progression</span>
                  <span className="font-semibold text-[var(--pulseboard-green)]">{Math.round(validatedComps / competences.length * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--pulseboard-green)] rounded-full transition-all"
                    style={{ width: `${Math.round(validatedComps / competences.length * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {competences.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-border">
                <Award className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Aucune compétence enregistrée</p>
              </div>
            ) : (
              <div className="space-y-2">
                {competences.map(c => (
                  <div key={c.id} className={`bg-white rounded-xl p-3.5 border flex items-start gap-3 ${c.validated ? "border-[var(--pulseboard-green)]/20" : "border-border/50"}`}>
                    <button
                      onClick={() => !c.validated && validateComp.mutate({ id: c.id })}
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        c.validated ? "bg-[var(--pulseboard-green)] border-[var(--pulseboard-green)]" : "border-gray-300 hover:border-[var(--pulseboard-green)]"
                      }`}
                    >
                      {c.validated && <CheckCircle className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${c.validated ? "text-muted-foreground line-through" : ""}`}>{c.title}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${CAT_COLORS[c.category || "autre"]}`}>
                          {CAT_LABELS[c.category || "autre"]}
                        </span>
                        {c.validated && c.validatorName && (
                          <span className="text-[10px] text-muted-foreground">Validé par {c.validatorName}</span>
                        )}
                        {c.notes && <span className="text-[10px] text-muted-foreground italic">{c.notes}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteComp.mutate({ id: c.id })}
                      className="text-muted-foreground hover:text-[var(--pulseboard-red)] text-xs px-1"
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MES PATIENTS PERSONNELS */}
        {activeTab === "patients" && (
          <div className="space-y-3">
            <Button size="sm" onClick={() => setShowAdmitDialog(true)} className="w-full bg-[var(--pulseboard-green)] text-white hover:bg-[var(--pulseboard-green-dark)]">
              <Plus className="w-3.5 h-3.5 mr-1" /> Admettre un patient
            </Button>
            {personalPatients.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-border">
                <ListChecks className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Aucun patient personnel</p>
                <p className="text-xs text-muted-foreground">Admettez un patient pour commencer votre suivi personnel.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {personalPatients.map(p => (
                  <div key={p.id} onClick={() => navigate(`/mon-stage/patient/${p.id}`)}
                    className="bg-white rounded-xl p-4 border border-border/50 cursor-pointer hover:border-[var(--pulseboard-green)]/30 transition-all flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--pulseboard-green-light)] flex items-center justify-center text-[var(--pulseboard-green)] text-xs font-bold shrink-0">
                      {p.firstName[0]}{p.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{p.firstName} {p.lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.diagnosis || "Diagnostic en cours"} {p.serviceName ? `· ${p.serviceName}` : ""}</p>
                    </div>
                    <span className={`text-xs font-semibold ${p.status === "critique" ? "text-[var(--pulseboard-red)]" : p.status === "modere" ? "text-[var(--pulseboard-amber)]" : "text-[var(--pulseboard-green)]"}`}>
                      {p.status === "critique" ? "Critique" : p.status === "modere" ? "Modéré" : "Stable"}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MES NOTES */}
        {activeTab === "notes" && (
          <div className="space-y-3">
            <h2 className="font-semibold text-sm">Mes notes cliniques ({myNotes.length})</h2>
            {myNotes.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-border">
                <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Aucune note rédigée</p>
                <p className="text-xs text-muted-foreground">Ouvrez une fiche patient pour écrire votre première note.</p>
              </div>
            ) : (
              myNotes.map(note => (
                <div key={note.id} className="bg-white rounded-xl p-4 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold">{note.type}</Badge>
                      <span className="text-xs font-medium">{note.patientName} {note.patientLastName}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{new Date(note.createdAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{note.content}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Dialog Rotation */}
      <Dialog open={showRotationDialog} onOpenChange={setShowRotationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une rotation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Service *</Label>
                <Input placeholder="ex: Médecine Interne" value={rotForm.serviceName} onChange={e => setRotForm(f => ({ ...f, serviceName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hôpital *</Label>
                <Input placeholder="ex: CHU de Fann" value={rotForm.hospitalName} onChange={e => setRotForm(f => ({ ...f, hospitalName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Chef de service</Label>
              <Input placeholder="Nom du superviseur" value={rotForm.supervisorName} onChange={e => setRotForm(f => ({ ...f, supervisorName: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date de début *</Label>
                <Input type="date" value={rotForm.startDate} onChange={e => setRotForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date de fin</Label>
                <Input type="date" value={rotForm.endDate} onChange={e => setRotForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea placeholder="Objectifs du stage, remarques..." value={rotForm.notes} onChange={e => setRotForm(f => ({ ...f, notes: e.target.value }))} className="h-20 resize-none" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowRotationDialog(false)}>Annuler</Button>
              <Button
                className="flex-1 bg-[var(--pulseboard-green)] text-white"
                disabled={!rotForm.serviceName || !rotForm.hospitalName || !rotForm.startDate || createRotation.isPending}
                onClick={() => createRotation.mutate({ serviceId: 0, ...rotForm })}
              >
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Admettre patient personnel */}
      <Dialog open={showAdmitDialog} onOpenChange={setShowAdmitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Admettre un patient (personnel)</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nom *</Label>
                <Input placeholder="Nom de famille" value={admitForm.lastName} onChange={e => setAdmitForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prénom *</Label>
                <Input placeholder="Prénom" value={admitForm.firstName} onChange={e => setAdmitForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Genre</Label>
                <Select value={admitForm.gender} onValueChange={v => setAdmitForm(f => ({ ...f, gender: v as "M" | "F" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculin</SelectItem>
                    <SelectItem value="F">Féminin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Statut</Label>
                <Select value={admitForm.status} onValueChange={v => setAdmitForm(f => ({ ...f, status: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stable">Stable</SelectItem>
                    <SelectItem value="modere">Modéré</SelectItem>
                    <SelectItem value="critique">Critique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Diagnostic</Label>
              <Input placeholder="Diagnostic principal" value={admitForm.diagnosis} onChange={e => setAdmitForm(f => ({ ...f, diagnosis: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Service</Label>
                <Input placeholder="ex: Neurologie" value={admitForm.serviceName} onChange={e => setAdmitForm(f => ({ ...f, serviceName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">N° de lit</Label>
                <Input type="number" placeholder="ex: 5" value={admitForm.bedNumber} onChange={e => setAdmitForm(f => ({ ...f, bedNumber: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Allergies</Label>
              <Input placeholder="ex: Pénicilline..." value={admitForm.allergies} onChange={e => setAdmitForm(f => ({ ...f, allergies: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowAdmitDialog(false)}>Annuler</Button>
              <Button
                className="flex-1 bg-[var(--pulseboard-green)] text-white"
                disabled={!admitForm.firstName || !admitForm.lastName || admitPersonalPatient.isPending}
                onClick={() => admitPersonalPatient.mutate({ ...admitForm, bedNumber: admitForm.bedNumber ? Number(admitForm.bedNumber) : undefined })}
              >
                Admettre
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Compétence */}
      <Dialog open={showCompDialog} onOpenChange={setShowCompDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une compétence</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Compétence *</Label>
              <Input placeholder="ex: Pose de VVP, Ponction lombaire..." value={compForm.title} onChange={e => setCompForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Catégorie</Label>
              <Select value={compForm.category} onValueChange={v => setCompForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CAT_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input placeholder="Contexte, date, remarques..." value={compForm.notes} onChange={e => setCompForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowCompDialog(false)}>Annuler</Button>
              <Button
                className="flex-1 bg-[var(--pulseboard-green)] text-white"
                disabled={!compForm.title || createComp.isPending}
                onClick={() => createComp.mutate({ title: compForm.title, category: compForm.category as "geste_technique" | "diagnostic" | "therapeutique" | "communication" | "autre", notes: compForm.notes || undefined })}
              >
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <BottomNav />
    </div>
  );
}
