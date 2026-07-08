import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocation, useParams } from "wouter";
import { getLoginUrl } from "@/const";
import { ArrowLeft, Activity, User, Clock, UserPlus, UserMinus, AlertTriangle, FileText, Edit } from "lucide-react";

const actionIcons: Record<string, any> = {
  patient_admitted: UserPlus,
  patient_discharged: UserMinus,
  patient_updated: Edit,
  releve_generated: FileText,
  service_created: Activity,
  member_joined: User,
};

const actionColors: Record<string, string> = {
  patient_admitted: "bg-emerald-100 text-emerald-700",
  patient_discharged: "bg-blue-100 text-blue-700",
  patient_updated: "bg-amber-100 text-amber-700",
  releve_generated: "bg-purple-100 text-purple-700",
  service_created: "bg-primary/10 text-primary",
  member_joined: "bg-indigo-100 text-indigo-700",
};

const actionLabels: Record<string, string> = {
  patient_admitted: "Patient admis",
  patient_discharged: "Patient sorti",
  patient_updated: "Dossier mis à jour",
  releve_generated: "Relève générée",
  service_created: "Service créé",
  member_joined: "A rejoint l'équipe",
};

export default function Timeline() {
  const params = useParams<{ serviceId: string }>();
  const serviceId = parseInt(params.serviceId || "0");
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();

  const { data: activities, isLoading } = trpc.activity.byService.useQuery({ serviceId }, { enabled: serviceId > 0 });
  const { data: service } = trpc.services.get.useQuery({ id: serviceId }, { enabled: serviceId > 0 });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl(`/timeline/${serviceId}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container flex items-center h-16">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/service/${serviceId}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="ml-3">
            <h1 className="font-semibold text-base">Journal d'activité</h1>
            <p className="text-xs text-muted-foreground">{service?.name}</p>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-2xl">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : activities && activities.length > 0 ? (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-4">
              {activities.map((activity, index) => {
                const Icon = actionIcons[activity.action] || Activity;
                const colorClass = actionColors[activity.action] || "bg-muted text-muted-foreground";
                return (
                  <div key={activity.id} className="relative flex gap-4 pl-2" style={{ animationDelay: `${index * 50}ms` }}>
                    <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className={`flex-1 pb-4 ${activity.action === "member_joined" ? "border-l-2 border-indigo-200 pl-3 ml-1 rounded" : ""}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          {activity.action === "member_joined" ? (
                            <p className="text-sm font-semibold text-indigo-700">
                              👋 {activity.userName || "Quelqu'un"} a rejoint l'équipe
                            </p>
                          ) : (
                            <p className="text-sm font-medium">{activity.details || (actionLabels[activity.action] ?? activity.action)}</p>
                          )}
                          {activity.action !== "member_joined" && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              par {activity.userName || "Système"}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(activity.createdAt).toLocaleString("fr-FR", {
                            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <Activity className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="font-semibold mb-2">Aucune activité</h3>
            <p className="text-sm text-muted-foreground">Les événements de ce service apparaîtront ici.</p>
          </div>
        )}
      </main>
    </div>
  );
}
