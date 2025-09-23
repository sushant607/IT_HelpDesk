import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Loader2, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TicketFormData {
  title: string;
  description: string;
  department: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignee?: string;
}

export default function NewTicketPage() {
  const [formData, setFormData] = useState<TicketFormData>({
    title: "",
    description: "",
    department:"",
    priority: "medium",
    assignee: "unassigned",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const userRole = localStorage.getItem("user_role");

  const departments = [
    "Account Access",
    "Software",
    "Hardware",
    "Network",
    "Email",
    "Infrastructure",
    "Database",
    "Security",
    "Other"
  ];

  const teamMembers = [
    "John Doe",
    "Jane Smith", 
    "Bob Wilson",
    "Sarah Johnson",
    "Mike Chen",
    "Lisa Park",
    "Alex Rodriguez",
    "Emma Thompson"
  ];

  const handleInputChange = (field: keyof TicketFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };
  console.log(formData);
  const validateForm = () => {
    if (!formData.title.trim()) {
      setError("Title is required");
      return false;
    }
    if (!formData.description.trim()) {
      setError("Description is required");
      return false;
    }
    if (!formData.department) {
      setError("Please select a department");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  if (!validateForm()) return;

  setIsLoading(true);
  setError("");

  try {
    const token = localStorage.getItem("auth_token");
   //console.log(token);
    const res = await fetch("http://localhost:5000/api/tickets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(formData), // send form data
    });

    if (!res.ok) {
      throw new Error("Failed to create ticket");
    }

    const newTicket = await res.json();

    toast({
      title: "Ticket created successfully!",
      description: `Ticket ${newTicket._id} has been created.`,
    });

    // Navigate back
    if (userRole === "manager") {
      navigate("/dashboard/all-tickets");
    } else {
      navigate("/dashboard/tickets");
    }
  } catch (err) {
    setError("Failed to create ticket. Please try again.");
  } finally {
    setIsLoading(false);
  }
};


  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Form */}
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Create New Ticket</h1>
              <p className="text-muted-foreground mt-2">
                Submit a new IT support request
              </p>
            </div>
          </div>

          {/* Form */}
          <Card className="bg-gradient-card border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Ticket Details</CardTitle>
              <CardDescription>
                Provide detailed information about your IT support request
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="Brief description of the issue"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                placeholder="Detailed description of the issue, including steps to reproduce, error messages, and any other relevant information..."
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={5}
                required
              />
            </div>

            {/* Category and Priority Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department *</Label>
                <Select
                  value={formData.department}
                  onValueChange={(value) => handleInputChange("department", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(department => (
                      <SelectItem key={department} value={department}>
                        {department}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => handleInputChange("priority", value)}
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
              </div>
            </div>

            {/* Manager-only fields */}
            {userRole === "manager" && (
              <div className="space-y-2">
                <Label htmlFor="assignee">Assign To</Label>
                <Select
                  value={formData.assignee}
                  onValueChange={(value) => handleInputChange("assignee", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member (optional)" />
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
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Ticket...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Create Ticket
                  </>
                )}
              </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        </div>

        {/* Right side - Illustration */}
        <div className="hidden lg:flex items-center justify-center">
          <div className="relative">
            <div className="w-96 h-96 bg-gradient-primary rounded-full opacity-10 animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-32 h-32 bg-gradient-primary rounded-2xl flex items-center justify-center mx-auto">
                  <Ticket className="w-16 h-16 text-primary-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold">Need Help?</h3>
                  <p className="text-muted-foreground max-w-xs">
                    Our IT support team is here to help you resolve any technical issues quickly and efficiently.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}