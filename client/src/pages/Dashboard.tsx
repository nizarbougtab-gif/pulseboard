import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { ROLE_LABELS, ROLE_COLORS, type MedicalRole } from "@/lib/permissions";
import {
  Plus, Bed, LogOut, User, ChevronRight,
  Stethoscope, LayoutGrid, BookOpen, Users, AlertCircle, GraduationCap, UserPlus, Copy, Check
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import CreateServiceDialog from "@/components/CreateServiceDialog";
import BottomNav from "@/components/BottomNav";

export default function Dashboard() {
  const { user, medicalRole, isAuthenticated, loading, logout, can } = useAuth();
  const [, navigate] = useLocation();
  const [showCreateService, setShowCreateService] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState<number | null>(null);

  const joinService = trpc.membership.join.useMutation({
    onSuccess: (result) => {
      if (result.status === "joined") { toast.success("Vous avez rejoint le service !"); setShowJoinDialog(false); setJoinCode(""); utils.services.list.invalidate(); }
      else if (result.status === "pending") { toast.info("Demande envoyée — en attente d'approbation du chef de service"); setShowJoinDialog(false); setJoinCode(""); }
      else if (result.status === "already_member") { toast.info("Vous êtes déjà membre de ce service"); }
    },
    onError: (e) => toast.error(e.message),
  });

  const utils = trpc.useUtils();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-[var(--pulseboard-green)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = getLoginUrl("/dashboard");
    return null;
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="medboard-sidebar">
        {/* Logo */}
        <div className="p-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[var(--pulseboard-green)] flex items-center justify-center">
              <Plus className="w-4 h-4 text-white rotate-45" />
            </div>
            <span className="font-bold text-base tracking-tight">PulseBoard</span>
          </div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 mb-3">Menu principal</p>
          <div className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[var(--pulseboard-green-light)] text-[var(--pulseboard-green)] font-medium text-sm transition-all">
              <LayoutGrid className="w-4 h-4" />
              Services
              <AlertBadge />
            </button>
            <button
              onClick={() => {
                const services = document.querySelector("[data-first-service]");
                if (services) {
                  const serviceId = services.getAttribute("data-first-service");
                  if (serviceId) navigate(`/timeline/${serviceId}`);
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-gray-100 text-sm transition-all"
            >
              <BookOpen className="w-4 h-4" />
              Journal
            </button>
            <button
              onClick={() => navigate("/mon-stage")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-gray-100 text-sm transition-all"
            >
              <GraduationCap className="w-4 h-4" />
              Mon Stage
            </button>
            <button
              onClick={() => navigate("/profile")}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-gray-100 text-sm transition-all"
            >
              <User className="w-4 h-4" />
              Profil
            </button>
          </div>
        </nav>

        {/* User */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--pulseboard-green)] flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || "Utilisateur"}</p>
              {medicalRole && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide ${ROLE_COLORS[medicalRole as MedicalRole]}`}>
                  {ROLE_LABELS[medicalRole as MedicalRole]}
                </span>
              )}
            </div>
            <button onClick={() => logout()} className="text-muted-foreground hover:text-[var(--pulseboard-red)] transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 text-[10px] text-muted-foreground border-t border-border/50">
          PULSEBOARD &copy; 2026
        </div>
      </aside>

      {/* Main content */}
      <main className="medboard-main">
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {/* Welcome */}
          <div className="mb-8">
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <h1 className="text-2xl font-bold mt-1">Bonjour, {user?.name || "Utilisateur"}</h1>
          </div>

          {/* Stats */}
          <DashboardStats />

          {/* Services Section */}
          <div className="flex items-center justify-between mb-5 mt-8">
            <h2 className="font-semibold text-base">Mes services</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8" onClick={() => setShowJoinDialog(true)}>
                <UserPlus className="w-3.5 h-3.5 mr-1" /> Rejoindre
              </Button>
              {can("service.create") && (
                <Button size="sm" className="bg-[var(--pulseboard-green)] hover:bg-[var(--pulseboard-green-dark)] text-white h-8" onClick={() => setShowCreateService(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Nouveau
                </Button>
              )}
            </div>
          </div>

          <ServicesList />
        </div>

        <CreateServiceDialog open={showCreateService} onOpenChange={setShowCreateService} />

        {/* Join Service Dialog */}
        <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Rejoindre un service</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">Entre le code du service fourni par le chef de service.</p>
            <Input
              placeholder="ex: ORL-4829"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              className="text-center text-lg tracking-widest font-mono"
              maxLength={8}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShowJoinDialog(false)}>Annuler</Button>
              <Button
                className="bg-[var(--pulseboard-green)] text-white"
                disabled={joinCode.length < 4 || joinService.isPending}
                onClick={() => joinService.mutate({ code: joinCode })}
              >
                Rejoindre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <BottomNav />
    </div>
  );
}

function AlertBadge() {
  const { data: stats } = trpc.dashboard.stats.useQuery();
  if (!stats?.totalAlerts) return null;
  return (
    <span className="ml-auto w-2 h-2 rounded-full bg-[var(--pulseboard-red)] animate-pulse" />
  );
}

function DashboardStats() {
  const { data: services } = trpc.services.list.useQuery();
  const { data: stats } = trpc.dashboard.stats.useQuery();

  const totalServices = stats?.totalServices || services?.length || 0;
  const totalAlerts = stats?.totalAlerts || 0;
  const totalPatients = stats?.totalPatients || 0;
  const totalBeds = services?.reduce((sum, s) => sum + (s.totalBeds || 0), 0) || 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--pulseboard-green-light)] flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-[var(--pulseboard-green)]" />
          </div>
        </div>
        <div className="text-2xl font-bold">{totalServices}</div>
        <div className="text-xs text-muted-foreground">Services actifs</div>
      </div>
      <div className="bg-white rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--pulseboard-blue-light)] flex items-center justify-center">
            <Users className="w-4 h-4 text-[var(--pulseboard-blue)]" />
          </div>
        </div>
        <div className="text-2xl font-bold">{totalPatients}</div>
        <div className="text-xs text-muted-foreground">Patients</div>
      </div>
      <div className="bg-white rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--pulseboard-amber-light)] flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-[var(--pulseboard-amber)]" />
          </div>
        </div>
        <div className="text-2xl font-bold text-[var(--pulseboard-amber)]">{totalAlerts}</div>
        <div className="text-xs text-muted-foreground">Alertes actives</div>
      </div>
      <div className="bg-white rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
            <Bed className="w-4 h-4 text-gray-600" />
          </div>
        </div>
        <div className="text-2xl font-bold">{totalBeds}</div>
        <div className="text-xs text-muted-foreground">Lits totaux</div>
      </div>
    </div>
  );
}

function ServicesList() {
  const { data: services, isLoading } = trpc.services.list.useQuery();
  const { data: hospitals } = trpc.hospitals.list.useQuery();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-32 rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-dashed border-border">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-[var(--pulseboard-green-light)] flex items-center justify-center">
          <Stethoscope className="w-6 h-6 text-[var(--pulseboard-green)]" />
        </div>
        <h3 className="font-semibold mb-1">Aucun service</h3>
        <p className="text-sm text-muted-foreground">Créez votre premier service pour commencer.</p>
      </div>
    );
  }

  const getHospitalName = (hospitalId: number) => {
    return hospitals?.find(h => h.id === hospitalId)?.name || "";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-first-service={services[0]?.id}>
      {services.map((service) => (
        <div
          key={service.id}
          onClick={() => navigate(`/service/${service.id}`)}
          className="bg-white rounded-xl p-5 border border-border/50 hover:border-[var(--pulseboard-green)]/30 hover:shadow-sm cursor-pointer transition-all duration-200 group"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[var(--pulseboard-green-light)] flex items-center justify-center">
                <Stethoscope className="w-4 h-4 text-[var(--pulseboard-green)]" />
              </div>
              <div>
                <h3 className="font-semibold text-sm group-hover:text-[var(--pulseboard-green)] transition-colors">{service.name}</h3>
                <p className="text-[11px] text-muted-foreground">{service.specialty}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-[var(--pulseboard-green)] transition-colors" />
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Bed className="w-3.5 h-3.5" />
              {service.totalBeds} lits
            </span>
            {getHospitalName(service.hospitalId) && (
              <span className="truncate">{getHospitalName(service.hospitalId)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

