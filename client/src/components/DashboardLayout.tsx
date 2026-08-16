import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BookOpen,
  Box,
  Feather,
  FileKey2,
  LayoutDashboard,
  LogIn,
  PanelLeft,
  Radar,
} from "lucide-react";
import { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "./ui/sidebar";

const navigation = [
  { icon: LayoutDashboard, label: "브랜드 금고", path: "/" },
  { icon: BookOpen, label: "Idea ID", path: "/idea" },
  { icon: Radar, label: "Novelty Radar", path: "/radar" },
  { icon: Feather, label: "Handfont Lab", path: "/handfont" },
  { icon: Box, label: "Format Forge", path: "/format" },
  { icon: FileKey2, label: "라이선스", path: "/license" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="origin-sidebar border-r-0">
        <SidebarHeader className="origin-sidebar-header">
          <button
            type="button"
            className="origin-mark"
            aria-label="Origin 홈으로 이동"
            onClick={() => setLocation("/")}
          >
            <span className="origin-mark-symbol">O</span>
            <span className="origin-mark-name">ORIGIN</span>
          </button>
        </SidebarHeader>

        <SidebarContent className="origin-sidebar-content">
          <p className="origin-sidebar-label">WORKSPACE</p>
          <SidebarMenu className="origin-sidebar-menu">
            {navigation.map((item) => {
              const active = location === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={active}
                    tooltip={item.label}
                    onClick={() => setLocation(item.path)}
                    className="origin-nav-item"
                  >
                    <item.icon className="h-[17px] w-[17px]" strokeWidth={active ? 2 : 1.7} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="origin-sidebar-footer">
          <div className="origin-account-card">
            <div className="origin-account-avatar">{user?.name?.slice(0, 1).toUpperCase() ?? "S"}</div>
            <div className="origin-account-copy">
              <strong>{user?.name ?? "Private workspace"}</strong>
              <span>{user ? "동기화됨" : "로컬 미리보기"}</span>
            </div>
            {!user ? (
              <button className="origin-icon-button" onClick={() => startLogin()} aria-label="로그인">
                <LogIn className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="origin-inset">
        {isMobile ? (
          <header className="origin-mobile-header">
            <SidebarTrigger className="origin-icon-button" aria-label="메뉴 열기" />
            <span className="origin-mobile-logo">ORIGIN</span>
          </header>
        ) : null}
        <main className="origin-main">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
