import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Bed, Stethoscope } from "lucide-react";

type CarePath = "hospitalisation" | "consultation";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: number;
  onCreated?: (path: CarePath, id: number) => void;
}

export default function AdmitPatientDialog({ open, onOpenChange, serviceId, onCreated }: Props) {
  const [carePath, setCarePath] = useState<CarePath>("hospitalisation");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bedNumber, setBedNumber] = useState("");
  const [status, setStatus] = useState<"stable" | "modere" | "critique">("stable");
  const [diagnosis, setDiagnosis] = useState("");
  const [allergies, setAllergies] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [profession, setProfession] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [motif, setMotif] = useState("");
  const [consultNotes, setConsultNotes] = useState("");

  const utils = trpc.useUtils();

  const resetForm = () => {
    setCarePath("hospitalisation");
    setFirstName("");
    setLastName("");
    setBedNumber("");
    setStatus("stable");
    setDiagnosis("");
    setAllergies("");
    setGender("M");
    setDateOfBirth("");
    setPhone("");
    setProfession("");
    setAddress("");
    setEmergencyContact("");
    setMotif("");
    setConsultNotes("");
  };

  const closeDialog = () => {
    onOpenChange(false);
    resetForm();
  };

  const createPatient = trpc.patients.create.useMutation({
    onSuccess: ({ id }) => {
      utils.patients.list.invalidate();
      utils.alerts.byService.invalidate();
      toast.success("Patient hospitalisé avec succès");
      closeDialog();
      onCreated?.("hospitalisation", id);
    },
    onError: (error) => toast.error(error.message || "Erreur lors de l'hospitalisation"),
  });

  const createConsultation = trpc.consultations.create.useMutation({
    onSuccess: ({ id }) => {
      utils.consultations.list.invalidate({ serviceId });
      toast.success("Consultation créée avec succès");
      closeDialog();
      onCreated?.("consultation", id);
    },
    onError: (error) => toast.error(error.message || "Erreur lors de la création de la consultation"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Le nom et le prénom du patient sont obligatoires");
      return;
    }

    if (carePath === "consultation") {
      if (!motif.trim()) {
        toast.error("Le motif de consultation est obligatoire");
        return;
      }
      createConsultation.mutate({
        serviceId,
        patientFirstName: firstName.trim(),
        patientLastName: lastName.trim(),
        patientDateOfBirth: dateOfBirth || undefined,
        patientGender: gender,
        patientProfession: profession.trim() || undefined,
        patientAddress: address.trim() || undefined,
        patientPhone: phone.trim() || undefined,
        patientEmergencyContact: emergencyContact.trim() || undefined,
        motif: motif.trim(),
        notes: consultNotes.trim() || undefined,
      });
      return;
    }

    createPatient.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      serviceId,
      bedNumber: bedNumber ? parseInt(bedNumber) : undefined,
      status,
      diagnosis: diagnosis.trim() || undefined,
      allergies: allergies.trim() || undefined,
      gender,
      dateOfBirth: dateOfBirth || undefined,
      profession: profession.trim() || undefined,
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
      emergencyContact: emergencyContact.trim() || undefined,
    });
  };

  const isPending = createPatient.isPending || createConsultation.isPending;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : closeDialog()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau parcours patient</DialogTitle>
          <DialogDescription>Choisissez une hospitalisation ou une consultation.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCarePath("hospitalisation")}
              className={`rounded-xl border p-3 text-left transition-all ${carePath === "hospitalisation" ? "border-[var(--pulseboard-green)] bg-[var(--pulseboard-green-light)]" : "border-border hover:border-[var(--pulseboard-green)]/40"}`}
            >
              <Bed className="w-5 h-5 text-[var(--pulseboard-green)] mb-2" />
              <div className="text-sm font-semibold">Hospitaliser</div>
              <div className="text-xs text-muted-foreground">Créer un dossier d'hospitalisation</div>
            </button>
            <button
              type="button"
              onClick={() => setCarePath("consultation")}
              className={`rounded-xl border p-3 text-left transition-all ${carePath === "consultation" ? "border-[var(--pulseboard-green)] bg-[var(--pulseboard-green-light)]" : "border-border hover:border-[var(--pulseboard-green)]/40"}`}
            >
              <Stethoscope className="w-5 h-5 text-[var(--pulseboard-green)] mb-2" />
              <div className="text-sm font-semibold">Consulter</div>
              <div className="text-xs text-muted-foreground">Ajouter aux consultations</div>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input maxLength={100} autoComplete="family-name" placeholder="Ndiaye" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prénom *</Label>
              <Input maxLength={100} autoComplete="given-name" placeholder="Aminata" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Genre</Label>
                <Select value={gender} onValueChange={(v: "M" | "F") => setGender(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="M">Masculin</SelectItem><SelectItem value="F">Féminin</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date de naissance</Label>
                <Input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Profession</Label>
                <Input placeholder="Enseignante" value={profession} onChange={e => setProfession(e.target.value)} />
              </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Téléphone</Label><Input placeholder="+221..." value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div className="space-y-2"><Label>Contact d'urgence</Label><Input placeholder="Nom et téléphone" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Adresse</Label><Input placeholder="Quartier, ville" value={address} onChange={e => setAddress(e.target.value)} /></div>

          {carePath === "hospitalisation" ? <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Numéro de lit</Label>
                <Input type="number" min="1" placeholder="ex : 5" value={bedNumber} onChange={e => setBedNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={status} onValueChange={(v: "stable" | "modere" | "critique") => setStatus(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="stable">Stable</SelectItem><SelectItem value="modere">Modéré</SelectItem><SelectItem value="critique">Critique</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Diagnostic</Label>
              <Textarea placeholder="Diagnostic principal..." value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Allergies</Label>
              <Input placeholder="ex : Pénicilline, Bétadine..." value={allergies} onChange={e => setAllergies(e.target.value)} />
            </div>
          </> : <>
            <div className="space-y-2">
              <Label>Motif de consultation *</Label>
              <Input placeholder="Ex : Céphalées, douleur abdominale..." value={motif} onChange={e => setMotif(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Informations utiles pour la consultation..." value={consultNotes} onChange={e => setConsultNotes(e.target.value)} />
            </div>
          </>}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={closeDialog}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Enregistrement..." : carePath === "hospitalisation" ? "Hospitaliser le patient" : "Créer la consultation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
