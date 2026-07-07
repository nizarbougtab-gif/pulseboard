import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { FileText, Copy, RefreshCw, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  serviceId: number;
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

export default function RelevePanel({ serviceId, isOpen, onClose, inline }: Props) {
  const [currentReleve, setCurrentReleve] = useState<string | null>(null);

  const { data: releves } = trpc.releve.list.useQuery({ serviceId }, { enabled: isOpen });
  const generateReleve = trpc.releve.generate.useMutation({
    onSuccess: (data) => {
      setCurrentReleve(data.content);
      toast.success("Relève générée avec succès");
    },
    onError: () => {
      toast.error("Erreur lors de la génération");
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Relève copiée — prête pour WhatsApp");
  };

  if (!isOpen) return null;

  const content = (
    <>
      {currentReleve ? (
        <div className="space-y-4">
          <pre className="whitespace-pre-wrap text-sm font-mono bg-white p-4 rounded-xl leading-relaxed border border-border/50">
            {currentReleve}
          </pre>
          <div className="flex gap-3">
            <Button onClick={() => copyToClipboard(currentReleve)} variant="outline" className="flex-1">
              <Copy className="w-4 h-4 mr-2" /> Copier pour WhatsApp
            </Button>
            <Button onClick={() => generateReleve.mutate({ serviceId })} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" /> Régénérer
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="font-semibold mb-2">Générer la relève</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            La relève sera générée automatiquement à partir des données du service, groupée par priorité : Critiques → Modérés → Stables.
          </p>
          <Button
            className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white"
            onClick={() => generateReleve.mutate({ serviceId })}
            disabled={generateReleve.isPending}
          >
            {generateReleve.isPending ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Génération...</>
            ) : (
              <><FileText className="w-4 h-4 mr-2" /> Générer la relève</>
            )}
          </Button>
        </div>
      )}

      {/* Previous releves */}
      {releves && releves.length > 0 && (
        <div className="mt-8 border-t border-border pt-6">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Relèves précédentes
          </h3>
          <div className="space-y-3">
            {releves.map(r => (
              <div key={r.id} className="p-3 rounded-lg bg-white border border-border/50 cursor-pointer hover:border-[var(--pulseboard-green)]/30 transition-colors" onClick={() => setCurrentReleve(r.content)}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {new Date(r.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );

  // Inline mode: render directly without overlay
  if (inline) {
    return <div>{content}</div>;
  }

  // Modal mode
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[var(--pulseboard-green)]" />
            <h2 className="font-semibold">Relève du service</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {content}
        </div>
      </div>
    </div>
  );
}

