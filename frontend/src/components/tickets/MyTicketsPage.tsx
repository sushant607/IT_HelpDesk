import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Filter, Edit, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TicketData {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  // New display fields derived from populated refs
  createdByName?: string;
  assignedToName?: string;
}

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const navigate = useNavigate();

  // Fetch assigned-to-me tickets from backend
  useEffect(() => {
    const fetchAssigned = async () => {
      try {
        const token = localStorage.getItem("auth_token"); // adjust if token stored elsewhere [file:1f91ef64-8f79-47ba-b4ab-4c5e24f3a0ab]
        const res = await fetch("http://localhost:5000/api/tickets", { // assigned route filters by req.user.id [file:3f883422-be55-48fe-98ba-349bb97ba5ef]
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        const txt = await res.text();
        let data: unknown;
        try { data = JSON.parse(txt); } catch { data = txt; }

        if (!res.ok) {
          const msg = typeof data === "string" ? data : (data as any)?.msg || `Request failed with ${res.status}`;
          throw new Error(msg); // keep clean error surfacing [file:58d33a1c-b473-4b97-8828-c7ee17c0ca57]
        }

        // Accept either a bare array or { tickets: [...] } as per your Postman response [file:58d33a1c-b473-4b97-8828-c7ee17c0ca57]
        let list: any[] | null = null;
        if (Array.isArray(data)) {
          list = data;
        } else if (data && typeof data === "object" && Array.isArray((data as any).tickets)) {
          list = (data as any).tickets;
        }

        if (!list) {
          console.error("Unexpected payload for /assigned:", data);
          setTickets([]);
          setFilteredTickets([]);
          return; // graceful empty state without throwing [file:58d33a1c-b473-4b97-8828-c7ee17c0ca57]
        }

        // Map API -> UI shape including names from populated createdBy/assignedTo [file:3f883422-be55-48fe-98ba-349bb97ba5ef]
        const mapped: TicketData[] = list.map((t: any) => ({
          id: t._id,
          title: t.title,
          description: t.description ?? "",
          category: t.department ?? "General",
          status: t.status === "in_progress" ? "in-progress" : t.status,
          priority: t.priority,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          createdByName: t?.createdBy?.name,           // populated by backend .populate('createdBy','name email') [file:3f883422-be55-48fe-98ba-349bb97ba5ef]
          assignedToName: t?.assignedTo?.name,         // populated by backend .populate('assignedTo','name email') [file:3f883422-be55-48fe-98ba-349bb97ba5ef]
        }));

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

    // Search filter across title/description/category and also names [file:58d33a1c-b473-4b97-8828-c7ee17c0ca57]
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(ticket =>
        ticket.title.toLowerCase().includes(q) ||
        ticket.description.toLowerCase().includes(q) ||
        ticket.category.toLowerCase().includes(q) ||
        (ticket.createdByName?.toLowerCase().includes(q) ?? false) ||
        (ticket.assignedToName?.toLowerCase().includes(q) ?? false)
      );
    }

    // Status filter [file:58d33a1c-b473-4b97-8828-c7ee17c0ca57]
    if (statusFilter !== "all") {
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }

    // Category filter [file:58d33a1c-b473-4b97-8828-c7ee17c0ca57]
    if (categoryFilter !== "all") {
      filtered = filtered.filter(ticket => ticket.category === categoryFilter);
    }

    setFilteredTickets(filtered);
  }, [tickets, searchQuery, statusFilter, categoryFilter]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-full";
      case "in-progress": return "bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-full";
      case "resolved": return "bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full";
      case "closed": return "bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-full";
      default: return "bg-muted px-3 py-1 rounded-full";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "border-l-muted";
      case "medium": return "border-l-primary";
      case "high": return "border-l-warning";
      case "urgent": return "border-l-destructive";
      default: return "border-l-muted";
    }
  };

  const categories = ["Account Access", "Software", "Network", "Hardware", "Email"]; // static UI categories [file:58d33a1c-b473-4b97-8828-c7ee17c0ca57]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Tickets</h1>
          <p className="text-muted-foreground mt-2">
            Track and manage your support requests
          </p>
        </div>
        <Button 
          onClick={() => navigate("/tickets/new")}
          className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Ticket
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-gradient-card border-0 shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
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
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <div className="space-y-4">
        {filteredTickets.length === 0 ? (
          <Card className="bg-gradient-card border-0 shadow-md">
            <CardContent className="p-12 text-center">
              <div className="text-muted-foreground">
                <p className="text-lg mb-2">No tickets found</p>
                <p>Try adjusting your filters or create a new ticket</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredTickets.map((ticket) => (
            <Card key={ticket.id} className={`bg-gradient-card border-0 shadow-md border-l-4 ${getPriorityColor(ticket.priority)} hover:shadow-lg transition-all duration-200`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{ticket.title}</h3>
                      {/* Show names if available; fallback to short id */}
                      <Badge variant="outline" className="text-xs">
                        {ticket.assignedToName
                          ? `Assigned: ${ticket.assignedToName}`
                          : ticket.createdByName
                            ? `Created: ${ticket.createdByName}`
                            : ticket.id.substring(0, 8)}
                      </Badge>
                      <Badge className={`${getStatusColor(ticket.status)} text-xs`}>
                        {ticket.status.replace("-", " ").toUpperCase()}
                      </Badge>
                    </div>
                    
                    <p className="text-muted-foreground mb-4 line-clamp-2">
                      {ticket.description}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <strong>Category:</strong> {ticket.category}
                      </span>
                      <span className="flex items-center gap-1">
                        <strong>Priority:</strong> 
                        <Badge variant="outline" className={`text-xs ml-1 ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </Badge>
                      </span>
                      <span>
                        <strong>Created:</strong> {new Date(ticket.createdAt).toLocaleDateString()}
                      </span>
                      <span>
                        <strong>Updated:</strong> {new Date(ticket.updatedAt).toLocaleDateString()}
                      </span>
                      {/* Optional: show both names inline for clarity */}
                      {ticket.createdByName && (
                        <span className="flex items-center gap-1">
                          <strong>Creator:</strong> {ticket.createdByName}
                        </span>
                      )}
                      {ticket.assignedToName && (
                        <span className="flex items-center gap-1">
                          <strong>Assignee:</strong> {ticket.assignedToName}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/dashboard/tickets/${ticket.id}`)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    {ticket.status === "open" && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/dashboard/tickets/${ticket.id}?edit=true`)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Results Summary */}
      {filteredTickets.length === 0 ? null : (
        <div className="text-center text-sm text-muted-foreground">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </div>
      )}
    </div>
  );
}
