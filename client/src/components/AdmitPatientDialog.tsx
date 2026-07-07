import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId: number;
}

export default function AdmitPatientDialog({ open, onOpenChange, serviceId }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bedNumber, setBedNumber] = useState("");
  const [status, setStatus] = useState<"stable" | "modere" | "critique">("stable");
  const [diagnosis, setDiagnosis] = useState("");
  const [allergies, setAllergies] = useState("");
  const [gender, setGender] = useState<"M" | "F">("M");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");

  const utils = trpc.useUtils();
  const createPatient = trpc.patients.create.useMutation({
    onSuccess: () => {
      utils.patients.list.invalidate();
      utils.alerts.byService.invalidate();
      toast.success("Patient admis avec succès");
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast.error("Erreur lors de l'admission");
    },
  });

  const resetForm = () => {
    setFirstName(""); setLastName(""); setBedNumber(""); setStatus("stable");
    setDiagnosis(""); setAllergies(""); setGender("M"); setDateOfBirth(""); setPhone("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName) {
      toast.error("Le nom et le prénom sont obligatoires");
      return;
    }
    createPatient.mutate({
      firstName,
      lastName,
      serviceId,
      bedNumber: bedNumber ? parseInt(bedNumber) : undefined,
      status,
      diagnosis: diagnosis || undefined,
      allergies: allergies || undefined,
      gender,
      dateOfBirth: dateOfBirth || undefined,
      phone: phone || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admettre un patient</DialogTitle>
          <DialogDescription>Renseignez les informations du nouveau patient.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input placeholder="Nom de famille" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Prénom *</Label>
              <Input placeholder="Prénom" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Genre</Label>
              <Select value={gender} onValueChange={(v: "M" | "F") => setGender(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculin</SelectItem>
                  <SelectItem value="F">Féminin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date de naissance</Label>
              <Input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input placeholder="+221..." value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Numéro de lit</Label>
              <Input type="number" min="1" placeholder="ex: 5" value={bedNumber} onChange={e => setBedNumber(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={status} onValueChange={(v: "stable" | "modere" | "critique") => setStatus(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="stable">Stable</SelectItem>
                  <SelectItem value="modere">Modéré</SelectItem>
                  <SelectItem value="critique">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Diagnostic</Label>
            <Textarea placeholder="Diagnostic principal..." value={diagnosis} onChange={e => setDiagnosis(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Allergies</Label>
            <Input placeholder="ex: Pénicilline, Bétadine..." value={allergies} onChange={e => setAllergies(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={createPatient.isPending}>
              {createPatient.isPending ? "Admission..." : "Admettre le patient"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

