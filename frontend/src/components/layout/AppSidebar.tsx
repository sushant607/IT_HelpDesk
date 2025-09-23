import { NavLink, useLocation } from "react-router-dom";
import { Home, Ticket, MessageSquare, Settings, Shield, User, Bell } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon: typeof Home;
  roles?: string[];
}

const navigationItems: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "My Tickets", url: "/dashboard/tickets", icon: Ticket },
  { title: "All Tickets", url: "/dashboard/all-tickets", icon: Ticket, roles: ["manager"] },
  { title: "Chatbot", url: "/dashboard/chatbot", icon: MessageSquare },
  { title: "Notifications", url: "/dashboard/notifications", icon: Bell },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const userRole = localStorage.getItem("user_role");
  const collapsed = state === "collapsed";

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-primary/10 text-primary font-medium border-r-2 border-primary" 
      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground";

  const filteredItems = navigationItems.filter(item => 
    !item.roles || item.roles.includes(userRole || "")
  );

  return (
    <Sidebar className={`${collapsed ? "w-14" : "w-64"} border-r bg-card/50 backdrop-blur-sm`}>
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h2 className="font-semibold text-sm">IT Helpdesk</h2>
              <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
            </div>
          )}
        </div>
      </div>

      <SidebarContent className="p-4">
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? "sr-only" : ""}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="w-full justify-start">
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="w-4 h-4 shrink-0" />
                      {!collapsed && (
                        <span className="ml-3 transition-all duration-200">
                          {item.title}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <div className="mt-auto p-4 border-t">
        <SidebarTrigger className="w-full" />
      </div>
    </Sidebar>
  );
}