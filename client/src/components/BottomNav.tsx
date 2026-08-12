import { useLocation } from "wouter";
import { LayoutGrid, BookOpen, GraduationCap, User, Bed, Clock } from "lucide-react";

type ServiceTab = "lits" | "garde" | "messages";

type BottomNavProps = {
  serviceId?: number;
  activeServiceTab?: ServiceTab;
  onServiceTabChange?: (tab: ServiceTab) => void;
};

export default function BottomNav({ serviceId, activeServiceTab, onServiceTabChange }: BottomNavProps) {
  const [location, navigate] = useLocation();

  if (serviceId) {
    localStorage.setItem("lastServiceId", String(serviceId));
  }
  const lastServiceId = serviceId || localStorage.getItem("lastServiceId");

  const serviceItems = onServiceTabChange ? [
    { icon: LayoutGrid, label: "Services", path: "/dashboard" },
    { icon: Bed, label: "Hall", tab: "lits" as const },
    { icon: Clock, label: "Garde", tab: "garde" as const },
    { icon: GraduationCap, label: "Mon Stage", path: "/mon-stage" },
    { icon: User, label: "Profil", path: "/profile" },
  ] : [
    { icon: LayoutGrid, label: "Services", path: "/dashboard" },
    { icon: BookOpen, label: "Journal", path: lastServiceId ? `/timeline/${lastServiceId}` : "/dashboard" },
    { icon: GraduationCap, label: "Mon Stage", path: "/mon-stage" },
    { icon: User, label: "Profil", path: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border/50 flex md:hidden z-50 safe-area-bottom">
      {serviceItems.map(item => {
        const { icon: Icon, label } = item;
        const path = "path" in item ? item.path : undefined;
        const tab = "tab" in item ? item.tab : undefined;
        const active = tab
          ? activeServiceTab === tab
          : Boolean(path && (location === path || (path !== "/dashboard" && location.startsWith(path))));
        return (
          <button
            key={label}
            onClick={() => tab ? onServiceTabChange?.(tab) : path && navigate(path)}
            className={`min-h-14 flex-1 flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors ${
              active ? "text-[var(--pulseboard-green)]" : "text-muted-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
