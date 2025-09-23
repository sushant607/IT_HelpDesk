import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Edit, Save, X, Calendar, User, Tag, Flag, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface TicketData {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "open" | "in-progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  assignee?: string;
  createdBy?: string;
}

export default function TicketDetailsPage() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<TicketData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const userRole = localStorage.getItem("user_role");
  const userEmail = localStorage.getItem("user_email");

  const categories = [
    "Account Access", "Software", "Hardware", "Network", "Email",
    "Infrastructure", "Database", "Security", "Other"
  ];

  const teamMembers = [
    "John Doe", "Jane Smith", "Bob Wilson", "Sarah Johnson",
    "Mike Chen", "Lisa Park", "Alex Rodriguez", "Emma Thompson"
  ];

  useEffect(() => {
    // Mock ticket loading - In real app, fetch from Supabase
    const mockTickets: TicketData[] = [
      {
        id: "T001",
        title: "Password Reset Request",
        description: "Unable to access company email account after password expiration. The password reset link sent to my personal email doesn't seem to work. I've tried multiple times and even checked spam folder. Need urgent assistance as I have important client emails to respond to.",
        category: "Account Access",
        status: "resolved",
        priority: "medium",
        createdAt: "2024-01-15",
        updatedAt: "2024-01-16",
        assignee: "John Doe",
        createdBy: "user@company.com"
      },
      {
        id: "T002",
        title: "Software Installation Issue",
        description: "Need Adobe Creative Suite installed on my workstation for design projects. The current version is outdated and missing several tools required for the new campaign. Installation attempts have failed with error code 1603.",
        category: "Software",
        status: "in-progress",
        priority: "high",
        createdAt: "2024-01-18",
        updatedAt: "2024-01-20",
        assignee: "Jane Smith",
        createdBy: "designer@company.com"
      },
      {
        id: "T003",
        title: "VPN Connection Problems",
        description: "Cannot connect to company VPN from home office. Getting timeout errors consistently. This is blocking my ability to access internal resources and complete my work remotely.",
        category: "Network",
        status: "open",
        priority: "medium",
        createdAt: "2024-01-20",
        updatedAt: "2024-01-20",
        createdBy: "remote@company.com"
      },
      {
        id: "T004",
        title: "Laptop Performance Issues",
        description: "Work laptop running very slow, frequent freezing during video calls. This started after the last Windows update. Performance monitoring shows high CPU usage even with minimal applications running.",
        category: "Hardware",
        status: "open",
        priority: "high",
        createdAt: "2024-01-21",
        updatedAt: "2024-01-21",
        createdBy: "employee@company.com"
      }
    ];

    const foundTicket = mockTickets.find(t => t.id === ticketId);
    if (foundTicket) {
      setTicket(foundTicket);
      setFormData(foundTicket);
    }
  }, [ticketId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-blue-500 hover:bg-blue-600 text-white";
      case "in-progress": return "bg-amber-500 hover:bg-amber-600 text-white";
      case "resolved": return "bg-green-500 hover:bg-green-600 text-white";
      case "closed": return "bg-gray-500 hover:bg-gray-600 text-white";
      default: return "bg-muted";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "text-green-600 bg-green-100";
      case "medium": return "text-yellow-600 bg-yellow-100";
      case "high": return "text-orange-600 bg-orange-100";
      case "urgent": return "text-red-600 bg-red-100";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent": return <Flag className="w-3 h-3 text-red-500" />;
      case "high": return <Flag className="w-3 h-3 text-orange-500" />;
      default: return <Flag className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const canEdit = () => {
    if (userRole === "manager") return true;
    if (ticket?.status === "open" && ticket?.createdBy === userEmail) return true;
    return false;
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData(ticket || {});
  };

  const handleSave = async () => {
    if (!ticket) return;
    
    setIsLoading(true);
    try {
      // Mock save - In real app, update in Supabase
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedTicket = {
        ...ticket,
        ...formData,
        updatedAt: new Date().toISOString().split('T')[0]
      };
      
      setTicket(updatedTicket);
      setIsEditing(false);
      
      toast({
        title: "Ticket updated successfully",
        description: `Ticket ${ticket.id} has been updated.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!ticket) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ticket Not Found</h1>
            <p className="text-muted-foreground mt-2">
              The requested ticket could not be found.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{ticket.title}</h1>
              <Badge variant="outline" className="text-sm">
                {ticket.id}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-2">
              Ticket details and status information
            </p>
          </div>
        </div>

        {canEdit() && !isEditing && (
          <Button onClick={handleEdit} className="bg-gradient-primary hover:shadow-glow">
            <Edit className="w-4 h-4 mr-2" />
            Edit Ticket
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-gradient-card border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Ticket Information</CardTitle>
                {isEditing && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCancel} variant="outline">
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isLoading}>
                      <Save className="w-4 h-4 mr-1" />
                      {isLoading ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                {isEditing ? (
                  <Input
                    id="title"
                    value={formData.title || ""}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                  />
                ) : (
                  <p className="text-lg font-medium">{ticket.title}</p>
                )}
              </div>

              <Separator />

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                {isEditing ? (
                  <Textarea
                    id="description"
                    value={formData.description || ""}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows={6}
                  />
                ) : (
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {ticket.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Category and Priority */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  {isEditing ? (
                    <Select
                      value={formData.category || ""}
                      onValueChange={(value) => setFormData({...formData, category: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(category => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-muted-foreground" />
                      <span>{ticket.category}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  {isEditing ? (
                    <Select
                      value={formData.priority || ""}
                      onValueChange={(value) => setFormData({...formData, priority: value as any})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex items-center gap-2">
                      {getPriorityIcon(ticket.priority)}
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority.toUpperCase()}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Manager-only fields */}
              {userRole === "manager" && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        {isEditing ? (
                          <Select
                            value={formData.status || ""}
                            onValueChange={(value) => setFormData({...formData, status: value as any})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in-progress">In Progress</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={`${getStatusColor(ticket.status)} px-3 py-1`}>
                            {ticket.status.replace("-", " ").toUpperCase()}
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="assignee">Assigned To</Label>
                        {isEditing ? (
                          <Select
                            value={formData.assignee || "unassigned"}
                            onValueChange={(value) => setFormData({...formData, assignee: value === "unassigned" ? undefined : value})}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {teamMembers.map(member => (
                                <SelectItem key={member} value={member}>
                                  {member}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span>{ticket.assignee || "Unassigned"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="bg-gradient-card border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Created
                  </span>
                  <span className="font-medium">
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Updated
                  </span>
                  <span className="font-medium">
                    {new Date(ticket.updatedAt).toLocaleDateString()}
                  </span>
                </div>

                {ticket.createdBy && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Reporter
                    </span>
                    <span className="font-medium text-xs">
                      {ticket.createdBy}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Current Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-3">
                <Badge className={`${getStatusColor(ticket.status)} px-4 py-2 text-sm`}>
                  {ticket.status.replace("-", " ").toUpperCase()}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  Last updated: {new Date(ticket.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}