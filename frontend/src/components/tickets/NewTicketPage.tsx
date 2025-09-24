import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Save, Loader2, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { log } from "console";

interface Comment{
  author:string,
  message:string
}
interface TicketFormData {
  title: string;
  description: string;
  department: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignee?: string;
  comments: Comment[];
  attachments: File[];
}
interface UploadedAttachment {
  filename: string;
  url: string;
}

type DeptUser = {
  _id: string;
  name: string;
  email: string;
  role: "employee" | "manager" | "admin";
  department?: string;
};

export default function NewTicketPage() {
  const [formData, setFormData] = useState<TicketFormData>({
    title: "",
    description: "",
    department: localStorage.getItem("user_department") || "",
    priority: "medium",
    assignee: undefined,
    comments: [],
    attachments: [],
  });
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const token = localStorage.getItem("auth_token") || "";
  const userRole = localStorage.getItem("user_role") || "employee";
  const userId = localStorage.getItem("user_id") || "";
  const userDept = localStorage.getItem("user_department") || "";

  const departments = [
    "Account Access",
    "Software",
    "Hardware",
    "Network",
    "Email",
    "Infrastructure",
    "Database",
    "Security",
    "Other",
  ];

  const handleInputChange = (field: keyof TicketFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFormData((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...Array.from(e.target.files!)],
      }));
    }
  };

const handleAddComment = () => {
  if (newComment.trim()) {
    setFormData((prev) => ({
      ...prev,
      comments: [
        ...prev.comments,
        { message: newComment.trim(), author: userId } 
      ],
    }));
    setNewComment("");
  }
};


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
      const uploadedAttachments: UploadedAttachment[] = [];

  for (const file of formData.attachments) {
    const uploadForm = new FormData();
    uploadForm.append("file", file);

    const uploadRes = await fetch("http://localhost:5000/api/upload", {
      method: "POST",
      headers: {
        "Authorization": token ? `Bearer ${token}` : "",
      },
      body: uploadForm,
    });


    if (!uploadRes.ok) throw new Error("File upload failed");
    const uploadData = await uploadRes.json();

    console.log(uploadData);

    uploadedAttachments.push({
      url:uploadData.url,
      filename: uploadData.filename,
    }
     
     
    );
  }
      
    

    

console.log("Form Data:", formData.comments);


  // Step 2: Now send ticket data with attachment info
  const ticketBody = {
    title: formData.title,
    description: formData.description,
    priority: formData.priority,
    createdForUserId: userId,
    department: formData.department,
    assignedTo:
      userRole === "manager" || userRole === "admin" ? formData.assignee : null,
    comments: formData.comments,
    attachments:uploadedAttachments , // store uploaded URLs + IDs
  };
      // Using FormData because of file uploads
      // const formDataToSend = new FormData();
      // formDataToSend.append("title", formData.title);
      // formDataToSend.append("description", formData.description);
      // formDataToSend.append("priority", formData.priority);
      // formDataToSend.append("createdForUserId", userId);
      // formDataToSend.append("department", formData.department);

      // if (userRole === "manager" || userRole === "admin") {
      //   formDataToSend.append("assignedTo", formData.assignee || "");
      // }

      // formData.comments.forEach((c, i) =>
      //   formDataToSend.append(`comments[${i}]`, c)
      // );

      // formData.attachments.forEach((file) =>
      //   formDataToSend.append("attachments", file)
      // );
console.log(ticketBody);
if(uploadedAttachments&&formData.comments){
   const res = await fetch("http://localhost:5000/api/tickets", {
        method: "POST",
        headers: {
           "Content-Type": "application/json", 
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(ticketBody),
      });

       const txt = await res.text();
      let data: any;
      try {
        data = JSON.parse(txt);
      } catch {
        data = txt;
      }

      if (!res.ok) {
        throw new Error(
          typeof data === "string" ? data : data?.msg || "Failed to create ticket"
        );
      }

     

     

      const ticketId = data?.ticket_id || data?._id || "created";
      toast({
        title: "Ticket created successfully!",
        description: `Ticket ${ticketId} has been created.`,
      });

      if (userRole === "manager" || userRole === "admin") {
        navigate("/dashboard/all-tickets");
      } else {
        navigate("/dashboard/tickets");
      }
    }
    } catch (err: any) {
      setError(err.message || "Failed to create ticket. Please try again.");
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
              <h1 className="text-3xl font-bold tracking-tight">
                Create New Ticket
              </h1>
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
                    onChange={(e) =>
                      handleInputChange("title", e.target.value)
                    }
                    required
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Detailed description..."
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange("description", e.target.value)
                    }
                    rows={5}
                    required
                  />
                </div>

                {/* Department & Priority */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department *</Label>
                 
                  
                 
  <Input
    id="department"
    value={formData.department}
    readOnly
  />



                   
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) =>
                        handleInputChange("priority", value as any)
                      }
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

                {/* Comments */}
                <div className="space-y-2">
                  <Label>Comments</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a comment"
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                    />
                    <Button type="button" onClick={handleAddComment}>
                      Add
                    </Button>
                  </div>
                  {formData.comments.length > 0 && (
                    <ul className="list-disc list-inside text-sm">
                      {formData.comments.map((c, idx) => (
                        <li key={idx}>{c.message}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Attachments */}
                <div className="space-y-2">
                  <Label htmlFor="attachments">Attachments</Label>
                  <Input
                    type="file"
                    id="attachments"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  {formData.attachments.length > 0 && (
                    <ul className="text-sm mt-2">
                      {formData.attachments.map((file, idx) => (
                        <li key={idx}>{file.name}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Submit */}
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
                    className="bg-gradient-primary"
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
                    Our IT support team is here to help you resolve any technical
                    issues quickly and efficiently.
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
