import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService, LoginRequest } from "@/services/api";

interface LoginFormData {
  email: string;
  password: string;
}

export default function LoginPage() {
  const [formData, setFormData] = useState<LoginFormData>({ 
    email: "", 
    password: "" 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Add this helper function at the top of the component
  const getErrorMessage = (error: unknown): string => {
    if (error && typeof error === 'object') {
      if ('message' in error && typeof error.message === 'string') {
        return error.message;
      }
      if ('errors' in error && Array.isArray(error.errors) && error.errors[0]?.msg) {
        return error.errors[0].msg;
      }
    }
    return "An unexpected error occurred. Please try again.";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  const validateForm = (): boolean => {
    if (!formData.email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!formData.password.trim()) {
      setError("Password is required");
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
      const loginData: LoginRequest = {
        email: formData.email,
        password: formData.password,
      };

      const response = await apiService.login(loginData);
      
      // Store authentication data
      localStorage.setItem("auth_token", response.token);
      localStorage.setItem("user_role", response.user.role);
      localStorage.setItem("user_email", response.user.email);
      localStorage.setItem("user_name", response.user.name);
      localStorage.setItem("user_department", response.user.department);
      localStorage.setItem("user_id", response.user.id);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${response.user.name}! Logged in as ${response.user.role}`,
      });
      
      navigate("/dashboard");
    } catch (err: unknown) {
      console.error("Login error:", err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero">
      <div className="w-full max-w-md">
        <Card className="shadow-lg border-0 bg-card/95 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">IT Helpdesk</CardTitle>
            <CardDescription>
              Sign in to access your dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  required
                />
              </div>
              
              <Button
                type="submit"
                className="w-full bg-gradient-primary hover:shadow-glow transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>
              
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Need an account?{" "}
                  <Link to="/signup" className="text-primary hover:underline">
                    Sign up here
                  </Link>
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
