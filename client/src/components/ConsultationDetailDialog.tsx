import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { useLocation } from "wouter";
import { Clock, Calendar, FlaskConical, FileText, ChevronDown, ChevronUp, Bed, Forward } from "lucide-react";

const EXAMENS_COMMUNS = [
  "NFS", "CRP", "VS", "Glycémie", "Urée", "Créatinine",
  "Ionogramme", "Bilan hépatique", "ECG", "Radiographie thorax",
  "Echo abdominale", "TDM cérébrale", "ECBU", "Hémocultures",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  consultation: {
    id: number;
    serviceId: number;
    patientFirstName: string;
    patientLastName: string;
    motif: string;
    status: string;
    rapport?: string | null;
    examensPara?: string | null;
    rendezVous?: Date | string | null;
    disposition?: "hospitalise" | "refere" | null;
    linkedPatientId?: number | null;
    referralDestination?: string | null;
    referralReason?: string | null;
  };
}

export default function ConsultationDetailDialog({ open, onOpenChange, consultation }: Props) {
  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const [rapport, setRapport] = useState(consultation.rapport || "");
  const [examensLibre, setExamensLibre] = useState("");
  const [examensCoches, setExamensCoches] = useState<string[]>(
    consultation.examensPara ? consultation.examensPara.split("|").filter(Boolean) : []
  );
  const [rendezVous, setRendezVous] = useState(
    consultation.rendezVous ? new Date(consultation.rendezVous).toISOString().slice(0, 16) : ""
  );
  const [status, setStatus] = useState(consultation.status);
  const [showHistory, setShowHistory] = useState(false);
  const [showHospitalize, setShowHospitalize] = useState(false);
  const [hospitalBed, setHospitalBed] = useState("");
  const [hospitalStatus, setHospitalStatus] = useState<"stable" | "modere" | "critique">("stable");
  const [showReferral, setShowReferral] = useState(false);
  const [referralDestination, setReferralDestination] = useState("");
  const [referralReason, setReferralReason] = useState("");

  const { data: history = [] } = trpc.consultations.history.useQuery({
    serviceId: consultation.serviceId,
    firstName: consultation.patientFirstName,
    lastName: consultation.patientLastName,
  }, { enabled: showHistory });

  const updateDetails = trpc.consultations.updateDetails.useMutation({
    onSuccess: () => {
      utils.consultations.list.invalidate({ serviceId: consultation.serviceId });
      toast.success("Consultation enregistrée");
      onOpenChange(false);
    },
  });

  const hospitalize = trpc.consultations.hospitalize.useMutation({
    onSuccess: ({ patientId }) => {
      utils.consultations.list.invalidate({ serviceId: consultation.serviceId });
      utils.patients.list.invalidate({ serviceId: consultation.serviceId });
      utils.alerts.byService.invalidate({ serviceId: consultation.serviceId, onlyActive: true });
      toast.success("Patient hospitalisé depuis la consultation");
      setShowHospitalize(false);
      onOpenChange(false);
      navigate(`/patient/${patientId}`);
    },
    onError: (error) => toast.error(error.message),
  });

  const referConsultation = trpc.consultations.refer.useMutation({
    onSuccess: () => {
      utils.consultations.list.invalidate({ serviceId: consultation.serviceId });
      toast.success("Patient référé avec succès");
      setShowReferral(false);
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const toggleExamen = (ex: string) => {
    setExamensCoches(prev =>
      prev.includes(ex) ? prev.filter(e => e !== ex) : [...prev, ex]
    );
  };

  const allExamens = [
    ...examensCoches.filter(e => !EXAMENS_COMMUNS.includes(e)),
    ...(examensLibre.trim() ? [] : []),
  ];

  const buildExamensPara = () => {
    const custom = examensLibre.split(",").map(e => e.trim()).filter(Boolean);
    return Array.from(new Set([...examensCoches, ...custom])).join("|");
  };

  return <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--pulseboard-green)]" />
            {consultation.patientFirstName} {consultation.patientLastName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">Motif : {consultation.motif}</p>
          {consultation.disposition && (
            <Badge className={consultation.disposition === "hospitalise" ? "bg-[var(--pulseboard-green-light)] text-[var(--pulseboard-green)]" : "bg-[var(--pulseboard-blue-light)] text-[var(--pulseboard-blue)]"}>
              {consultation.disposition === "hospitalise" ? "Hospitalisé" : `Référé${consultation.referralDestination ? ` vers ${consultation.referralDestination}` : ""}`}
            </Badge>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* Statut */}
          <div>
            <Label className="text-xs">Statut</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en_attente">En attente</SelectItem>
                <SelectItem value="vu">Vu</SelectItem>
                <SelectItem value="reporte">Reporté</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rapport de consultation */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              <FileText className="w-3 h-3" /> Compte-rendu de consultation
            </Label>
            <Textarea
              className="mt-1 text-sm"
              rows={4}
              placeholder="Ce qui s'est passé durant la consultation, examen clinique, conclusion..."
              value={rapport}
              onChange={e => setRapport(e.target.value)}
            />
          </div>

          {/* Examens paracliniques */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              <FlaskConical className="w-3 h-3" /> Examens paracliniques demandés
            </Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXAMENS_COMMUNS.map(ex => (
                <button
                  key={ex}
                  onClick={() => toggleExamen(ex)}
                  className={`px-2 py-1 rounded-full text-xs border transition-colors ${
                    examensCoches.includes(ex)
                      ? "bg-[var(--pulseboard-green)] text-white border-[var(--pulseboard-green)]"
                      : "bg-white text-muted-foreground border-border hover:border-[var(--pulseboard-green)]"
                  }`}
                >
                  {ex}
                </button>
              ))}
            </div>
            <Input
              className="mt-2 text-sm"
              placeholder="Autres examens (séparés par virgule)..."
              value={examensLibre}
              onChange={e => setExamensLibre(e.target.value)}
            />
          </div>

          {/* Rendez-vous */}
          <div>
            <Label className="text-xs flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Prochain rendez-vous
            </Label>
            <Input
              type="datetime-local"
              className="mt-1 text-sm"
              value={rendezVous}
              onChange={e => setRendezVous(e.target.value)}
            />
          </div>

          {/* Historique */}
          <div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              Historique des consultations
              {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showHistory && (
              <div className="mt-2 space-y-2 border-l-2 border-border pl-3">
                {history.length === 0 && <p className="text-xs text-muted-foreground">Première consultation</p>}
                {history.filter(h => h.id !== consultation.id).map(h => (
                  <div key={h.id} className="text-xs">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium">{new Date(h.consultDate).toLocaleDateString("fr-FR")}</span>
                      <Badge variant="outline" className="text-[10px] h-4">{h.status === "vu" ? "Vu" : h.status === "reporte" ? "Reporté" : "En attente"}</Badge>
                    </div>
                    <p className="text-muted-foreground">Motif : {h.motif}</p>
                    {h.rapport && <p className="text-muted-foreground mt-0.5 line-clamp-2">{h.rapport}</p>}
                    {h.examensPara && <p className="text-[var(--pulseboard-green)] mt-0.5">🔬 {h.examensPara.replace(/\|/g, ", ")}</p>}
                    {h.rendezVous && <p className="text-[var(--pulseboard-amber)] mt-0.5">📅 RDV : {new Date(h.rendezVous).toLocaleString("fr-FR")}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          {!consultation.disposition && !consultation.linkedPatientId && <>
            <Button variant="outline" onClick={() => setShowReferral(true)}>
              <Forward className="w-4 h-4 mr-1" /> Référer
            </Button>
            <Button variant="outline" onClick={() => setShowHospitalize(true)}>
              <Bed className="w-4 h-4 mr-1" /> Hospitaliser
            </Button>
          </>}
          <Button
            className="bg-[var(--pulseboard-green)] text-white"
            disabled={updateDetails.isPending}
            onClick={() => updateDetails.mutate({
              id: consultation.id,
              serviceId: consultation.serviceId,
              rapport: rapport || undefined,
              examensPara: buildExamensPara() || undefined,
              rendezVous: rendezVous || undefined,
              status: status as any,
            })}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={showHospitalize} onOpenChange={setShowHospitalize}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Hospitaliser après consultation</DialogTitle>
          <p className="text-sm text-muted-foreground">{consultation.patientFirstName} {consultation.patientLastName}</p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Numéro de lit (optionnel)</Label>
            <Input type="number" min="1" value={hospitalBed} onChange={e => setHospitalBed(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>État clinique</Label>
            <Select value={hospitalStatus} onValueChange={(value: "stable" | "modere" | "critique") => setHospitalStatus(value)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stable">Stable</SelectItem>
                <SelectItem value="modere">Modéré</SelectItem>
                <SelectItem value="critique">Critique</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowHospitalize(false)}>Annuler</Button>
          <Button disabled={hospitalize.isPending} onClick={() => hospitalize.mutate({ id: consultation.id, bedNumber: hospitalBed ? parseInt(hospitalBed) : undefined, status: hospitalStatus })}>
            {hospitalize.isPending ? "Hospitalisation..." : "Confirmer l'hospitalisation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={showReferral} onOpenChange={setShowReferral}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Référer le patient</DialogTitle>
          <p className="text-sm text-muted-foreground">Enregistrez la destination et le motif du transfert.</p>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label>Établissement ou service de destination *</Label><Input value={referralDestination} onChange={e => setReferralDestination(e.target.value)} placeholder="Ex : CHU de Fann — Cardiologie" className="mt-1" /></div>
          <div><Label>Motif de référence *</Label><Textarea value={referralReason} onChange={e => setReferralReason(e.target.value)} placeholder="Motif clinique et informations utiles..." className="mt-1" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowReferral(false)}>Annuler</Button>
          <Button disabled={referConsultation.isPending || referralDestination.trim().length < 2 || referralReason.trim().length < 2} onClick={() => referConsultation.mutate({ id: consultation.id, destination: referralDestination.trim(), reason: referralReason.trim() })}>
            {referConsultation.isPending ? "Référence..." : "Confirmer la référence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
