import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  MessageSquare,
  X,
  Minus,
  Sparkles,
  Send,
  RefreshCw,
  BookOpen,
  HelpCircle,
  Shield,
  FileText,
  ExternalLink,
  ChevronRight,
  Info,
  Quote,
  History,
  Plus,
  Trash2,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { apiService, type CitedPaper, type AIChatMessage, type AIChatSession } from "../services/api.service";
import { PublicationInspectorDrawer, type InspectedPublication } from "./PublicationInspectorDrawer";
import {
  fetchAndSyncChatSessions,
  persistChatSession,
  deleteChatSession,
  getLocalChatSessions,
} from "../utils/aiChatHistoryStore";
import { FormattedChatMessage } from "./common";
import mascotImg from "../assets/mascot-ai.png";
import { toast } from "sonner";

interface SpecificPrompt {
  id: string;
  category: "System Activity" | "System Features" | "Research Purposes" | "Specific Research";
  badge: string;
  badgeColor: string;
  statement: string;
}

const SPECIFIC_SUGGESTIONS: SpecificPrompt[] = [
  {
    id: "sys-stats",
    category: "System Activity",
    badge: "Repository Status",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    statement: "How many research publications and faculty profiles are currently tracked in our system?",
  },
  {
    id: "sys-dedup",
    category: "System Features",
    badge: "Deduplication Guard",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    statement: "How does the system prevent saving duplicate research papers from Google Scholar?",
  },
  {
    id: "sys-nbc461",
    category: "System Features",
    badge: "NBC 461 & Indexing",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    statement: "How are NBC 461 points and journal indexing status evaluated in this system?",
  },
  {
    id: "res-sdg4",
    category: "Research Purposes",
    badge: "SDG 4 Education",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    statement: "What are our campus research clusters and how do they address UN SDG 4 (Quality Education)?",
  },
  {
    id: "paper-ml",
    category: "Specific Research",
    badge: "Student Analytics AI",
    badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800",
    statement: "What does the study on predicting college students' academic performance using machine learning talk about?",
  },
  {
    id: "paper-ortho",
    category: "Specific Research",
    badge: "Clinical Surgery Study",
    badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800",
    statement: "What are the key clinical findings and purpose of the paper on operative management of acetabular fractures?",
  },
];

export function FloatingAskAIBubble() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "history">("chat");

  // Session state
  const [sessionId, setSessionId] = useState<string>(() => `session-${Date.now()}`);
  const [sessionTitle, setSessionTitle] = useState<string>("New Conversation");
  const [sessionCreatedAt, setSessionCreatedAt] = useState<string>(() => new Date().toISOString());

  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPublication, setSelectedPublication] = useState<InspectedPublication | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const [isTooltipDismissed, setIsTooltipDismissed] = useState(false);

  // History sessions list
  const [historySessions, setHistorySessions] = useState<AIChatSession[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages in chat tab
  useEffect(() => {
    if (isOpen && activeTab === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading, activeTab]);

  // Load history list on mount and whenever bubble is opened or history tab clicked
  const refreshHistory = async () => {
    const list = await fetchAndSyncChatSessions();
    setHistorySessions(list);
  };

  useEffect(() => {
    refreshHistory();

    const handleUpdate = () => {
      setHistorySessions(getLocalChatSessions());
    };
    window.addEventListener("campus-ai-history-updated", handleUpdate);
    return () => window.removeEventListener("campus-ai-history-updated", handleUpdate);
  }, []);

  // Listen for custom open events (e.g. from CommandPalette)
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setActiveTab("chat");
      setHasUnread(false);
    };
    window.addEventListener("open-ask-ai-bubble", handleOpen);
    return () => window.removeEventListener("open-ask-ai-bubble", handleOpen);
  }, []);

  // Listen for preset questions
  useEffect(() => {
    const handlePreset = (e: any) => {
      const text = e.detail?.text;
      if (text) {
        setIsOpen(true);
        setActiveTab("chat");
        handleSendMessage(text);
      }
    };
    window.addEventListener("ask-campus-ai-preset", handlePreset);
    return () => window.removeEventListener("ask-campus-ai-preset", handlePreset);
  }, [sessionId, sessionTitle, messages]);

  // Listen for resume session events from history page
  useEffect(() => {
    const handleLoadSession = (e: any) => {
      const session = e.detail?.session as AIChatSession;
      if (session) {
        setSessionId(session.id);
        setSessionTitle(session.title);
        setSessionCreatedAt(session.createdAt);
        setMessages(session.messages || []);
        setActiveTab("chat");
        setIsOpen(true);
        setHasUnread(false);
      }
    };
    window.addEventListener("load-campus-ai-session", handleLoadSession);
    return () => window.removeEventListener("load-campus-ai-session", handleLoadSession);
  }, []);

  // Start fresh conversation
  const handleStartNewChat = () => {
    const newId = `session-${Date.now()}`;
    setSessionId(newId);
    setSessionTitle("New Conversation");
    setSessionCreatedAt(new Date().toISOString());
    setMessages([]);
    setActiveTab("chat");
    setInputQuery("");
  };

  // Resume a session from in-bubble history
  const handleSelectHistorySession = (s: AIChatSession) => {
    setSessionId(s.id);
    setSessionTitle(s.title);
    setSessionCreatedAt(s.createdAt);
    setMessages(s.messages || []);
    setActiveTab("chat");
  };

  // Delete a session from in-bubble history
  const handleDeleteHistorySession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteChatSession(id);
    setHistorySessions((prev) => prev.filter((s) => s.id !== id));
    if (sessionId === id) {
      handleStartNewChat();
    }
    toast.success("Conversation removed");
  };

  const handleSendMessage = async (textToSend?: string) => {
    const q = (textToSend || inputQuery).trim();
    if (!q || isLoading) return;

    const userMsg: AIChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputQuery("");
    setIsLoading(true);

    const effectiveTitle =
      sessionTitle === "New Conversation" || !sessionTitle
        ? q.length > 42
          ? q.slice(0, 42) + "..."
          : q
        : sessionTitle;
    setSessionTitle(effectiveTitle);

    // Save user message immediately to session storage
    persistChatSession({
      id: sessionId,
      title: effectiveTitle,
      createdAt: sessionCreatedAt,
      updatedAt: new Date().toISOString(),
      messages: newMessages,
    });

    try {
      const recentHistory = messages.slice(-6).map((m) => ({
        sender: m.sender,
        text: m.text,
      }));
      const res = await apiService.askCampusIntelligence(q, recentHistory);
      const isRefusal = res.source === "guardrail" || res.answer.includes("cannot answer personal questions");

      const aiMsg: AIChatMessage = {
        id: `ai-${Date.now()}`,
        sender: "ai",
        text: res.answer,
        citedPapers: res.citedPapers || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isGuardrailRefusal: isRefusal,
      };

      const finalMessages = [...newMessages, aiMsg];
      setMessages(finalMessages);

      // Persist complete exchange
      persistChatSession({
        id: sessionId,
        title: effectiveTitle,
        createdAt: sessionCreatedAt,
        updatedAt: new Date().toISOString(),
        messages: finalMessages,
      });

      if (!isOpen) {
        setHasUnread(true);
      }
    } catch (err: any) {
      const errorMsg: AIChatMessage = {
        id: `ai-err-${Date.now()}`,
        sender: "ai",
        text: "I encountered an error contacting the campus intelligence service. Please check your network or try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      const finalMessages = [...newMessages, errorMsg];
      setMessages(finalMessages);

      persistChatSession({
        id: sessionId,
        title: effectiveTitle,
        createdAt: sessionCreatedAt,
        updatedAt: new Date().toISOString(),
        messages: finalMessages,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInspectCited = (paper: CitedPaper) => {
    setSelectedPublication({
      id: paper.id,
      title: paper.title,
      authors: paper.authors,
      journal: paper.journal,
      year: paper.year,
      citations: 0,
    });
  };

  return (
    <>
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* FLOATING ACTION BUBBLE TRIGGER                                            */}
      {/* ========================================================================= */}
      <div className="fixed bottom-20 right-3.5 sm:bottom-6 sm:right-6 z-40 flex items-center gap-3 select-none">
        {/* Subtle Welcome Tooltip Pill (if closed and not dismissed) */}
        {!isOpen && !isTooltipDismissed && (
          <div className="hidden sm:flex items-center gap-2 bg-background/95 dark:bg-card/95 border border-border shadow-xl rounded-full pl-3 pr-2 py-1.5 backdrop-blur-md animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-foreground">
              Need help? Ask Campus AI
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsTooltipDismissed(true);
              }}
              className="text-muted-foreground hover:text-foreground text-[11px] p-1 rounded-full"
              title="Dismiss prompt"
            >
              ✕
            </button>
          </div>
        )}

        {/* Mascot Floating Bubble Button */}
        <button
          onClick={() => {
            setIsOpen((prev) => !prev);
            setHasUnread(false);
            setIsTooltipDismissed(true);
            if (!isOpen) {
              refreshHistory();
            }
          }}
          className={`relative group rounded-full transition-all duration-300 transform active:scale-95 focus:outline-hidden ${
            isOpen
              ? "ring-4 ring-emerald-500/40 shadow-2xl scale-95"
              : "hover:scale-105 shadow-xl hover:shadow-2xl ring-2 ring-emerald-500/30 hover:ring-emerald-500/60"
          }`}
          aria-label="Open Ask Campus AI assistant"
        >
          {/* Animated Glow Halo */}
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-blue-500 opacity-40 blur-sm group-hover:opacity-75 transition duration-500 group-hover:duration-200 animate-pulse" />

          {/* Circular Mascot Avatar Container */}
          <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden bg-slate-900 border-2 border-white/80 dark:border-slate-800 shadow-inner flex items-center justify-center">
            <img
              src={mascotImg}
              alt="PSU Campus AI Mascot"
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          </div>

          {/* Active / Unread Notification Dot */}
          <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-emerald-500 border-2 border-background rounded-full flex items-center justify-center shadow-xs">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
          </span>

          {/* Unread Message Pill */}
          {hasUnread && !isOpen && (
            <span className="absolute -top-1 -left-1 px-1.5 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-full border border-background shadow-md">
              1
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* FLOATING CHAT WINDOW MODAL                                                */}
      {/* ========================================================================= */}
      {isOpen && (
        <div className="fixed inset-x-2 sm:inset-x-auto bottom-20 sm:bottom-24 sm:right-6 z-50 w-auto sm:w-[430px] md:w-[450px] h-[76vh] sm:h-[590px] max-h-[82vh] bg-background/95 dark:bg-card/95 border border-border/80 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Chat Window Header */}
          <div className="p-3 px-4 bg-muted/40 border-b border-border/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative w-8 h-8 rounded-full overflow-hidden border border-emerald-500/50 bg-slate-900 shadow-xs shrink-0">
                <img
                  src={mascotImg}
                  alt="Mascot"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-foreground truncate">
                    {activeTab === "history" ? "Chat History" : "Ask Campus AI"}
                  </h3>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
                    Flash
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">
                  {activeTab === "history"
                    ? `${historySessions.length} saved conversations`
                    : sessionTitle}
                </p>
              </div>
            </div>

            {/* Header Control Buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {/* New Conversation Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleStartNewChat}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Start new conversation"
              >
                <Plus className="h-4 w-4" />
              </Button>

              {/* Toggle History View Button */}
              <Button
                variant={activeTab === "history" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => {
                  const next = activeTab === "history" ? "chat" : "history";
                  setActiveTab(next);
                  if (next === "history") refreshHistory();
                }}
                className="h-7 w-7 relative text-muted-foreground hover:text-foreground"
                title="View chat history"
              >
                <History className="h-3.5 w-3.5" />
                {historySessions.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 px-1 py-0 text-[8px] font-bold bg-emerald-500 text-white rounded-full">
                    {historySessions.length > 9 ? "9+" : historySessions.length}
                  </span>
                )}
              </Button>

              {/* Open Dedicated Chat History Page */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsOpen(false);
                  navigate("/dashboard/ai-history");
                }}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Open full history page"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>

              {/* Minimize Assistant */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                title="Minimize assistant"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* =================================================================== */}
          {/* TAB 1: IN-BUBBLE CHAT HISTORY LIST                                  */}
          {/* =================================================================== */}
          {activeTab === "history" ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-background/50">
              {/* History Subheader */}
              <div className="p-3 border-b border-border/60 bg-muted/20 flex items-center justify-between text-xs">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab("chat")}
                  className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Chat</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsOpen(false);
                    navigate("/dashboard/ai-history");
                  }}
                  className="h-7 px-2 gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Full History Hub</span>
                </Button>
              </div>

              {/* Session list items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {historySessions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground space-y-3">
                    <History className="w-8 h-8 mx-auto opacity-30 text-emerald-600" />
                    <div>
                      <p className="font-semibold text-foreground">No chat history yet</p>
                      <p className="text-[11px] mt-1">
                        Inquiries you ask Campus AI will be saved here automatically.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleStartNewChat}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                    >
                      Start First Inquiry
                    </Button>
                  </div>
                ) : (
                  historySessions.map((s) => {
                    const isActive = s.id === sessionId;
                    const citationsCount = s.messages.reduce(
                      (sum, m) => sum + (m.citedPapers?.length || 0),
                      0
                    );

                    return (
                      <div
                        key={s.id}
                        onClick={() => handleSelectHistorySession(s)}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all flex flex-col gap-1.5 relative group ${
                          isActive
                            ? "bg-emerald-500/10 border-emerald-500/50 shadow-xs ring-1 ring-emerald-500/30"
                            : "bg-card border-border/70 hover:bg-muted/40 hover:border-emerald-500/30"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-xs text-foreground truncate max-w-[240px]">
                            {s.title}
                          </span>
                          <button
                            onClick={(e) => handleDeleteHistorySession(e, s.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-opacity"
                            title="Delete session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                          <span>
                            {new Date(s.updatedAt || s.createdAt).toLocaleDateString([], {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            •{" "}
                            {new Date(s.updatedAt || s.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span>{s.messages.length} msgs</span>
                            {citationsCount > 0 && (
                              <span className="text-purple-600 dark:text-purple-400 font-semibold">
                                • {citationsCount} refs
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* =================================================================== */
            /* TAB 2: ACTIVE CONVERSATION MESSAGES SCROLL AREA                     */
            /* =================================================================== */
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                
                {/* Initial Welcome & Scope Guardrail Banner */}
                {messages.length === 0 && (
                  <div className="space-y-4 py-2">
                    <div className="text-center space-y-2 p-4 rounded-xl bg-muted/20 border border-border/60">
                      <div className="w-12 h-12 mx-auto rounded-full overflow-hidden border-2 border-emerald-500/30 shadow-xs">
                        <img src={mascotImg} alt="Mascot" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-sm">Welcome to Campus AI!</h4>
                        <p className="text-[11px] text-muted-foreground mt-1 max-w-[320px] mx-auto leading-relaxed">
                          Your dedicated intelligence assistant for the PSU Asingan Research Publication Tracking System.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-border/50 text-[11px] text-left space-y-1 text-muted-foreground">
                        <p className="font-semibold text-foreground flex items-center gap-1">
                          <Shield className="w-3 h-3 text-emerald-600" />
                          Strict Scope & Supported Topics:
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                          <li><strong>System Activity:</strong> Real-time repository metrics, active faculty, recent imports</li>
                          <li><strong>System Features:</strong> Google Scholar claiming, deduplication guard, SDG matrix</li>
                          <li><strong>Research Purposes:</strong> Academic clusters, institutional impact, SDG alignment</li>
                          <li><strong>Specific Research:</strong> Paper summaries, methodology, authors, citations</li>
                        </ul>
                      </div>
                    </div>

                    {/* Quick Suggestion Pills */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                        Suggested Specific Inquiries:
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {SPECIFIC_SUGGESTIONS.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => handleSendMessage(p.statement)}
                            className="text-left p-2.5 rounded-xl border border-border/70 bg-card hover:bg-muted/40 hover:border-emerald-500/50 transition-all flex flex-col gap-1.5 group text-xs shadow-2xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] px-2 py-0.5 font-semibold rounded-md border ${p.badgeColor}`}>
                                {p.badge}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-emerald-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
                            </div>
                            <span className="font-medium text-foreground group-hover:text-emerald-600 leading-snug">
                              "{p.statement}"
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Conversation Messages */}
                {messages.map((msg) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <div className="w-6 h-6 rounded-full overflow-hidden border border-emerald-500/40 bg-slate-900 shrink-0 mt-0.5">
                          <img src={mascotImg} alt="AI" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className={`space-y-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed ${
                            isUser
                              ? "bg-brand text-white rounded-tr-xs shadow-xs"
                              : msg.isGuardrailRefusal
                              ? "bg-warning-soft border border-warning-border text-warning-foreground rounded-tl-xs"
                              : "bg-card border border-border/70 text-foreground rounded-tl-xs shadow-2xs"
                          }`}
                        >
                          <FormattedChatMessage text={msg.text} isUser={isUser} />
                        </div>

                        {/* Cited Papers Pills (Academic Grounding) */}
                        {msg.citedPapers && msg.citedPapers.length > 0 && (
                          <div className="p-2.5 rounded-xl border border-border/60 bg-background/60 space-y-1.5">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-emerald-600" />
                              Cited Research Evidence ({msg.citedPapers.length}):
                            </p>
                            <div className="space-y-1">
                              {msg.citedPapers.map((paper) => (
                                <button
                                  key={paper.id}
                                  onClick={() => handleInspectCited(paper)}
                                  className="w-full text-left p-1.5 rounded-md hover:bg-muted/50 border border-transparent hover:border-border flex items-center justify-between text-[11px] group transition-colors"
                                >
                                  <span className="truncate text-foreground group-hover:text-emerald-600 font-medium">
                                    [Ref {paper.refId}] {paper.title} ({paper.year})
                                  </span>
                                  <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 ml-1.5 opacity-60 group-hover:opacity-100" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <span className="text-[10px] text-muted-foreground px-1 block">
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Loading Indicator */}
                {isLoading && (
                  <div className="flex gap-2.5 items-center text-xs text-muted-foreground">
                    <div className="w-6 h-6 rounded-full overflow-hidden border border-emerald-500/40 bg-slate-900 shrink-0">
                      <img src={mascotImg} alt="AI" className="w-full h-full object-cover animate-pulse" />
                    </div>
                    <div className="p-3 rounded-2xl rounded-tl-xs bg-muted/40 border border-border/60 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                      <span>Synthesizing campus intelligence...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Filter / Question Pills (when messages exist) */}
              {messages.length > 0 && (
                <div className="px-3 py-1.5 bg-muted/10 border-t border-border/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[10px]">
                  <span className="text-muted-foreground shrink-0">Quick ask:</span>
                  <button
                    onClick={() => handleSendMessage("How many research publications and faculty profiles are currently tracked in our system?")}
                    className="px-2.5 py-0.5 rounded-full border border-border bg-card hover:bg-muted/60 shrink-0 text-foreground transition-all hover:border-emerald-500/50"
                  >
                    📊 Status
                  </button>
                  <button
                    onClick={() => handleSendMessage("How does the system prevent saving duplicate research papers from Google Scholar?")}
                    className="px-2.5 py-0.5 rounded-full border border-border bg-card hover:bg-muted/60 shrink-0 text-foreground transition-all hover:border-emerald-500/50"
                  >
                    🛡️ Deduplication
                  </button>
                  <button
                    onClick={() => handleSendMessage("What does the study on predicting college students' academic performance using machine learning talk about?")}
                    className="px-2.5 py-0.5 rounded-full border border-border bg-card hover:bg-muted/60 shrink-0 text-foreground transition-all hover:border-emerald-500/50"
                  >
                    🤖 ML Paper
                  </button>
                  <button
                    onClick={() => handleSendMessage("What are the key clinical findings and purpose of the paper on operative management of acetabular fractures?")}
                    className="px-2.5 py-0.5 rounded-full border border-border bg-card hover:bg-muted/60 shrink-0 text-foreground transition-all hover:border-emerald-500/50"
                  >
                    🩺 Surgery Study
                  </button>
                </div>
              )}

              {/* Chat Input Footer */}
              <div className="p-3 border-t border-border/70 bg-background/90">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <Input
                    placeholder="Ask about system status, features, or research..."
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    disabled={isLoading}
                    className="h-9 text-xs pl-3 pr-2"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isLoading || !inputQuery.trim()}
                    className="h-9 w-9 p-0 bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 px-1">
                  <span className="truncate">Grounded in verified PSU Asingan research records</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 shrink-0">PSU AI</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Cited Publication Inspector Drawer */}
      <PublicationInspectorDrawer
        publication={selectedPublication}
        isOpen={Boolean(selectedPublication)}
        onClose={() => setSelectedPublication(null)}
      />
    </>
  );
}
