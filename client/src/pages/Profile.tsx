import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { ArrowLeft, User, Building2, Stethoscope, Save, Download, CreditCard, Trash2, LogOut, ShieldCheck } from "lucide-react";
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
  const [showRoleRequest, setShowRoleRequest] = useState(false);
  const [requestedRole, setRequestedRole] = useState<string>("");
  const [roleReason, setRoleReason] = useState("");
  const utils = trpc.useUtils();
  const { data: roleStatus } = trpc.profile.roleStatus.useQuery();

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
  const requestRoleChange = trpc.profile.requestRoleChange.useMutation({
    onSuccess: () => {
      utils.profile.roleStatus.invalidate();
      setShowRoleRequest(false);
      setRequestedRole("");
      setRoleReason("");
      toast.success("Demande envoyée aux membres vérifiés de votre Hall");
    },
    onError: error => toast.error(error.message),
  });
  const cancelRoleChange = trpc.profile.cancelRoleChange.useMutation({
    onSuccess: () => { utils.profile.roleStatus.invalidate(); toast.success("Demande annulée"); },
    onError: error => toast.error(error.message),
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
    return null;
  }

  const handleSave = () => {
    updateProfile.mutate({
      name: name || undefined,
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
              <Select value={medicalRole} disabled>
                <SelectTrigger><SelectValue placeholder="Choisir un rôle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="externe">Étudiant / Externe (6e–8e année)</SelectItem>
                  <SelectItem value="interne">Interne</SelectItem>
                  <SelectItem value="resident">Résident</SelectItem>
                  <SelectItem value="medecin">Médecin</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  {(user as any)?.medicalRoleVerified ? "✓ Rôle médical confirmé et verrouillé" : "Rôle déclaré verrouillé · accès provisoire jusqu’à confirmation"}
                </p>
                {!roleStatus?.pendingRequest && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowRoleRequest(true)}>
                    Demander un changement
                  </Button>
                )}
              </div>
              {roleStatus?.pendingRequest && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="flex items-center justify-between gap-2">
                    <span>Demande en attente : {roleStatus.pendingRequest.currentRole} → {roleStatus.pendingRequest.requestedRole}</span>
                    <Badge variant="outline">En validation</Badge>
                  </div>
                  <p className="text-xs mt-1">Un médecin vérifié ou deux résidents vérifiés doivent confirmer.</p>
                  <Button type="button" size="sm" variant="ghost" className="mt-1" disabled={cancelRoleChange.isPending} onClick={() => cancelRoleChange.mutate({ requestId: roleStatus.pendingRequest!.id })}>Annuler la demande</Button>
                </div>
              )}
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
        {roleStatus?.history && roleStatus.history.length > 0 && (
          <Card className="mt-5">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="w-4 h-4" />Historique du rôle</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {roleStatus.history.slice(0, 5).map(request => (
                <div key={request.id} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                  <span className="font-medium">{request.currentRole} → {request.requestedRole}</span>
                  <span className="text-muted-foreground"> · {request.status === "pending" ? "En attente" : request.status === "approved" ? "Approuvée" : request.status === "rejected" ? "Refusée" : "Annulée"}</span>
                  <p className="text-xs text-muted-foreground">{new Date(request.createdAt).toLocaleString("fr-FR")}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={showRoleRequest} onOpenChange={setShowRoleRequest}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Demander un changement de rôle</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Cette demande sera tracée. Vous ne pouvez pas la valider vous-même.</p>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nouveau rôle</Label>
              <Select value={requestedRole} onValueChange={setRequestedRole}>
                <SelectTrigger><SelectValue placeholder="Choisir le nouveau rôle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="externe">Étudiant / Externe</SelectItem>
                  <SelectItem value="interne">Interne</SelectItem>
                  <SelectItem value="resident">Résident</SelectItem>
                  <SelectItem value="medecin">Médecin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Motif ou justificatif</Label><Textarea value={roleReason} onChange={event => setRoleReason(event.target.value)} placeholder="Exemple : passage au statut de résident à compter du..." /></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setShowRoleRequest(false)}>Annuler</Button><Button disabled={!requestedRole || roleReason.trim().length < 10 || requestRoleChange.isPending} onClick={() => requestRoleChange.mutate({ requestedRole: requestedRole as any, reason: roleReason.trim() })}>Envoyer la demande</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
