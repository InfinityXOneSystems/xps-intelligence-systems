import {
  Home, Users, UserSearch, FlaskConical, Mail, FileText,
  BarChart3, BookOpen, Eye, Plug, Settings, Shield, Brain,
  Building2, Search, Crown, Cpu, Briefcase, Workflow
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import xpsLogo from "@/assets/xps-logo.png";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Sales Staff", url: "/sales-staff", icon: Briefcase },
  { title: "Sales Flow", url: "/sales-flow", icon: Workflow },
  { title: "CRM", url: "/crm", icon: Users },
  { title: "Leads", url: "/leads", icon: UserSearch },
  { title: "AI Assistant", url: "/ai-assistant", icon: Brain },
  { title: "Scraper", url: "/scraper", icon: Search },
  { title: "Research Lab", url: "/research", icon: FlaskConical },
  { title: "Outreach", url: "/outreach", icon: Mail },
  { title: "Proposals", url: "/proposals", icon: FileText },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
];

const secondaryNav = [
  { title: "Intelligence", url: "/intelligence", icon: Cpu },
  { title: "Knowledge Base", url: "/knowledge", icon: BookOpen },
  { title: "Competition", url: "/competition", icon: Eye },
  { title: "Connectors", url: "/connectors", icon: Plug },
];

const adminNav = [
  { title: "Admin", url: "/admin", icon: Shield },
  { title: "Manager", url: "/manager", icon: Users },
  { title: "Owner Portal", url: "/owner", icon: Crown },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + "/");

  const renderGroup = (label: string, items: typeof mainNav) => (
    <SidebarGroup key={label}>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url === "/dashboard"}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive(item.url)
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                  activeClassName=""
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <div className="h-14 border-b border-border flex items-center px-4 gap-3 shrink-0">
        <img src={xpsLogo} alt="XPS" className="h-8 w-8 shrink-0" />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold tracking-wider text-foreground truncate">XPS INTELLIGENCE</span>
            <span className="text-[9px] text-muted-foreground tracking-widest">COMMAND CENTER</span>
          </div>
        )}
      </div>
      <SidebarContent className="py-2">
        {renderGroup("Main", mainNav)}
        {renderGroup("Intelligence", secondaryNav)}
        {renderGroup("System", adminNav)}
      </SidebarContent>
    </Sidebar>
  );
}
