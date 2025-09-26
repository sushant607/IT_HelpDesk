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
  const [answerFromAttachments, setAnswerFromAttachments] = useState(false); // NEW
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Helper: turn raw URLs into "click here" links while preserving text
  function renderWithLinks(text: string): React.ReactNode[] {
    // First, normalize markdown-style [label](url) by replacing with just the URL token
    const mdLink = /\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/g;
    const normalized = text.replace(mdLink, '$1');

    // Now split on plain URLs and rebuild as JSX
    const urlRegex = /(https?:\/\/[^\s)]+)(?=[\s)|\]]|$)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    let idx = 1; // for optional index tags like [1], [2]
    while ((match = urlRegex.exec(normalized)) !== null) {
      const url = match[1];
      // Push preceding text
      if (match.index > lastIndex) {
        parts.push(normalized.slice(lastIndex, match.index));
      }
      // Push clickable link labeled "click here"
      parts.push(
        <a
          key={`${url}-${idx}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          click here
        </a>
      );
      lastIndex = match.index + url.length;
      idx += 1;
    }
    // Remainder
    if (lastIndex < normalized.length) {
      parts.push(normalized.slice(lastIndex));
    }
    return parts;
  }

  // Wrapper: only apply to bot messages
  function renderMessageContent(message: ChatMessage) {
    if (message.sender !== "bot") return message.content;
    return <div className="whitespace-pre-wrap">{renderWithLinks(message.content)}</div>;
  }

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
  
    try {
      if (answerFromAttachments) {
        console.log("RAG mode enabled");
        const token = localStorage.getItem('auth_token');
        
        // Use relative URL to leverage dev proxy
        const resp = await fetch('http://localhost:5000/api/upload/tickets/me/rag/query', {
          method: "POST",
          headers: {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          credentials: "include",
          body: JSON.stringify({
            query: userMessage.content,
            topK: 5,
            ensureIndex: true,
            reindex: false
          }),
        });
  
        if (!resp.ok) {
          const errorData = await resp.json();
          throw new Error(errorData?.error || `HTTP ${resp.status}`);
        }
  
        const data = await resp.json();
        console.log("RAG response:", data);
  
        // Format sources as URLs for the link renderer
        const sources = Array.isArray(data.sources)
          ? data.sources
              .filter(s => s?.url)
              .map((s: any, i: number) => `[${i + 1}] ${s.url}`)
              .join("  ")
          : "";
  
        const final = sources
          ? `${data.answer || "No answer"}\n\nSources: ${sources}`
          : (data.answer || "No relevant information found.");
  
        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          content: final,
          sender: "bot",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        // Regular AI chat
        const response = await apiService.chatMessage({
          message: userMessage.content,
        });
        
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
      }
    } catch (e: any) {
      console.error("Chat error:", e);
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        content: `Error: ${e?.message || "Failed to process request"}`,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMessage]);
    } finally {
      setIsLoading(false);
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
                      {/* {message.content} */}
                  {renderMessageContent(message)}

                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.ticketId && (
                    <Badge variant="secondary" className="mt-2">Ticket: {message.ticketId}</Badge>
                  )}
                  </div>
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
                  variant={answerFromAttachments ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                  onClick={() => setAnswerFromAttachments(v => !v)}
                  disabled={isLoading}
                  title="When enabled, the assistant will answer using ticket attachments"
                >
                  <Ticket className="h-4 w-4 mr-2" />
                  Answer from attachments
                  {answerFromAttachments ? <Badge className="ml-2">ON</Badge> : null}
                </Button>
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