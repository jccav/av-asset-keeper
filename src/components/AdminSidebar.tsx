import { LayoutDashboard, Archive, History, Users, LogOut, ExternalLink } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { Link } from "react-router-dom";
import jccLogo from "@/assets/jcc-logo.png";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Inventory", url: "/admin/inventory", icon: Archive },
  { title: "History", url: "/admin/history", icon: History },
  { title: "Admins", url: "/admin/admins", icon: Users },
];

export function AdminSidebar() {
  const { signOut, user, role } = useAuth();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center gap-2 px-4 py-3">
            <img src={jccLogo} alt="JCC Logo" className="h-8 w-8 object-contain" />
            <span className="font-semibold">JCC AV Tracker</span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4">
        <Link to="/" className="mb-3 flex items-center gap-2 text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground">
          <ExternalLink className="h-4 w-4" /> Public Equipment Page
        </Link>
        <div className="mb-2 truncate text-xs text-sidebar-foreground/70">{user?.email}</div>
        <div className="mb-3 text-xs font-medium capitalize text-sidebar-primary">
          {role === "master_admin" ? "Master Admin" : "Admin"}
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
