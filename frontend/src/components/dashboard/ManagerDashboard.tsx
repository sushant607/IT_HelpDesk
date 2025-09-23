import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Ticket, TrendingUp, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TicketData {
  id: string;
  title: string;
  assignee: string;
  category: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
}

export default function ManagerDashboard() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Mock data for all tickets (manager view)
    const mockTickets: TicketData[] = [
      {
        id: "T001",
        title: "Password Reset Request",
        assignee: "John Doe",
        category: "Account Access",
        status: "resolved",
        priority: "medium",
        createdAt: "2024-01-15",
        updatedAt: "2024-01-16"
      },
      {
        id: "T002",
        title: "Software Installation Issue",
        assignee: "Jane Smith",
        category: "Software",
        status: "in-progress",
        priority: "high",
        createdAt: "2024-01-18",
        updatedAt: "2024-01-18"
      },
      {
        id: "T003",
        title: "VPN Connection Problems",
        assignee: "Bob Wilson",
        category: "Network",
        status: "open",
        priority: "urgent",
        createdAt: "2024-01-20",
        updatedAt: "2024-01-20"
      },
      {
        id: "T004",
        title: "Email Server Outage",
        assignee: "Sarah Johnson",
        category: "Infrastructure",
        status: "in-progress",
        priority: "urgent",
        createdAt: "2024-01-21",
        updatedAt: "2024-01-21"
      },
      {
        id: "T005",
        title: "Printer Not Working",
        assignee: "Mike Chen",
        category: "Hardware",
        status: "open",
        priority: "low",
        createdAt: "2024-01-22",
        updatedAt: "2024-01-22"
      }
    ];
    setTickets(mockTickets);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-status-open text-white";
      case "in-progress": return "bg-status-progress text-white";
      case "resolved": return "bg-status-resolved text-white";
      case "closed": return "bg-status-closed text-white";
      default: return "bg-muted";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "bg-muted text-muted-foreground";
      case "medium": return "bg-primary text-primary-foreground";
      case "high": return "bg-warning text-warning-foreground";
      case "urgent": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted";
    }
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in-progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
    urgent: tickets.filter(t => t.priority === "urgent").length,
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manager Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Manage all team tickets and monitor performance
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/all-tickets")}>
            View All Tickets
          </Button>
          <Button 
            onClick={() => navigate("/tickets/new")}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All active tickets</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <AlertCircle className="h-4 w-4 text-status-open" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-open">{stats.open}</div>
            <p className="text-xs text-muted-foreground">Need assignment</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-status-progress" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-progress">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">Being resolved</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <Users className="h-4 w-4 text-status-resolved" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-resolved">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-md border-destructive/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.urgent}</div>
            <p className="text-xs text-muted-foreground">Needs attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tickets */}
      <Card className="bg-gradient-card border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Tickets</CardTitle>
              <CardDescription>Latest support requests from your team</CardDescription>
            </div>
            <Button variant="outline" onClick={() => navigate("/all-tickets")}>
              Manage All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tickets.slice(0, 4).map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between p-4 rounded-lg border bg-background/50 hover:bg-background/80 transition-colors">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{ticket.title}</h4>
                      <Badge className={`${getPriorityColor(ticket.priority)} text-xs`}>
                        {ticket.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Assigned to: {ticket.assignee}</span>
                      <span>Category: {ticket.category}</span>
                      <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={`${getStatusColor(ticket.status)} text-xs`}>
                    {ticket.status.replace("-", " ").toUpperCase()}
                  </Badge>
                  <Button variant="outline" size="sm">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}