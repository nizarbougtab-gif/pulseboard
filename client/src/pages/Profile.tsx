import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { ArrowLeft, User, Building2, Stethoscope, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export default function Profile() {
  const { user, isAuthenticated, loading } = useAuth();
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
    window.location.href = getLoginUrl("/profile");
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
              <Select value={medicalRole} onValueChange={setMedicalRole}>
                <SelectTrigger><SelectValue placeholder="Choisir un rôle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="externe">Externe</SelectItem>
                  <SelectItem value="interne">Interne</SelectItem>
                  <SelectItem value="resident">Résident</SelectItem>
                  <SelectItem value="medecin">Médecin</SelectItem>
                </SelectContent>
              </Select>
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
              <p className="text-xs text-muted-foreground">L'email est géré par votre compte Manus.</p>
            </div>

            <Button onClick={handleSave} disabled={updateProfile.isPending} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {updateProfile.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
