import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PulseBoardBrand from "@/components/PulseBoardBrand";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const mutation = trpc.auth.forgotPassword.useMutation({ onSuccess: data => setMessage(data.message), onError: error => setMessage(error.message) });
  return <AccessCard title="Récupérer mon compte"><form className="space-y-4" onSubmit={event => { event.preventDefault(); mutation.mutate({ email }); }}><div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></div>{message && <p className="text-sm text-muted-foreground">{message}</p>}<Button className="w-full" disabled={mutation.isPending}>Envoyer le lien sécurisé</Button></form></AccessCard>;
}

export function ResetPassword() {
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const mutation = trpc.auth.resetPassword.useMutation({ onSuccess: () => { setMessage("Mot de passe modifié. Redirection vers la connexion…"); setTimeout(() => navigate("/login"), 1200); }, onError: error => setMessage(error.message) });
  return <AccessCard title="Nouveau mot de passe"><form className="space-y-4" onSubmit={event => { event.preventDefault(); mutation.mutate({ token, password }); }}><div className="space-y-2"><Label>Mot de passe (10 caractères minimum)</Label><Input type="password" minLength={10} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} required /></div>{message && <p className="text-sm text-muted-foreground">{message}</p>}<Button className="w-full" disabled={!token || mutation.isPending}>Modifier le mot de passe</Button></form></AccessCard>;
}

export function VerifyEmail() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [message, setMessage] = useState("Vérification en cours…");
  const mutation = trpc.auth.verifyEmail.useMutation({ onSuccess: () => setMessage("Adresse confirmée. Vous pouvez revenir à PulseBoard."), onError: error => setMessage(error.message) });
  useEffect(() => { if (token) mutation.mutate({ token }); else setMessage("Lien de vérification incomplet."); }, [token]);
  return <AccessCard title="Confirmation de l'email"><p className="text-sm text-muted-foreground">{message}</p><Button asChild className="w-full mt-4"><a href="/login">Continuer</a></Button></AccessCard>;
}

function AccessCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <main className="min-h-screen bg-background flex items-center justify-center p-4"><div className="w-full max-w-md space-y-6"><div className="flex justify-center"><PulseBoardBrand /></div><Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>{children}<a href="/login" className="block text-center text-sm text-muted-foreground hover:underline mt-5">Retour à la connexion</a></CardContent></Card></div></main>;
}
