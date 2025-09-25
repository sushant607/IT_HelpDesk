import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Send, Loader2, Ticket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";

interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  ticketId?: string;
  tickets?: object[];
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      content: "Hi! I'm your IT support assistant. I can help you with password resets, software issues, and create tickets for other problems. How can I help you today?",
      sender: "bot",
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const detectIntent = (message: string): string => {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("password") && (lowerMessage.includes("reset") || lowerMessage.includes("forgot") || lowerMessage.includes("change"))) {
      return "password_reset";
    }

    if (lowerMessage.includes("software") || lowerMessage.includes("install") || lowerMessage.includes("application") || lowerMessage.includes("program")) {
      return "software_issue";
    }

    if (lowerMessage.includes("network") || lowerMessage.includes("internet") || lowerMessage.includes("wifi") || lowerMessage.includes("connection")) {
      return "network_issue";
    }

    if (lowerMessage.includes("hardware") || lowerMessage.includes("computer") || lowerMessage.includes("laptop") || lowerMessage.includes("printer")) {
      return "hardware_issue";
    }

    return "general_issue";
  };

  const generateBotResponse = (intent: string, userMessage: string): { content: string; ticketId?: string } => {
    switch (intent) {
      case "password_reset":
        return {
          content: `I can help you with password reset! Here are the steps:

1. Go to the company login page
2. Click "Forgot Password"
3. Enter your email address
4. Check your email for reset instructions
5. Follow the link and create a new password

If you're still having issues, I can create a ticket for our IT team. Your password reset request has been auto-resolved! ✅`,
          ticketId: `PWD-${Date.now()}`
        };

      case "software_issue":
        return {
          content: `I've created a ticket for your software issue. Our IT team will help you with the installation or configuration.

**Ticket ID: SW-${Date.now()}**

In the meantime, please:
- Make sure you have admin rights on your computer
- Check if the software is available in our approved software list
- Try restarting your computer if it's an installation issue

Our team will contact you within 24 hours!`,
          ticketId: `SW-${Date.now()}`
        };

      case "network_issue":
        return {
          content: `I've created a ticket for your network connectivity issue.

**Ticket ID: NET-${Date.now()}**

Quick troubleshooting steps you can try:
- Restart your router/modem
- Check cable connections
- Try connecting to a different network
- Restart your device's network adapter

Our network team will investigate and contact you soon!`,
          ticketId: `NET-${Date.now()}`
        };

      case "hardware_issue":
        return {
          content: `I've created a ticket for your hardware issue.

**Ticket ID: HW-${Date.now()}**

Please provide additional details:
- What type of hardware is affected?
- When did the issue start?
- Any error messages or unusual behavior?

Our hardware support team will reach out to schedule a diagnostic or replacement if needed.`,
          ticketId: `HW-${Date.now()}`
        };

      default:
        return {
          content: `I've created a general support ticket for your request.

**Ticket ID: GEN-${Date.now()}**

Our IT support team will review your request and get back to you shortly. Please provide any additional details that might help us resolve your issue faster.

Is there anything else I can help you with today?`,
          ticketId: `GEN-${Date.now()}`
        };
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      content: input,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate AI processing delay
    const response = await apiService.chatMessage({ message: input });
    console.log(response.reply);
    const ticketId = '';
    const lines = response.reply.split("\n");

    // Extract ticket info
    let tickets = lines
      .map(line => {
        const match = line.match(/\[ID:\s*([a-f0-9]+)\]/i);
        if (match) {
          const id = match[1];
          const cleanLine = line.replace(/\[ID:.*?\]\s*/, ""); // remove [ID: ...]
          return { id, text: cleanLine.trim() };
        }
        return null;
      })
      .filter(Boolean);

    console.log(tickets);
    if(tickets.length == 0) tickets = undefined;

    const botMessage: ChatMessage = {
      id: `bot-${Date.now()}`,
      content: response.reply,
      sender: "bot",
      timestamp: new Date(),
      tickets: tickets
    };

    setMessages(prev => [...prev, botMessage]);
    setIsLoading(false);

    if (ticketId) {
      toast({
        title: "Ticket Created",
        description: `New support ticket ${ticketId} has been created.`,
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">IT Support Chatbot</h1>
        <p className="text-muted-foreground mt-2">
          Get instant help or create support tickets through our AI assistant
        </p>
      </div>

      <Card className="flex-1 flex flex-col bg-gradient-card border-0 shadow-lg">
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            IT Support Assistant
            <Badge variant="secondary" className="ml-auto">Online</Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[60vh]">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.sender === "user" ? "justify-end" : "justify-start"
                  }`}
              >
                {message.sender === "bot" && (
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}

                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${message.sender === "user"
                      ? "bg-primary text-primary-foreground ml-auto"
                      : "bg-muted/50"
                    }`}
                >
                  {!!message.tickets ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed space-y-1">
                      {message.tickets.map((ticket: any, idx: number) => (
                        <div key={ticket.id || idx}>
                          <a
                            href={`/dashboard/tickets/${ticket.id}`}
                            className="text-primary underline hover:text-primary/80"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {ticket.text}
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                  )}
                  {message.ticketId && (
                    <div className="mt-2 pt-2 border-t border-muted-foreground/20">
                      <Badge variant="outline" className="text-xs">
                        <Ticket className="w-3 h-3 mr-1" />
                        {message.ticketId}
                      </Badge>
                    </div>
                  )}
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>

                {message.sender === "user" && (
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-secondary">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted/50 rounded-lg px-4 py-2 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t p-4 bg-background/50">
            <div className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe your IT issue or ask for help..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("I need to reset my password")}
                disabled={isLoading}
              >
                Password Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("I need help installing software")}
                disabled={isLoading}
              >
                Software Installation
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInput("I'm having network connectivity issues")}
                disabled={isLoading}
              >
                Network Issues
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}