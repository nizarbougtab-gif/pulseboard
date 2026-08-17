import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { ArrowLeft, User, Building2, Stethoscope, Save, Download, CreditCard, Trash2, LogOut } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Profile() {
  const { user, isAuthenticated, loading, logout } = useAuth({
    redirectOnUnauthenticated: true,
    redirectPath: getLoginUrl("/profile"),
  });
  const [, navigate] = useLocation();
  const { data: hospitals } = trpc.hospitals.list.useQuery();

  const [name, setName] = useState("");
  const [medicalRole, setMedicalRole] = useState<string>("");
  const [hospitalId, setHospitalId] = useState<string>("");

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("Profil mis à jour avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });
  const exportData = trpc.account.exportData.useMutation({
    onSuccess: data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `pulseboard-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Export téléchargé");
    },
    onError: error => toast.error(error.message),
  });
  const deletion = trpc.account.requestDeletion.useMutation({ onSuccess: data => toast.success(data.message), onError: error => toast.error(error.message) });

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setMedicalRole((user as any).medicalRole || "interne");
      setHospitalId((user as any).hospitalId?.toString() || "");
    }
  }, [user]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleSave = () => {
    updateProfile.mutate({
      name: name || undefined,
      medicalRole: medicalRole as any || undefined,
      hospitalId: hospitalId ? parseInt(hospitalId) : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container flex items-center h-16">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="font-semibold text-base ml-3">Mon profil</h1>
        </div>
      </header>

      <main className="container py-8 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Informations personnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Dr. Prénom Nom" />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4" /> Rôle médical
              </Label>
              <Select value={medicalRole} onValueChange={setMedicalRole} disabled={Boolean((user as any)?.medicalRoleVerified)}>
                <SelectTrigger><SelectValue placeholder="Choisir un rôle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="externe">Étudiant / Externe (6e–8e année)</SelectItem>
                  <SelectItem value="interne">Interne</SelectItem>
                  <SelectItem value="resident">Résident</SelectItem>
                  <SelectItem value="medecin">Médecin</SelectItem>
                </SelectContent>
              </Select>
              {(user as any)?.medicalRoleVerified && <p className="text-xs text-[var(--pulseboard-green)]">✓ Rôle médical confirmé — modification verrouillée</p>}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Établissement
              </Label>
              <Select value={hospitalId} onValueChange={setHospitalId}>
                <SelectTrigger><SelectValue placeholder="Choisir un établissement" /></SelectTrigger>
                <SelectContent>
                  {hospitals?.map(h => (
                    <SelectItem key={h.id} value={h.id.toString()}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">L'email est associé à votre compte PulseBoard.</p>
            </div>

            <Button onClick={handleSave} disabled={updateProfile.isPending} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {updateProfile.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
            <div className="border-t pt-5 space-y-3">
              <h2 className="font-semibold">Abonnement et données</h2>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("/subscription")}><CreditCard className="w-4 h-4 mr-2" />Voir mon offre</Button>
              <Button variant="outline" className="w-full justify-start" disabled={exportData.isPending} onClick={() => exportData.mutate()}><Download className="w-4 h-4 mr-2" />Exporter les données de mon carnet</Button>
              <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" disabled={deletion.isPending} onClick={() => { if (window.confirm("Demander la suppression de votre compte ? Cette demande sera vérifiée avant exécution.")) deletion.mutate({ confirmation: "SUPPRIMER" }); }}><Trash2 className="w-4 h-4 mr-2" />Demander la suppression du compte</Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => logout()}><LogOut className="w-4 h-4 mr-2" />Se déconnecter</Button>
              <p className="text-xs text-muted-foreground">Consultez aussi la <a className="underline" href="/privacy">politique de confidentialité</a> et les <a className="underline" href="/terms">conditions d'utilisation</a>.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
