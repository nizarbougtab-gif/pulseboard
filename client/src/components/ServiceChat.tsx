import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

interface Props {
  serviceId: number;
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

export default function ServiceChat({ serviceId, isOpen, onClose, inline }: Props) {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages, refetch } = trpc.messages.list.useQuery(
    { serviceId },
    { enabled: isOpen, refetchInterval: isOpen ? 5000 : false }
  );

  const sendMessage = trpc.messages.send.useMutation({
    onSuccess: () => {
      setMessage("");
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
    sendMessage.mutate({ serviceId, content: message.trim() });
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
        <div className="flex gap-2">
          <Input
            placeholder="Message à l'équipe..."
            value={message}
            onChange={e => setMessage(e.target.value)}
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

