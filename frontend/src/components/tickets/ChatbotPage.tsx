import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bot, User, Send, Loader2, Ticket, Copy, Check, ExternalLink, FileText, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService } from "@/services/api";
import { Link } from "react-router-dom";
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
  const [answerFromAttachments, setAnswerFromAttachments] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Enhanced response parser with better formatting
  const parseResponse = (content: string) => {
    const sections = [];
    let currentSection = { type: 'text', content: '' };

    // Split content into lines for processing
    const lines = content.split('\n');
    let inCodeBlock = false;
    let codeContent = '';
    let codeLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle code blocks
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          // Starting code block
          if (currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          inCodeBlock = true;
          codeLanguage = line.replace('```', '').trim();
          codeContent = '';
          currentSection = { type: 'text', content: '' };
        } else {
          // Ending code block
          inCodeBlock = false;
          sections.push({
            type: 'code',
            content: codeContent,
            language: codeLanguage
          });
          codeContent = '';
          codeLanguage = '';
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent += (codeContent ? '\n' : '') + line;
        continue;
      }

      // Handle different line types
      if (line.startsWith('# ')) {
        if (currentSection.content.trim()) {
          sections.push({ ...currentSection });
        }
        sections.push({
          type: 'heading',
          content: line.replace('# ', ''),
          level: 1
        });
        currentSection = { type: 'text', content: '' };
      } else if (line.startsWith('## ')) {
        if (currentSection.content.trim()) {
          sections.push({ ...currentSection });
        }
        sections.push({
          type: 'heading',
          content: line.replace('## ', ''),
          level: 2
        });
        currentSection = { type: 'text', content: '' };
      } else if (line.startsWith('### ')) {
        if (currentSection.content.trim()) {
          sections.push({ ...currentSection });
        }
        sections.push({
          type: 'heading',
          content: line.replace('### ', ''),
          level: 3
        });
        currentSection = { type: 'text', content: '' };
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        if (currentSection.type !== 'list') {
          if (currentSection.content && currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          currentSection = { type: 'list', content: '', items: [] };
        }
        currentSection.items.push(line.replace(/^[-*] /, ''));
      } else if (line.match(/^\d+\. /)) {
        if (currentSection.type !== 'numbered-list') {
          if (currentSection.content && currentSection.content.trim()) {
            sections.push({ ...currentSection });
          }
          currentSection = { type: 'numbered-list', content: '', items: [] };
        }
        currentSection.items.push(line.replace(/^\d+\. /, ''));
      } else {
        if (currentSection.type === 'list' || currentSection.type === 'numbered-list') {
          sections.push({ ...currentSection });
          currentSection = { type: 'text', content: '' };
        }
        currentSection.content += (currentSection.content ? '\n' : '') + line;
      }
    }

    if ((currentSection.content && currentSection.content.trim()) || (currentSection.items && currentSection.items.length)) {
      sections.push(currentSection);
    }

    return sections;
  };

  // Enhanced link renderer with better detection
  const renderWithLinks = (text: string): React.ReactNode[] => {
    // First, normalize markdown-style [label](url)
    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let keyIndex = 0;

    // Handle markdown links first
    const processedText = text.replace(mdLinkRegex, (match, label, url) => {
      return `MARKDOWN_LINK_${keyIndex++}|${label}|${url}`;
    });

    // Now handle plain URLs
    const urlRegex = /(https?:\/\/[^\s)]+)(?=[\s)|\]]|$)/g;
    lastIndex = 0;

    while ((match = urlRegex.exec(processedText)) !== null) {
      const url = match[1];
      
      // Add text before URL
      if (match.index > lastIndex) {
        const beforeText = processedText.slice(lastIndex, match.index);
        parts.push(beforeText);
      }
      
      // Add clickable link
      parts.push(
        <a
          key={`url-${keyIndex++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          click here
        </a>
      );
      
      lastIndex = match.index + url.length;
    }

    // Add remaining text
    if (lastIndex < processedText.length) {
      const remainingText = processedText.slice(lastIndex);
      parts.push(remainingText);
    }

    // Now process markdown link placeholders
    return parts.flatMap((part, index) => {
      if (typeof part === 'string' && part.includes('MARKDOWN_LINK_')) {
        const linkParts = part.split(/(MARKDOWN_LINK_\d+\|[^|]+\|[^|]+)/);
        return linkParts.map((linkPart, linkIndex) => {
          if (linkPart.startsWith('MARKDOWN_LINK_')) {
            const [, label, url] = linkPart.split('|');
            return (
              <a
                key={`md-link-${index}-${linkIndex}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                {label}
              </a>
            );
          }
          return linkPart || null;
        }).filter(Boolean);
      }
      return part;
    });
  };

  // Enhanced message content renderer
  const renderMessageContent = (message: ChatMessage) => {
    if (message.sender !== "bot") {
      return <div className="whitespace-pre-wrap break-words">{message.content}</div>;
    }

    const sections = parseResponse(message.content);

    return (
      <div className="space-y-3">
        {sections.map((section, index) => {
          switch (section.type) {
            case 'heading':
              const HeadingTag = `h${section.level}` as keyof JSX.IntrinsicElements;
              const headingClasses = {
                1: "text-lg font-bold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-1",
                2: "text-base font-semibold text-gray-800 dark:text-gray-200",
                3: "text-sm font-medium text-gray-700 dark:text-gray-300"
              };
              return (
                <HeadingTag key={index} className={headingClasses[section.level] || headingClasses[3]}>
                  {section.content}
                </HeadingTag>
              );

            case 'code':
              return (
                <div key={index} className="relative">
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-200 dark:bg-gray-700 border-b">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {section.language || 'Code'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2"
                        onClick={() => {
                          navigator.clipboard.writeText(section.content);
                          toast({ description: "Code copied to clipboard!" });
                        }}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                    <pre className="p-3 text-sm overflow-x-auto">
                      <code className="text-gray-800 dark:text-gray-200">
                        {section.content}
                      </code>
                    </pre>
                  </div>
                </div>
              );

            case 'list':
              return (
                <ul key={index} className="space-y-1 ml-4">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0" />
                      <span className="text-sm leading-relaxed">
                        {renderWithLinks(item)}
                      </span>
                    </li>
                  ))}
                </ul>
              );

            case 'numbered-list':
              return (
                <ol key={index} className="space-y-1 ml-4">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium flex items-center justify-center mt-0.5">
                        {itemIndex + 1}
                      </span>
                      <span className="text-sm leading-relaxed">
                        {renderWithLinks(item)}
                      </span>
                    </li>
                  ))}
                </ol>
              );

            default:
              if (!section.content || !section.content.trim()) return null;
              return (
                <div key={index} className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {renderWithLinks(section.content)}
                </div>
              );
          }
        })}
      </div>
    );
  };

  const copyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      toast({ description: "Message copied to clipboard!" });
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      toast({ description: "Failed to copy message", variant: "destructive" });
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
  
    try {
      if (answerFromAttachments) {
        console.log("RAG mode enabled");
        const token = localStorage.getItem('auth_token');
        
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
  
        const sources = Array.isArray(data.sources)
          ? data.sources
              .filter(s => s?.url)
              .map((s: any, i: number) => `[${i + 1}] ${s.url}`)
              .join("  ")
          : "";
  
        const final = sources
          ? `${data.answer || "No answer"}\n\n## Sources\n${sources}`
          : (data.answer || "No relevant information found.");
  
        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          content: final,
          sender: "bot",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
      } else {
        const response = await apiService.chatMessage({
          message: userMessage.content,
        });
        const botMessage: ChatMessage = {
          id: `bot-${Date.now()}`,
          content: response.reply,
          sender: "bot",
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMessage]);
      }
    } catch (e: any) {
      console.error("Chat error:", e);
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        content: `## Error\n${e?.message || "Failed to process request"}`,
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
    <div className="h-full flex flex-col max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          IT Support Assistant
        </h1>
        <p className="text-muted-foreground mt-2">
          Get instant help with intelligent responses and ticket management
        </p>
      </div>

      <Card className="flex-1 flex flex-col border-0 shadow-xl bg-white dark:bg-gray-950">
        <CardHeader className="border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">IT Support Assistant</div>
              <div className="text-sm text-muted-foreground font-normal">
                Powered by AI • Always learning
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Online
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 max-h-[65vh] bg-gradient-to-b from-gray-50/30 to-white dark:from-gray-900/30 dark:to-gray-950">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`group flex gap-4 ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.sender === "bot" && (
                  <div className="flex-shrink-0">
                    <Avatar className="w-10 h-10 shadow-md">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        <Bot className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}

                <div
                  className={`relative max-w-[80%] ${
                    message.sender === "user"
                      ? "ml-auto"
                      : ""
                  }`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 shadow-sm ${
                      message.sender === "user"
                        ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                        : "bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                    }`}
                  >
                    {message.tickets ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-sm">Related Tickets</span>
                        </div>
                        {message.tickets.map((ticket: any, idx: number) => (
                          <div key={ticket.id || idx} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <a
                              href={`/dashboard/tickets/${ticket.id}`}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline font-medium transition-colors"
                            >
                              {ticket.text}
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      renderMessageContent(message)
                    )}

                    {message.ticketId && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/30">
                          <Ticket className="w-3 h-3 mr-1" />
                          Ticket: {message.ticketId}
                        </Badge>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-3 pt-2">
                      <div className="flex items-center gap-1 text-xs opacity-70">
                        <Clock className="w-3 h-3" />
                        {message.timestamp.toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>

                      {message.sender === "bot" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2"
                          onClick={() => copyMessage(message.content, message.id)}
                        >
                          {copiedMessageId === message.id ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {message.sender === "user" && (
                  <div className="flex-shrink-0">
                    <Avatar className="w-10 h-10 shadow-md">
                      <AvatarFallback className="bg-gradient-to-br from-gray-600 to-gray-800 text-white">
                        <User className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-4 justify-start">
                <Avatar className="w-10 h-10 shadow-md">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    <Bot className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Processing your request...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 p-4 bg-white dark:bg-gray-950">
            <div className="flex gap-3 mb-3">
              <div className="flex-1 relative">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe your IT issue or ask for help..."
                  className="pr-12 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                  <Button
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isLoading}
                    size="sm"
                    className="h-8 w-8 p-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Button
                variant={answerFromAttachments ? "default" : "outline"}
                size="sm"
                className={`shrink-0 transition-all duration-200 ${
                  answerFromAttachments 
                    ? "bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white shadow-md" 
                    : "hover:bg-gray-50 dark:hover:bg-gray-800"
                }`}
                onClick={() => setAnswerFromAttachments(v => !v)}
                disabled={isLoading}
                title="When enabled, the assistant will answer using ticket attachments"
              >
                <Ticket className="h-4 w-4 mr-2" />
                Attachments
                {answerFromAttachments && (
                  <Badge className="ml-2 bg-white/20 text-white text-xs">ON</Badge>
                )}
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { text: "Password Reset", prompt: "I need to reset my password" },
                { text: "Software Help", prompt: "I need help installing software" },
                { text: "Network Issues", prompt: "I'm having network connectivity issues" },
                { text: "Hardware Problem", prompt: "I'm experiencing hardware issues" }
              ].map((suggestion) => (
                <Button
                  key={suggestion.text}
                  variant="ghost"
                  size="sm"
                  onClick={() => setInput(suggestion.prompt)}
                  disabled={isLoading}
                  className="text-xs h-7 px-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {suggestion.text}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}