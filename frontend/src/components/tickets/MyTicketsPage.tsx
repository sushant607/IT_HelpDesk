import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, Edit, Eye, Bell } from "lucide-react"; // Added Bell icon
import { useNavigate } from "react-router-dom";
import { toast } from "sonner"; // Make sure to install: npm install sonner

interface TicketData {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  assignedTo?: {
    _id: string;
    name: string;
    email?: string;
  };
}

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
}

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [remindingTickets, setRemindingTickets] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  // Get current user data from JWT token
  useEffect(() => {
    const getCurrentUser = () => {
      try {
        const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
        if (!token) return;

        // Decode JWT to get user info (since your auth middleware does this server-side)
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) return;

        const payload = JSON.parse(atob(tokenParts[1]));
        if (payload.user) {
          setCurrentUser({
            id: payload.user.id,
            name: payload.user.name || 'Unknown User',
            email: payload.user.email || '',
            role: payload.user.role || 'employee',
            department: payload.user.department || ''
          });
          console.log("Current user from token:", payload.user);
        }
      } catch (error) {
        console.error("Failed to decode user from token:", error);
      }
    };

    getCurrentUser();
  }, []);

  useEffect(() => {
    const fetchAssigned = async () => {
      try {
        const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
        const url = "http://localhost:5000/api/tickets?scope=me";
        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        const txt = await res.text();
        let data: unknown;
        try {
          data = JSON.parse(txt);
        } catch {
          data = txt;
        }

        if (!res.ok) {
          const msg =
            typeof data === "string" ? data : (data as any)?.msg || `Request failed with ${res.status}`;
          throw new Error(msg);
        }

        let list: any[] | null = null;
        if (Array.isArray(data)) {
          list = data;
        } else if (data && typeof data === "object" && Array.isArray((data as any).tickets)) {
          list = (data as any).tickets;
        }

        if (!list) {
          console.error("Unexpected payload for tickets:", data);
          setTickets([]);
          setFilteredTickets([]);
          return;
        }

        const mapped: TicketData[] = list.map((t: any) => ({
          id: t._id,
          title: t.title,
          description: t.description ?? "",
          category: t.department ?? "General",
          status: t.status === "in_progress" ? "in-progress" : t.status,
          priority: t.priority,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          createdByName: t?.createdBy?.name || undefined,
          assignedTo: t.assignedTo ? {
            _id: t.assignedTo._id,
            name: t.assignedTo.name,
            email: t.assignedTo.email
          } : undefined,
        }));

        console.log("Mapped tickets with assignedTo:", mapped);
        setTickets(mapped);
        setFilteredTickets(mapped);
      } catch (e) {
        console.error("Failed to load assigned tickets:", e);
        setTickets([]);
        setFilteredTickets([]);
      }
    };

    fetchAssigned();
  }, []);

  useEffect(() => {
    let filtered = tickets;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (ticket) =>
          ticket.title.toLowerCase().includes(q) ||
          ticket.description.toLowerCase().includes(q) ||
          ticket.category.toLowerCase().includes(q) ||
          (ticket.createdByName?.toLowerCase().includes(q) ?? false)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((ticket) => ticket.status === statusFilter);
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((ticket) => ticket.category === categoryFilter);
    }

    setFilteredTickets(filtered);
  }, [tickets, searchQuery, statusFilter, categoryFilter]);

  // Check if current user is a manager
  const isManager = currentUser?.role === 'manager';

  // Handle remind functionality (managers only)
  const handleRemindAssignee = async (ticketId: string, ticketTitle: string) => {
    if (!isManager) {
      toast.error('Only managers can send reminders');
      return;
    }

    try {
      setRemindingTickets(prev => new Set(prev.add(ticketId)));
      
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/notifications/remind/${ticketId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.msg || 'Failed to send reminder');
      }

      // Show success toast
      toast.success(`Reminder sent to ${data.assigneeName} for "${data.ticketTitle}"`);
      
    } catch (error) {
      console.error('Failed to send reminder:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to send reminder');
    } finally {
      setRemindingTickets(prev => {
        const newSet = new Set(prev);
        newSet.delete(ticketId);
        return newSet;
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full";
      case "in-progress":
        return "bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-full";
      case "resolved":
        return "bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full";
      case "closed":
        return "bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-full";
      default:
        return "bg-muted px-3 py-1 rounded-full";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low":
        return "border-l-muted";
      case "medium":
        return "border-l-primary";
      case "high":
        return "border-l-warning";
      case "urgent":
        return "border-l-destructive";
      default:
        return "border-l-muted";
    }
  };

  const categories = ["Account Access", "Software", "Network", "Hardware", "Email"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Tickets</h1>
          <p className="text-muted-foreground">
            Track and manage your support requests
            {/* {isManager && <span className="ml-2 text-amber-600 font-medium">(Manager View)</span>} */}
          </p>
        </div>
        <Button onClick={() => navigate("/tickets/new")} className="bg-gradient-primary hover:shadow-glow transition-all duration-300">
          <Plus className="w-4 h-4 mr-2" />
          Create Ticket
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in-progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Debug Info - Remove in production */}
      {/* {process.env.NODE_ENV === 'development' && (
        <Card className="bg-gray-50">
          <CardContent className="p-4">
            <p className="text-sm">
              <strong>Debug:</strong> Current user role: {currentUser?.role || 'Loading...'} | 
              Is Manager: {isManager ? 'Yes' : 'No'} | 
              User: {currentUser?.name || 'Unknown'}
            </p>
          </CardContent>
        </Card>
      )} */}

      {/* Tickets List */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <h3 className="text-lg font-semibold mb-2">No tickets found</h3>
              <p className="text-muted-foreground">Try adjusting your filters or create a new ticket</p>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Card key={ticket.id} className={`border-l-4 ${getPriorityColor(ticket.priority)}`}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{ticket.title}</CardTitle>
                    <CardDescription>
                      {ticket.createdByName ? `Created by: ${ticket.createdByName}` : ticket.id.substring(0, 8)}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(ticket.status)}>
                    {ticket.status.replace("-", " ").toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{ticket.description}</p>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span>Category: {ticket.category}</span>
                  <span className="flex items-center gap-1">
                    Priority:
                    <Badge variant="outline">{ticket.priority}</Badge>
                  </span>
                  <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                  <span>Updated: {new Date(ticket.updatedAt).toLocaleDateString()}</span>
                  {ticket.assignedTo && (
                    <span>Assigned to: {ticket.assignedTo.name}</span>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  {/* Debug info for button visibility */}
                  {/* {process.env.NODE_ENV === 'development' && (
                    <span className="text-xs text-gray-500 mr-4">
                      Show Remind: {isManager && ticket.assignedTo && !['closed', 'resolved'].includes(ticket.status) ? 'Yes' : 'No'}
                    </span>
                  )} */}
                  
                  {/* Manager Remind Button - only show for managers with assigned tickets that aren't closed/resolved */}
                  {isManager && ticket.assignedTo && !['closed', 'resolved'].includes(ticket.status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemindAssignee(ticket.id, ticket.title)}
                      disabled={remindingTickets.has(ticket.id)}
                      className="hover:bg-amber-50 hover:border-amber-200 text-amber-700 border-amber-200"
                    >
                      <Bell className="w-4 h-4 mr-2" />
                      {remindingTickets.has(ticket.id) ? 'Sending...' : 'Remind'}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/tickets/${ticket.id}`)}>
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {filteredTickets.length === 0 ? null : (
        <div className="text-center text-sm text-muted-foreground">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </div>
      )}
    </div>
  );
}
