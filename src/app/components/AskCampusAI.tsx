import { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  Sparkles,
  BookOpen,
  User,
  Quote,
  Layers,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Copy,
  Check,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { apiService, type CitedPaper } from "../services/api.service";
import { PublicationInspectorDrawer, type InspectedPublication } from "./PublicationInspectorDrawer";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  citedPapers?: CitedPaper[];
  timestamp: string;
}

const SUGGESTED_QUESTIONS = [
  "How many research publications and faculty profiles are currently tracked in our system?",
  "How does the system prevent saving duplicate research papers from Google Scholar?",
  "How are NBC 461 points and journal indexing status evaluated in this system?",
  "What are our campus research clusters and how do they address UN SDG 4 (Quality Education)?",
  "What does the study on predicting college students' academic performance using machine learning talk about?",
  "What are the key clinical findings and purpose of the paper on operative management of acetabular fractures?",
];

export function AskCampusAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Hello! I am your **PSU Asingan Campus Research Intelligence Assistant**. I am dedicated to helping you explore our research tracking system, examine faculty publications, and navigate institutional metrics.\n\n**Institutional Areas Covered:**\n• **System Status & Metrics:** Real-time publication counts, registered faculty, and citation tracking\n• **System Capabilities:** Google Scholar imports, duplicate prevention guard, UN SDG radar, and NBC 461 audits\n• **Campus Researches & Purposes:** University research clusters, community impacts, and sustainable development alignment\n• **Individual Paper Breakdowns:** Summaries of specific campus publications, methods, authors, and clinical/educational findings\n\n*Note: I strictly maintain institutional boundaries and do not answer personal or off-topic questions.* Select a suggested inquiry below or ask a specific question to begin.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState<InspectedPublication | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isAsking]);

  const handleSend = async (queryToSend?: string) => {
    const q = (queryToSend || inputQuery).trim();
    if (!q || isAsking) return;

    setInputQuery("");

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsAsking(true);

    try {
      const recentHistory = messages.slice(-6).map((m) => ({
        sender: m.sender,
        text: m.text,
      }));
      const response = await apiService.askCampusAI(q, recentHistory);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: response.answer,
        citedPapers: response.citedPapers || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      toast.error(`Assistant error: ${err.message}`);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "ai",
        text: "I encountered an issue connecting to the campus intelligence repository. Please make sure publications are stored in the system and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAsking(false);
    }
  };

  const copyAnswer = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied synthesis to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto flex flex-col h-[calc(100vh-6rem)]">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-4 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Ask Campus Research Intelligence
              <Badge variant="outline" className="text-[10px] font-mono border-purple-300 text-purple-600">
                RAG Engine
              </Badge>
            </h1>
            <p className="text-xs text-muted-foreground">
              Conversational synthesis grounded strictly in verified PSU Asingan publications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-semibold">Gemini Flash Connected</span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 mb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.sender === "ai" && (
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Bot className="h-4 w-4" />
              </div>
            )}

            <div className={`space-y-3 max-w-2xl ${msg.sender === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-blue-600 text-white rounded-tr-none shadow-md"
                    : "bg-white dark:bg-card border border-border/70 text-foreground shadow-xs rounded-tl-none"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {msg.sender === "ai" && msg.id !== "welcome" && (
                  <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{msg.timestamp}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyAnswer(msg.text, msg.id)}
                      className="h-6 px-2 text-[11px] gap-1 hover:text-foreground"
                    >
                      {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      Copy Response
                    </Button>
                  </div>
                )}
              </div>

              {/* Cited Papers Cards */}
              {msg.citedPapers && msg.citedPapers.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-purple-600" />
                    Cited Campus Research Papers ({msg.citedPapers.length})
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {msg.citedPapers.map((paper) => (
                      <div
                        key={paper.id}
                        onClick={() =>
                          setSelectedPaper({
                            id: paper.id,
                            title: paper.title,
                            authors: paper.authors,
                            year: paper.year,
                            citations: 0,
                            journal: paper.journal,
                          })
                        }
                        className="p-3 rounded-xl border border-border/60 bg-white dark:bg-card hover:border-purple-400 transition-all cursor-pointer flex items-center justify-between gap-3 text-xs shadow-2xs group"
                      >
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-purple-600 border-purple-300">
                              Ref {paper.refId}
                            </Badge>
                            <span className="font-semibold text-foreground truncate group-hover:text-purple-600">
                              {paper.title}
                            </span>
                          </div>
                          <p className="text-muted-foreground text-[11px] truncate">
                            {Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors} ({paper.year})
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {msg.sender === "user" && (
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {isAsking && (
          <div className="flex gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-card border border-border/70 text-sm flex items-center gap-2.5 text-muted-foreground">
              <Sparkles className="h-4 w-4 text-purple-600 animate-spin" />
              <span>Synthesizing campus publications with Gemini Flash...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions Pills */}
      {messages.length <= 2 && (
        <div className="mb-3 space-y-1.5 shrink-0">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <HelpCircle className="h-3 w-3" /> Suggested inquiries:
          </p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {SUGGESTED_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-muted/40 hover:bg-purple-50 dark:hover:bg-purple-950/30 hover:text-purple-600 border border-border/60 hover:border-purple-300 transition-all shrink-0 text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Box */}
      <div className="relative shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-white dark:bg-card p-2 rounded-2xl border border-border shadow-sm focus-within:ring-2 focus-within:ring-purple-500/20 focus-within:border-purple-500 transition-all"
        >
          <Input
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask about PSU Asingan research, faculty findings, or topic synthesis..."
            disabled={isAsking}
            className="border-0 shadow-none focus-visible:ring-0 text-sm h-10 px-3"
          />
          <Button
            type="submit"
            disabled={!inputQuery.trim() || isAsking}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-10 px-4 gap-1.5 shrink-0"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Ask AI</span>
          </Button>
        </form>
      </div>

      {/* Drawer */}
      <PublicationInspectorDrawer
        publication={selectedPaper}
        isOpen={Boolean(selectedPaper)}
        onClose={() => setSelectedPaper(null)}
      />
    </div>
  );
}
