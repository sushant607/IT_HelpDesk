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
}

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<TicketData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    // Mock data for employee's tickets
    const mockTickets: TicketData[] = [
      {
        id: "T001",
        title: "Password Reset Request",
        description: "Unable to access company email account after password expiration",
        category: "Account Access",
        status: "resolved",
        priority: "medium",
        createdAt: "2024-01-15",
        updatedAt: "2024-01-16"
      },
      {
        id: "T002",
        title: "Software Installation Issue",
        description: "Need Adobe Creative Suite installed on my workstation for design projects",
        category: "Software",
        status: "in-progress",
        priority: "high",
        createdAt: "2024-01-18",
        updatedAt: "2024-01-20"
      },
      {
        id: "T003",
        title: "VPN Connection Problems",
        description: "Cannot connect to company VPN from home office. Getting timeout errors.",
        category: "Network",
        status: "open",
        priority: "medium",
        createdAt: "2024-01-20",
        updatedAt: "2024-01-20"
      },
      {
        id: "T004",
        title: "Laptop Performance Issues",
        description: "Work laptop running very slow, frequent freezing during video calls",
        category: "Hardware",
        status: "open",
        priority: "high",
        createdAt: "2024-01-21",
        updatedAt: "2024-01-21"
      },
      {
        id: "T005",
        title: "Email Signature Setup",
        description: "Need help setting up corporate email signature with logo",
        category: "Email",
        status: "closed",
        priority: "low",
        createdAt: "2024-01-10",
        updatedAt: "2024-01-12"
      }
    ];
    setTickets(mockTickets);
    setFilteredTickets(mockTickets);
  }, []);

  useEffect(() => {
    let filtered = tickets;

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(ticket =>
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(ticket => ticket.status === statusFilter);
    }

    // Category filter
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

  const categories = ["Account Access", "Software", "Network", "Hardware", "Email"];

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
                      <Badge variant="outline" className="text-xs">
                        {ticket.id}
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
      {filteredTickets.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {filteredTickets.length} of {tickets.length} tickets
        </div>
      )}
    </div>
  );
}