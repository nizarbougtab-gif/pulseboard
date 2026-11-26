import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BETA_MODE } from "@/lib/features";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function BetaFeedback() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<"bug" | "idee" | "facilite" | "autre">("idee");
  const [rating, setRating] = useState("5");
  const [message, setMessage] = useState("");
  const [containsNoPatientData, setContainsNoPatientData] = useState(false);

  const submit = trpc.beta.submitFeedback.useMutation({
    onSuccess: () => {
      toast.success("Merci, votre retour bêta a été transmis.");
      setOpen(false);
      setMessage("");
      setContainsNoPatientData(false);
    },
    onError: error => toast.error(error.message),
  });

  if (!BETA_MODE || !isAuthenticated) return null;

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="fixed bottom-20 right-4 z-50 rounded-full bg-amber-500 text-amber-950 shadow-lg hover:bg-amber-400 md:bottom-6"
        onClick={() => setOpen(true)}
      >
        <MessageSquareText className="mr-2 h-4 w-4" /> Donner mon avis
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Retour sur la bêta PulseBoard</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type de retour</Label>
                <Select value={category} onValueChange={value => setCategory(value as typeof category)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bug">Problème</SelectItem>
                    <SelectItem value="idee">Idée</SelectItem>
                    <SelectItem value="facilite">Facilité d’utilisation</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Note globale</Label>
                <Select value={rating} onValueChange={setRating}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5, 4, 3, 2, 1].map(value => <SelectItem key={value} value={String(value)}>{value}/5</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Votre retour</Label>
              <Textarea
                value={message}
                maxLength={2000}
                onChange={event => setMessage(event.target.value)}
                placeholder="Qu’est-ce qui vous a aidé ? Qu’est-ce qui doit être amélioré ?"
                className="min-h-28 resize-none"
              />
              <p className="text-right text-[11px] text-muted-foreground">{message.length}/2000</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950">
              <Checkbox checked={containsNoPatientData} onCheckedChange={checked => setContainsNoPatientData(checked === true)} className="mt-0.5" />
              <span>Je confirme que mon message ne contient aucune information relative à un patient, même fictif.</span>
            </label>
            <Button
              className="w-full bg-amber-500 text-amber-950 hover:bg-amber-400"
              disabled={message.trim().length < 10 || !containsNoPatientData || submit.isPending}
              onClick={() => submit.mutate({ category, rating: Number(rating), message, containsNoPatientData: true })}
            >
              {submit.isPending ? "Envoi…" : "Envoyer mon retour"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
