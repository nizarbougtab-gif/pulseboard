import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

const specialties = [
  "Cardiologie", "Neurologie", "Chirurgie Générale", "Pédiatrie",
  "Gynécologie-Obstétrique", "Maladies Infectieuses", "Médecine Interne",
  "Urgences", "Réanimation", "ORL", "Ophtalmologie", "Dermatologie",
  "Pneumologie", "Gastro-entérologie", "Néphrologie", "Rhumatologie",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateServiceDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [hospitalId, setHospitalId] = useState("");
  const [totalBeds, setTotalBeds] = useState("20");

  const { data: hospitals } = trpc.hospitals.list.useQuery();
  const utils = trpc.useUtils();
  const createService = trpc.services.create.useMutation({
    onSuccess: () => {
      utils.services.list.invalidate();
      toast.success("Service créé avec succès");
      onOpenChange(false);
      setName("");
      setSpecialty("");
      setHospitalId("");
      setTotalBeds("20");
    },
    onError: (err) => {
      toast.error("Erreur lors de la création du service");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !specialty || !hospitalId) {
      toast.error("Veuillez remplir tous les champs obligatoires");
      return;
    }
    createService.mutate({
      name,
      specialty,
      hospitalId: parseInt(hospitalId),
      totalBeds: parseInt(totalBeds) || 20,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Créer un service</DialogTitle>
          <DialogDescription>Configurez un nouveau service médical dans votre établissement.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du service</Label>
            <Input id="name" placeholder="ex: Cardiologie A" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="specialty">Spécialité</Label>
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir une spécialité" />
              </SelectTrigger>
              <SelectContent>
                {specialties.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hospital">Établissement</Label>
            <Select value={hospitalId} onValueChange={setHospitalId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un établissement" />
              </SelectTrigger>
              <SelectContent>
                {hospitals?.map(h => (
                  <SelectItem key={h.id} value={h.id.toString()}>{h.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="beds">Nombre de lits</Label>
            <Input id="beds" type="number" min="1" max="100" value={totalBeds} onChange={e => setTotalBeds(e.target.value)} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={createService.isPending}>
              {createService.isPending ? "Création..." : "Créer le service"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

