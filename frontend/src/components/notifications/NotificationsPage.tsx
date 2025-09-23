import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Check, X, Eye, Trash2, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  isRead: boolean;
  createdAt: string;
  actionUrl?: string;
  ticketId?: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const { toast } = useToast();

  useEffect(() => {
    // Mock notifications data
    const mockNotifications: Notification[] = [
      {
        id: "n001",
        title: "Ticket Status Updated",
        message: "Your ticket 'Password Reset Request' has been resolved by John Doe.",
        type: "success",
        isRead: false,
        createdAt: "2024-01-22T10:30:00Z",
        actionUrl: "/dashboard/tickets/T001",
        ticketId: "T001"
      },
      {
        id: "n002",
        title: "New Ticket Assigned",
        message: "You have been assigned a new ticket: 'Software Installation Issue'.",
        type: "info",
        isRead: false,
        createdAt: "2024-01-22T09:15:00Z",
        actionUrl: "/dashboard/tickets/T002",
        ticketId: "T002"
      },
      {
        id: "n003",
        title: "Ticket Priority Changed",
        message: "Priority for ticket 'VPN Connection Problems' has been updated to High.",
        type: "warning",
        isRead: true,
        createdAt: "2024-01-21T16:45:00Z",
        actionUrl: "/dashboard/tickets/T003",
        ticketId: "T003"
      },
      {
        id: "n004",
        title: "System Maintenance",
        message: "Scheduled maintenance will occur on Saturday from 2:00 AM to 4:00 AM EST.",
        type: "info",
        isRead: true,
        createdAt: "2024-01-21T14:20:00Z"
      },
      {
        id: "n005",
        title: "Ticket Overdue",
        message: "Ticket 'Laptop Performance Issues' is overdue and requires immediate attention.",
        type: "error",
        isRead: false,
        createdAt: "2024-01-21T08:00:00Z",
        actionUrl: "/dashboard/tickets/T004",
        ticketId: "T004"
      },
      {
        id: "n006",
        title: "Welcome to IT Helpdesk",
        message: "Your account has been created successfully. You can now submit and track support tickets.",
        type: "success",
        isRead: true,
        createdAt: "2024-01-15T12:00:00Z"
      }
    ];

    setNotifications(mockNotifications);
  }, []);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success": return "text-green-600 bg-green-100";
      case "warning": return "text-yellow-600 bg-yellow-100";
      case "error": return "text-red-600 bg-red-100";
      case "info": return "text-blue-600 bg-blue-100";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success": return <Check className="w-4 h-4" />;
      case "warning": return <Bell className="w-4 h-4" />;
      case "error": return <X className="w-4 h-4" />;
      case "info": return <Bell className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    if (filter === "unread") return !notification.isRead;
    if (filter === "read") return notification.isRead;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id
          ? { ...notification, isRead: true }
          : notification
      )
    );
    toast({
      title: "Notification marked as read",
      description: "The notification has been marked as read.",
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notification => ({ ...notification, isRead: true }))
    );
    toast({
      title: "All notifications marked as read",
      description: "All notifications have been marked as read.",
    });
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast({
      title: "Notification deleted",
      description: "The notification has been removed.",
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground mt-2">
            Stay updated with your tickets and system alerts
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <Check className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          )}
          <Button variant="ghost" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-card border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{notifications.length}</p>
              </div>
              <Bell className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unread</p>
                <p className="text-2xl font-bold text-primary">{unreadCount}</p>
              </div>
              <BellOff className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Read</p>
                <p className="text-2xl font-bold text-green-600">{notifications.length - unreadCount}</p>
              </div>
              <Check className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-gradient-card border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Filter Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {["all", "unread", "read"].map((filterType) => (
              <Button
                key={filterType}
                variant={filter === filterType ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(filterType as any)}
                className={filter === filterType ? "bg-gradient-primary" : ""}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                {filterType === "unread" && unreadCount > 0 && (
                  <Badge className="ml-2 bg-destructive text-destructive-foreground">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications List */}
      <div className="space-y-4">
        {filteredNotifications.length === 0 ? (
          <Card className="bg-gradient-card border-0 shadow-md">
            <CardContent className="p-12 text-center">
              <BellOff className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <div className="text-muted-foreground">
                <p className="text-lg mb-2">No notifications found</p>
                <p>
                  {filter === "unread" 
                    ? "All caught up! No unread notifications." 
                    : filter === "read"
                    ? "No read notifications to display."
                    : "No notifications available."}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredNotifications.map((notification) => (
            <Card
              key={notification.id}
              className={`bg-gradient-card border-0 shadow-md transition-all duration-200 hover:shadow-lg ${
                !notification.isRead ? "border-l-4 border-l-primary" : ""
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-1 rounded-full ${getTypeColor(notification.type)}`}>
                        {getTypeIcon(notification.type)}
                      </div>
                      <h3 className="font-semibold text-lg">{notification.title}</h3>
                      {!notification.isRead && (
                        <Badge variant="outline" className="bg-primary text-primary-foreground">
                          New
                        </Badge>
                      )}
                      <Badge className={getTypeColor(notification.type)}>
                        {notification.type.toUpperCase()}
                      </Badge>
                    </div>
                    
                    <p className="text-muted-foreground mb-4">
                      {notification.message}
                    </p>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{formatDate(notification.createdAt)}</span>
                      {notification.ticketId && (
                        <span className="flex items-center gap-1">
                          <strong>Ticket:</strong> {notification.ticketId}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    {notification.actionUrl && (
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    )}
                    {!notification.isRead && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Mark Read
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}