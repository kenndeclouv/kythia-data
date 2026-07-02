import { Database, Settings, Info, Plug, Archive, Trophy, Store } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useGamification } from "../../hooks/useGamification";
import { SHOP_ITEMS } from "../../lib/shop";

import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";

import kythiaAppLogo from "../../assets/kythia-app-logo.webp";

interface SidebarProps {
  onCreateConnection: () => void;
}

export default function Sidebar({ onCreateConnection }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { data } = useGamification();

  const activeBadge = SHOP_ITEMS.find(item => item.type === 'badge' && item.id === data?.active_badge);
  const BadgeIcon = activeBadge?.icon;
  const activeTitle = activeBadge ? activeBadge.name : (data?.active_title || "Newbie");

  return (
    <ShadcnSidebar>
      <SidebarHeader className="p-4 border-b border-border/50">
        <div className="flex items-center">
          <img src={kythiaAppLogo} alt="Kythia Logo" className="w-8 h-8 mr-3 shrink-0" />
          <div className="flex flex-col">
            <h2 className="text-sm font-semibold tracking-wide text-foreground">KYTHIA</h2>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-0.5">Data</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className='gap-1'>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={path === "/"}
                onClick={() => navigate("/")}
                tooltip="Databases"
                className="py-5"
              >
                <Database className="!size-5" />
                <span className="text-[14px] font-medium">Databases</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={path === "/settings"}
                onClick={() => navigate("/settings")}
                tooltip="Settings"
                className="py-5"
              >
                <Settings className="!size-5" />
                <span className="text-[14px] font-medium">Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className='gap-1'>
          <div className="my-2 border-t border-border/50" />
          <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            Actions
          </div>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onCreateConnection} tooltip="Connect" className="py-5">
              <Plug className="!size-5" />
              <span className="text-[14px] font-medium">Connect</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton isActive={path === "/backups"} onClick={() => navigate("/backups")} tooltip="Backups" className="py-5">
              <Archive className="!size-5" />
              <span className="text-[14px] font-medium">Backups</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => navigate("/about")} isActive={path === "/about"} tooltip="About" className="py-5">
              <Info className="!size-5" />
              <span className="text-[14px] font-medium">About</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarGroup>

        <SidebarGroup className='gap-1'>
          <div className="my-2 border-t border-border/50" />
          <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
            Game
          </div>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={path === "/achievements"}
              onClick={() => navigate("/achievements")}
              tooltip="Achievements"
              className="py-5"
            >
              <Trophy className="!size-5" />
              <span className="text-[14px] font-medium">Achievements</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={path === "/shop"}
              onClick={() => navigate("/shop")}
              tooltip="Coin Store"
              className="py-5"
            >
              <Store className="!size-5 text-amber-500" />
              <span className="text-[14px] font-medium text-amber-500">Coin Store</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarGroup>


      </SidebarContent>

      <SidebarFooter className="p-2 border-t border-border/50 flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={path === '/profile'}
              onClick={() => navigate('/profile')}
              className="py-2 h-auto flex items-center gap-3 bg-secondary/30 border border-border/50 hover:border-primary/50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-primary/20 bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">
                {data?.avatar_data ? (
                  <img src={data.avatar_data} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  data?.nickname?.substring(0, 2).toUpperCase() || 'KY'
                )}
              </div>
              <div className="flex flex-col text-left flex-1 min-w-0">
                <span className="text-[14px] font-bold truncate text-foreground flex items-center gap-1.5">
                  {data?.nickname || "Loading..."}
                  {BadgeIcon && activeBadge && <BadgeIcon className={`w-3 h-3 ${activeBadge.color}`} />}
                </span>
                <span className="text-[11px] text-muted-foreground truncate">Lv. {data?.level || 1} • {activeTitle}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </ShadcnSidebar>
  );
}
