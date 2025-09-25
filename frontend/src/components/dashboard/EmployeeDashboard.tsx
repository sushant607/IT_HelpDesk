import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Ticket, Clock, CheckCircle, XCircle, BarChart3, PieChart, TrendingUp, AlertCircle, Tag, Hash } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TicketData {
  _id: string;
  title: string;
  description: string;
  department: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: any;
  assignedTo?: any;
}

interface TagAnalytics {
  tag: string;
  totalTickets: number;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  recentTickets: any[];
}

interface AnalyticsResponse {
  success: boolean;
  summary: {
    totalTags: number;
    totalTickets: number;
    timeframe: number;
    generatedAt: string;
  };
  tags: TagAnalytics[];
}

export default function EmployeeDashboard() {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const navigate = useNavigate();
  
  const token = localStorage.getItem("auth_token") || "";
  const userId = localStorage.getItem("user_id") || "";

  useEffect(() => {
    fetchTickets();
    fetchAnalytics();
  }, []);

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const response = await fetch("http://localhost:5000/api/tickets", {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || data || []);
      } else {
        console.error("Failed to fetch tickets:", response.statusText);
        setTickets([]);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const response = await fetch(
        "http://localhost:5000/api/tickets/analytics/tags?timeframe=30",
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        console.error("Failed to fetch analytics:", response.statusText);
        // Fallback analytics based on real tickets
        if (tickets.length > 0) {
          createFallbackTagAnalytics();
        }
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      if (tickets.length > 0) {
        createFallbackTagAnalytics();
      }
    } finally {
      setLoadingAnalytics(false);
    }
  };

  // Create tag analytics from actual ticket data if API fails
  const createFallbackTagAnalytics = () => {
    const tagGroups: Record<string, TagAnalytics> = {};
    
    tickets.forEach(ticket => {
      const ticketTags = ticket.tags && ticket.tags.length > 0 ? ticket.tags : ['Untagged'];
      
      ticketTags.forEach(tag => {
        if (!tagGroups[tag]) {
          tagGroups[tag] = {
            tag,
            totalTickets: 0,
            statusBreakdown: {},
            priorityBreakdown: {},
            recentTickets: []
          };
        }
        
        tagGroups[tag].totalTickets++;
        tagGroups[tag].statusBreakdown[ticket.status] = (tagGroups[tag].statusBreakdown[ticket.status] || 0) + 1;
        tagGroups[tag].priorityBreakdown[ticket.priority] = (tagGroups[tag].priorityBreakdown[ticket.priority] || 0) + 1;
      });
    });

    setAnalytics({
      success: true,
      summary: {
        totalTags: Object.keys(tagGroups).length,
        totalTickets: tickets.length,
        timeframe: 30,
        generatedAt: new Date().toISOString()
      },
      tags: Object.values(tagGroups).sort((a, b) => b.totalTickets - a.totalTickets)
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <Clock className="w-4 h-4" />;
      case "in-progress": return <TrendingUp className="w-4 h-4" />;
      case "resolved": return <CheckCircle className="w-4 h-4" />;
      case "closed": return <XCircle className="w-4 h-4" />;
      default: return <Ticket className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-500 text-white";
      case "in-progress": return "bg-orange-500 text-white";
      case "resolved": return "bg-green-500 text-white";
      case "closed": return "bg-gray-500 text-white";
      default: return "bg-muted";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "bg-green-100 text-green-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "urgent": return "bg-red-100 text-red-800";
      default: return "bg-muted";
    }
  };

  const getTagColor = (tag: string, index: number) => {
    const colors = [
      "bg-blue-100 text-blue-800",
      "bg-purple-100 text-purple-800",
      "bg-green-100 text-green-800", 
      "bg-yellow-100 text-yellow-800",
      "bg-pink-100 text-pink-800",
      "bg-indigo-100 text-indigo-800",
      "bg-red-100 text-red-800",
      "bg-teal-100 text-teal-800"
    ];
    
    if (tag === 'Untagged') return "bg-gray-100 text-gray-800";
    return colors[index % colors.length];
  };

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    inProgress: tickets.filter(t => t.status === "in-progress").length,
    resolved: tickets.filter(t => t.status === "resolved").length,
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
          <p className="text-muted-foreground">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tickets</CardTitle>
            <Ticket className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              {analytics ? `Last ${analytics.summary.timeframe} days` : 'All time'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Clock className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.open}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <TrendingUp className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">Being worked on</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts Section */}
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ✅ UPDATED: Tag Distribution Instead of Department */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Tag Distribution
              </CardTitle>
              <CardDescription>
                Tickets organized by tags (Last {analytics.summary.timeframe} days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAnalytics ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  {analytics.tags.map((tagData, index) => (
                    <div key={tagData.tag} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Badge className={getTagColor(tagData.tag, index)}>
                            <Hash className="w-3 h-3 mr-1" />
                            {tagData.tag}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {tagData.totalTickets} tickets
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-muted rounded-full h-3">
                        <div
                          className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-full h-3 transition-all duration-500"
                          style={{
                            width: `${(tagData.totalTickets / analytics.summary.totalTickets) * 100}%`
                          }}
                        />
                      </div>
                      
                      {/* Status breakdown badges */}
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(tagData.statusBreakdown || {}).map(([status, count]) => (
                          <Badge 
                            key={status} 
                            className={getStatusColor(status)}
                            variant="secondary"
                          >
                            {status}: {count}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Priority Distribution
              </CardTitle>
              <CardDescription>
                Breakdown by priority levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['urgent', 'high', 'medium', 'low'].map(priority => {
                  const total = analytics?.tags.reduce((sum, tag) => 
                    sum + (tag.priorityBreakdown?.[priority] || 0), 0
                  ) || 0;
                  
                  if (total === 0) return null;
                  
                  const percentage = analytics?.summary.totalTickets 
                    ? (total / analytics.summary.totalTickets) * 100 
                    : 0;
                  
                  return (
                    <div key={priority} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Badge className={getPriorityColor(priority)}>
                          {priority.toUpperCase()}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {total} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`rounded-full h-2 transition-all duration-500 ${
                            priority === 'urgent' ? 'bg-red-500' :
                            priority === 'high' ? 'bg-orange-500' :
                            priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Tickets */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
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
          {loadingTickets ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2 text-sm text-muted-foreground">Loading tickets...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8">
              <Ticket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium text-muted-foreground">No tickets yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first ticket to get started</p>
              <Button onClick={() => navigate("/tickets/new")} className="bg-gradient-primary">
                <Plus className="w-4 h-4 mr-2" />
                Create Ticket
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 3)
                .map((ticket) => (
                <div key={ticket._id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-4">
                    {getStatusIcon(ticket.status)}
                    <div className="space-y-1">
                      <p className="font-medium">{ticket.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {ticket.description}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{ticket.department}</Badge>
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                        {/* Show ticket tags */}
                        {ticket.tags && ticket.tags.map((tag, index) => (
                          <Badge key={tag} className={getTagColor(tag, index)}>
                            <Hash className="w-3 h-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                        <span className="text-xs text-muted-foreground">
                          Created {new Date(ticket.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge className={getStatusColor(ticket.status)}>
                    {ticket.status.replace("-", " ").toUpperCase()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
