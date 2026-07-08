import { useLocation } from "wouter";
import { LayoutGrid, BookOpen, GraduationCap, User } from "lucide-react";

export default function BottomNav({ serviceId }: { serviceId?: number }) {
  const [location, navigate] = useLocation();

  const items = [
    { icon: LayoutGrid, label: "Services", path: "/dashboard" },
    { icon: BookOpen, label: "Journal", path: serviceId ? `/timeline/${serviceId}` : "/dashboard" },
    { icon: GraduationCap, label: "Mon Stage", path: "/mon-stage" },
    { icon: User, label: "Profil", path: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border/50 flex md:hidden z-50 safe-area-bottom">
      {items.map(({ icon: Icon, label, path }) => {
        const active = location === path || (path !== "/dashboard" && location.startsWith(path));
        return (
          <button
            key={label}
            onClick={() => navigate(path)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
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
