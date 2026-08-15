import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bed, Send, MessageSquare, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { patientInitials } from "@shared/patientIdentity";

interface Props {
  serviceId: number;
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

export default function ServiceChat({ serviceId, isOpen, onClose, inline }: Props) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [message, setMessage] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, refetch } = trpc.messages.list.useQuery(
    { serviceId },
    { enabled: isOpen, refetchInterval: isOpen ? 5000 : false }
  );

  const { data: patients = [] } = trpc.patients.list.useQuery(
    { serviceId, filter: "tous" },
    { enabled: isOpen }
  );

  const sortedPatients = [...patients].sort((a, b) => {
    if (a.bedNumber == null) return 1;
    if (b.bedNumber == null) return -1;
    return a.bedNumber - b.bedNumber;
  });
  const selectedPatient = patients.find(patient => patient.id === selectedPatientId);

  const sendMessage = trpc.messages.send.useMutation({
    onSuccess: () => {
      setMessage("");
      setSelectedPatientId(null);
      setShowPatientPicker(false);
      refetch();
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessage.mutate({
      serviceId,
      content: message.trim(),
      patientId: selectedPatientId ?? undefined,
    });
  };

  const handleMessageChange = (value: string) => {
    setMessage(value);
    if (!selectedPatientId && /\b(patient|lit)\b/i.test(value)) {
      setShowPatientPicker(true);
    }
  };

  if (!isOpen) return null;

  const sortedMessages = messages ? [...messages].reverse() : [];

  const chatContent = (
    <>
      {/* Messages */}
      <div ref={scrollRef} className={`flex-1 overflow-y-auto p-4 space-y-3 ${inline ? "min-h-[300px] max-h-[500px]" : ""}`}>
        {sortedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Aucun message</p>
            <p className="text-xs text-muted-foreground mt-1">Commencez la discussion avec votre équipe !</p>
          </div>
        ) : (
          sortedMessages.map(msg => {
            const isMe = msg.userId === user?.id;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                  isMe ? "bg-[var(--pulseboard-green)] text-white" : "bg-white border border-border/50"
                }`}>
                  {!isMe && <p className="text-[10px] font-semibold text-[var(--pulseboard-green)] mb-0.5">{msg.userName || "Anonyme"}</p>}
                  {msg.patientId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/patient/${msg.patientId}`)}
                      className={`mb-1.5 flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-left text-[11px] font-semibold transition-opacity hover:opacity-80 ${
                        isMe ? "bg-white/20 text-white" : "bg-emerald-50 text-[var(--pulseboard-green)]"
                      }`}
                      title="Ouvrir le dossier du patient"
                    >
                      <Bed className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        Lit {msg.patientBedNumber ?? "—"} — {patientInitials(msg.patientFirstName, msg.patientLastName)}
                      </span>
                    </button>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {new Date(msg.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className={`p-3 border-t border-border/50 ${inline ? "bg-white rounded-b-xl" : ""}`}>
        {showPatientPicker && !selectedPatient && (
          <div className="mb-2 overflow-hidden rounded-xl border border-border bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-border/50 px-3 py-2">
              <span className="text-xs font-semibold">Mentionner un patient ou un lit</span>
              <button
                type="button"
                onClick={() => setShowPatientPicker(false)}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted"
                aria-label="Fermer la liste"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {sortedPatients.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">Aucun patient hospitalisé dans ce service</p>
              ) : (
                sortedPatients.map(patient => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(patient.id);
                      setShowPatientPicker(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-emerald-50"
                  >
                    <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-[var(--pulseboard-green)]">
                      Lit {patient.bedNumber ?? "—"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{patientInitials(patient.firstName, patient.lastName)}</span>
                      {patient.diagnosis && <span className="block truncate text-[11px] text-muted-foreground">{patient.diagnosis}</span>}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
        {selectedPatient && (
          <div className="mb-2 flex items-center gap-1.5">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-[var(--pulseboard-green)]">
              <Bed className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Lit {selectedPatient.bedNumber ?? "—"} — {patientInitials(selectedPatient.firstName, selectedPatient.lastName)}</span>
              <button
                type="button"
                onClick={() => setSelectedPatientId(null)}
                className="rounded-full p-0.5 hover:bg-emerald-200"
                aria-label="Retirer la mention"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 shrink-0"
            onClick={() => setShowPatientPicker(current => !current)}
            title="Mentionner un patient ou un lit"
          >
            <Bed className="h-4 w-4" />
          </Button>
          <Input
            placeholder="Message à l'équipe..."
            value={message}
            onChange={e => handleMessageChange(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="h-9 text-sm"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white"
            onClick={handleSend}
            disabled={!message.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );

  // Inline mode
  if (inline) {
    return (
      <div className="bg-[#f7f8f6] rounded-xl border border-border/50 flex flex-col">
        <div className="px-4 py-3 border-b border-border/50 bg-white rounded-t-xl">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--pulseboard-green)]" />
            <span className="text-sm font-semibold">Messagerie d'équipe</span>
          </div>
        </div>
        {chatContent}
      </div>
    );
  }

  // Floating mode
  return (
    <div className="fixed bottom-4 right-4 w-80 sm:w-96 h-[28rem] bg-white border border-border rounded-2xl shadow-xl flex flex-col z-50">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[var(--pulseboard-green)]" />
          <span className="text-sm font-semibold">Messagerie d'équipe</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
      </div>
      {chatContent}
    </div>
  );
}

