import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  ticketId?: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const { toast } = useToast();

  // ✅ Fetch from backend instead of mock data
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/notifications", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`, // if JWT auth
          },
        });
        const data = await res.json();
        setNotifications(data);
      } catch (err) {
        console.error("Error fetching notifications:", err);
      }
    };

    fetchNotifications();
  }, []);

  // ✅ Mark as read (calls backend)
  const markAsRead = async (id: string) => {
    try {
      await fetch(`http://localhost:5000/api/notifications/${id}/read`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setNotifications(prev =>
        prev.map(n => (n._id === id ? { ...n, read: true } : n))
      );

      toast({ title: "Marked as read" });
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Notifications</h1>
      <Button onClick={() => setFilter("all")}>All</Button>
      <Button onClick={() => setFilter("unread")}>Unread</Button>
      <Button onClick={() => setFilter("read")}>Read</Button>

      <ul>
        {notifications
          .filter(n =>
            filter === "all"
              ? true
              : filter === "unread"
              ? !n.read
              : n.read
          )
          .map(n => (
            <li key={n._id} className="p-2 border-b">
              <p className="font-semibold">{n.title}</p>
              <p>{n.message}</p>
              {!n.read && (
                <Button size="sm" onClick={() => markAsRead(n._id)}>
                  Mark as Read
                </Button>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}
