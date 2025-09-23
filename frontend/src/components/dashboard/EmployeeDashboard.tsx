import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Ticket, Clock, CheckCircle, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TicketData {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  createdAt: string;
  updatedAt: string;
}

export default function EmployeeDashboard() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Mock data for employee tickets
    const mockTickets: TicketData[] = [
      {
        id: "T001",
        title: "Password Reset Request",
        description: "Unable to access company email",
        category: "Account Access",
        status: "resolved",
        createdAt: "2024-01-15",
        updatedAt: "2024-01-16"
      },
      {
        id: "T002",
        title: "Software Installation Issue",
        description: "Need Adobe Creative Suite installed",
        category: "Software",
        status: "in-progress",
        createdAt: "2024-01-18",
        updatedAt: "2024-01-18"
      },
      {
        id: "T003",
        title: "VPN Connection Problems",
        description: "Cannot connect to company VPN from home",
        category: "Network",
        status: "open",
        createdAt: "2024-01-20",
        updatedAt: "2024-01-20"
      }
    ];
    setTickets(mockTickets);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <Clock className="w-4 h-4" />;
      case "in-progress": return <Clock className="w-4 h-4" />;
      case "resolved": return <CheckCircle className="w-4 h-4" />;
      case "closed": return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-status-open text-white";
      case "in-progress": return "bg-status-progress text-white";
      case "resolved": return "bg-status-resolved text-white";
      case "closed": return "bg-status-closed text-white";
      default: return "bg-muted";
    }
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in-progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
          <p className="text-muted-foreground mt-2">
            Here's an overview of your support tickets
          </p>
        </div>
        <Button 
          onClick={() => navigate("/tickets/new")}
          className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Clock className="h-4 w-4 text-status-open" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-open">{stats.open}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-status-progress" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-progress">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">Being worked on</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-status-resolved" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-status-resolved">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tickets */}
      <Card className="bg-gradient-card border-0 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Tickets</CardTitle>
              <CardDescription>Your latest support requests</CardDescription>
            </div>
            <Button variant="outline" onClick={() => navigate("/tickets")}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tickets.slice(0, 3).map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between p-4 rounded-lg border bg-background/50">
                <div className="flex items-start space-x-3">
                  {getStatusIcon(ticket.status)}
                  <div className="flex-1">
                    <h4 className="font-medium">{ticket.title}</h4>
                    <p className="text-sm text-muted-foreground">{ticket.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {ticket.category}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Created {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge className={`${getStatusColor(ticket.status)} text-xs`}>
                  {ticket.status.replace("-", " ").toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}