import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PulseBoardBrand from "@/components/PulseBoardBrand";
import { Checkbox } from "@/components/ui/checkbox";

export default function Login() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginMessage, setLoginMessage] = useState("");

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState<"externe" | "interne" | "resident" | "medecin">("interne");
  const [regError, setRegError] = useState("");
  const [regMessage, setRegMessage] = useState("");
  const [accepted, setAccepted] = useState(false);

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/mon-stage");
    },
    onError: (err) => setLoginError(err.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async (data) => {
      if (data.requiresEmailVerification) {
        setRegPassword("");
        setRegMessage("Compte créé. Consultez votre messagerie et confirmez votre adresse avant de vous connecter.");
        return;
      }
      await utils.auth.me.invalidate();
      navigate("/mon-stage");
    },
    onError: (err) => setRegError(err.message),
  });

  const resendVerification = trpc.auth.resendVerification.useMutation({
    onSuccess: data => {
      setLoginMessage(data.message);
      setRegMessage(data.message);
    },
    onError: error => setLoginError(error.message),
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="mb-8 flex items-center justify-center">
          <PulseBoardBrand />
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Se connecter</TabsTrigger>
            <TabsTrigger value="register">S'inscrire</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Connexion</CardTitle>
                <CardDescription>Accédez à votre carnet de stage personnel</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setLoginError("");
                    setLoginMessage("");
                    loginMutation.mutate({ email: loginEmail, password: loginPassword });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="medecin@chu-fann.sn"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      required
                    />
                  </div>
                  <button type="button" onClick={() => navigate("/forgot-password")} className="text-sm text-[var(--pulseboard-green)] hover:underline">
                    Mot de passe oublié ?
                  </button>
                  <div className="space-y-2">
                    <Label htmlFor="password">Mot de passe</Label>
                    <Input
                      id="password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  {loginError && <p className="text-sm text-destructive">{loginError}</p>}
                  {loginMessage && <p className="text-sm text-[var(--pulseboard-green)]" role="status">{loginMessage}</p>}
                  {loginError.includes("Confirmez votre adresse") && (
                    <button
                      type="button"
                      className="text-sm text-[var(--pulseboard-green)] hover:underline disabled:opacity-50"
                      disabled={!loginEmail || resendVerification.isPending}
                      onClick={() => resendVerification.mutate({ email: loginEmail })}
                    >
                      {resendVerification.isPending ? "Envoi…" : "Renvoyer l’e-mail de confirmation"}
                    </button>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? "Connexion…" : "Se connecter"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="register">
            <Card>
              <CardHeader>
                <CardTitle>Créer un compte</CardTitle>
                <CardDescription>Créez votre carnet de stage personnel</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setRegError("");
                    setRegMessage("");
                    if (!accepted) return setRegError("Vous devez accepter les conditions et la politique de confidentialité.");
                    if (!window.confirm("Confirmez-vous ce rôle médical ? Il sera verrouillé après la création du compte. Toute correction devra être validée et restera tracée.")) return;
                    registerMutation.mutate({ name: regName, email: regEmail, password: regPassword, medicalRole: regRole, acceptTerms: true, acceptPrivacy: true });
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Nom complet</Label>
                    <Input
                      id="reg-name"
                      placeholder="Dr. Ibrahima Diallo"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox id="legal-consent" checked={accepted} onCheckedChange={value => setAccepted(value === true)} />
                    <Label htmlFor="legal-consent" className="text-xs leading-5 font-normal">
                      J'accepte les <a href="/terms" target="_blank" className="underline">conditions d'utilisation</a> et la <a href="/privacy" target="_blank" className="underline">politique de confidentialité</a>.
                    </Label>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="medecin@chu-fann.sn"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Mot de passe</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      required
                      minLength={10}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-role">Rôle médical</Label>
                    <Select value={regRole} onValueChange={(v) => setRegRole(v as typeof regRole)}>
                      <SelectTrigger id="reg-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="externe">Externe (6e–8e année)</SelectItem>
                        <SelectItem value="interne">Interne</SelectItem>
                        <SelectItem value="resident">Résident</SelectItem>
                        <SelectItem value="medecin">Médecin / Chef de service</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Ce choix sera verrouillé après l’inscription. Une correction nécessitera une demande validée.</p>
                  </div>
                  {regError && <p className="text-sm text-destructive">{regError}</p>}
                  {regMessage && <p className="text-sm text-[var(--pulseboard-green)]" role="status">{regMessage}</p>}
                  {regMessage && (
                    <button
                      type="button"
                      className="text-sm text-[var(--pulseboard-green)] hover:underline disabled:opacity-50"
                      disabled={!regEmail || resendVerification.isPending}
                      onClick={() => resendVerification.mutate({ email: regEmail })}
                    >
                      Renvoyer l’e-mail de confirmation
                    </button>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? "Création…" : "Créer mon compte"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
