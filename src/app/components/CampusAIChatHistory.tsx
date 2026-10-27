import { useState, useEffect, useMemo } from "react";
import {
  Bot,
  Search,
  Trash2,
  ExternalLink,
  MessageSquare,
  Clock,
  Sparkles,
  BookOpen,
  Copy,
  Check,
  Download,
  ArrowRight,
  Shield,
  Send,
  RefreshCw,
  Plus,
  HelpCircle,
  FileText,
  ChevronLeft,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { ConfirmModal } from "./ConfirmModal";
import { PublicationInspectorDrawer, type InspectedPublication } from "./PublicationInspectorDrawer";
import {
  fetchAndSyncChatSessions,
  deleteChatSession,
  clearAllChatSessions,
  getLocalChatSessions,
} from "../utils/aiChatHistoryStore";
import { type AIChatSession, type AIChatMessage, type CitedPaper } from "../services/api.service";
import { FormattedChatMessage } from "./common";
import { toast } from "sonner";
import mascotImg from "../assets/mascot-ai.png";

export function CampusAIChatHistory() {
  const [sessions, setSessions] = useState<AIChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [inspectedPublication, setInspectedPublication] = useState<InspectedPublication | null>(null);

  // Load sessions on mount & listen for live updates
  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const data = await fetchAndSyncChatSessions();
      setSessions(data);
      if (data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();

    const handleUpdate = () => {
      const updated = getLocalChatSessions();
      setSessions(updated);
    };

    window.addEventListener("campus-ai-history-updated", handleUpdate);
    return () => window.removeEventListener("campus-ai-history-updated", handleUpdate);
  }, []);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;

    return sessions.filter((s) => {
      if (s.title.toLowerCase().includes(q)) return true;
      return s.messages.some(
        (m) =>
          m.text.toLowerCase().includes(q) ||
          m.citedPapers?.some((p) => p.title.toLowerCase().includes(q))
      );
    });
  }, [sessions, searchQuery]);

  // Selected session object
  const selectedSession = useMemo(() => {
    return sessions.find((s) => s.id === selectedSessionId) || filteredSessions[0] || null;
  }, [sessions, selectedSessionId, filteredSessions]);

  // Date grouping for sessions
  const groupedSessions = useMemo(() => {
    const groups: { label: string; items: AIChatSession[] }[] = [
      { label: "Today", items: [] },
      { label: "Yesterday", items: [] },
      { label: "Previous 7 Days", items: [] },
      { label: "Older", items: [] },
    ];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const sevenDaysAgo = today - 7 * 86400000;

    for (const s of filteredSessions) {
      const t = new Date(s.updatedAt || s.createdAt).getTime();
      if (t >= today) {
        groups[0].items.push(s);
      } else if (t >= yesterday) {
        groups[1].items.push(s);
      } else if (t >= sevenDaysAgo) {
        groups[2].items.push(s);
      } else {
        groups[3].items.push(s);
      }
    }

    return groups.filter((g) => g.items.length > 0);
  }, [filteredSessions]);

  // Delete a single session
  const handleDeleteSession = async (sessionId: string) => {
    await deleteChatSession(sessionId);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (selectedSessionId === sessionId) {
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSelectedSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
    toast.success("Conversation removed from history");
    setSessionToDelete(null);
  };

  // Clear all
  const handleClearAll = async () => {
    await clearAllChatSessions();
    setSessions([]);
    setSelectedSessionId(null);
    setShowClearConfirm(false);
    toast.success("Chat history cleared");
  };

  // Open in floating bubble
  const handleContinueInBubble = (session: AIChatSession) => {
    window.dispatchEvent(new CustomEvent("load-campus-ai-session", { detail: { session } }));
    toast.info("Resumed in Campus AI bubble (bottom right)");
  };

  // Start fresh question in bubble
  const handleNewQuestionInBubble = (presetQuestion?: string) => {
    window.dispatchEvent(new CustomEvent("open-ask-ai-bubble"));
    if (presetQuestion) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("ask-campus-ai-preset", { detail: { text: presetQuestion } }));
      }, 200);
    }
  };

  // Copy full transcript
  const handleCopyTranscript = (session: AIChatSession) => {
    const formatted = session.messages
      .map((m) => {
        const role = m.sender === "user" ? "USER" : "CAMPUS AI";
        let citationsText = "";
        if (m.citedPapers && m.citedPapers.length > 0) {
          citationsText =
            "\n\nCited Evidence:\n" +
            m.citedPapers.map((p) => `- [Ref ${p.refId}] ${p.title} (${p.year})`).join("\n");
        }
        return `[${m.timestamp}] ${role}:\n${m.text}${citationsText}`;
      })
      .join("\n\n---\n\n");

    navigator.clipboard.writeText(`### ${session.title}\n\n${formatted}`);
    setCopiedId(session.id);
    toast.success("Transcript copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Export as Markdown file
  const handleExportMarkdown = (session: AIChatSession) => {
    const content = `# Campus AI Inquiry: ${session.title}
*Date: ${new Date(session.createdAt).toLocaleDateString()}*

${session.messages
  .map((m) => {
    const speaker = m.sender === "user" ? "**User:**" : "**Campus AI:**";
    const cites =
      m.citedPapers && m.citedPapers.length > 0
        ? `\n\n*Cited Sources:*\n${m.citedPapers
            .map((p) => `- [${p.refId}] ${p.title} (${p.year}) - ${p.authors}`)
            .join("\n")}`
        : "";
    return `${speaker}\n${m.text}${cites}`;
  })
  .join("\n\n---\n\n")}
`;

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Campus-AI-${session.title.replace(/[^a-zA-Z0-9]/g, "-").slice(0, 30)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Exported conversation as Markdown");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ========================================================================= */}
      {/* HEADER & OVERVIEW BAR                                                     */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/70">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <img src={mascotImg} alt="Campus AI Mascot" className="w-9 h-9 object-cover rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Campus AI Chat History
              </h1>
              <Badge variant="outline" className="text-[11px] font-mono border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40">
                Gemini Flash
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Review, search, and resume your verified research inquiries and academic citations
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSessions}
            className="h-9 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            title="Refresh history"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {sessions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              className="h-9 gap-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear History</span>
            </Button>
          )}

          <Button
            onClick={() => handleNewQuestionInBubble()}
            className="h-9 gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>New Inquiry in Bubble</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN TWO-COLUMN MASTER-DETAIL LAYOUT                                      */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        
        {/* ----------------------------------------------------------------------- */}
        {/* LEFT COLUMN: CONVERSATION LIST (4 COLS)                                 */}
        {/* ----------------------------------------------------------------------- */}
        <div className={`lg:col-span-5 xl:col-span-4 flex flex-col gap-3 ${mobileView === "detail" ? "hidden lg:flex" : "flex"}`}>
          
          {/* Search Filter */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search inquiries or papers..."
              className="pl-9 h-9 text-xs bg-card"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-xs text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sessions Scrollable List */}
          <Card className="flex-1 bg-card border-border/70 overflow-hidden flex flex-col min-h-[480px]">
            <CardHeader className="p-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between space-y-0">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Past Conversations ({filteredSessions.length})
              </span>
              {searchQuery && (
                <span className="text-[11px] text-muted-foreground">
                  Filtered
                </span>
              )}
            </CardHeader>

            <div className="flex-1 overflow-y-auto p-2 space-y-4">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                  <RefreshCw className="w-5 h-5 mx-auto animate-spin text-emerald-600" />
                  <p>Loading history...</p>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-muted/40 flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 opacity-40" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">No conversations found</p>
                    <p className="text-[11px] mt-1">
                      {searchQuery
                        ? "Try searching with a different term"
                        : "Ask Campus AI a question via the bubble widget to create your first chat session."}
                    </p>
                  </div>
                </div>
              ) : (
                groupedSessions.map((group) => (
                  <div key={group.label} className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 pt-1">
                      {group.label}
                    </p>
                    <div className="space-y-1">
                      {group.items.map((s) => {
                        const isSelected = s.id === selectedSession?.id;
                        const firstUserMsg = s.messages.find((m) => m.sender === "user")?.text || s.title;
                        const citationsCount = s.messages.reduce(
                          (sum, m) => sum + (m.citedPapers?.length || 0),
                          0
                        );

                        return (
                          <div
                            key={s.id}
                            onClick={() => {
                              setSelectedSessionId(s.id);
                              setMobileView("detail");
                            }}
                            className={`p-3 rounded-xl border text-left cursor-pointer transition-all relative group flex flex-col gap-1.5 ${
                              isSelected
                                ? "bg-emerald-500/10 border-emerald-500/40 text-foreground shadow-xs ring-1 ring-emerald-500/30"
                                : "bg-card border-border/70 hover:bg-muted/40 hover:border-border text-foreground"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-xs truncate max-w-[200px]" title={s.title}>
                                {s.title}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSessionToDelete(s.id);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-opacity"
                                  title="Delete conversation"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="text-[11px] text-muted-foreground line-clamp-1 leading-snug">
                              {firstUserMsg}
                            </p>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40 mt-0.5">
                              <span>
                                {new Date(s.updatedAt || s.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 font-mono">
                                  <MessageSquare className="w-3 h-3" />
                                  {s.messages.length}
                                </span>
                                {citationsCount > 0 && (
                                  <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400 font-medium">
                                    <BookOpen className="w-3 h-3" />
                                    {citationsCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* RIGHT COLUMN: TRANSCRIPT READER (8 COLS)                                */}
        {/* ----------------------------------------------------------------------- */}
        <div className={`lg:col-span-7 xl:col-span-8 flex flex-col ${mobileView === "list" ? "hidden lg:flex" : "flex"}`}>
          {selectedSession ? (
            <Card className="flex-1 bg-card border-border/70 flex flex-col overflow-hidden shadow-2xs">
              
              {/* Transcript Toolbar Header */}
              <div className="p-3.5 sm:p-4 border-b border-border/70 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  {/* Mobile Back to List Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMobileView("list")}
                    className="lg:hidden h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1 -ml-1 mr-1"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>All Conversations</span>
                  </Button>

                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold text-foreground truncate" title={selectedSession.title}>
                      {selectedSession.title}
                    </h2>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                      {selectedSession.messages.length} msgs
                    </Badge>
                  </div>
                  <p className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    <span>Started {new Date(selectedSession.createdAt).toLocaleString()}</span>
                  </p>
                </div>

                {/* Session Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyTranscript(selectedSession)}
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    title="Copy markdown transcript"
                  >
                    {copiedId === selectedSession.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Copy</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportMarkdown(selectedSession)}
                    className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    title="Export as Markdown"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleContinueInBubble(selectedSession)}
                    className="h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-2xs"
                    title="Load conversation in Ask Campus AI bubble"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Continue in Bubble</span>
                  </Button>
                </div>
              </div>

              {/* Messages Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {selectedSession.messages.map((msg) => {
                  const isUser = msg.sender === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 sm:gap-4 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <div className="w-9 h-9 rounded-xl bg-slate-900 border border-emerald-500/40 overflow-hidden shrink-0 mt-0.5 shadow-xs">
                          <img src={mascotImg} alt="Campus AI" className="w-full h-full object-cover" />
                        </div>
                      )}

                      <div className={`space-y-3 max-w-2xl ${isUser ? "items-end" : "items-start"}`}>
                        <div
                          className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                            isUser
                              ? "bg-brand text-white rounded-tr-xs shadow-sm"
                              : msg.isGuardrailRefusal
                              ? "bg-warning-soft border border-warning-border text-warning-foreground rounded-tl-xs"
                              : "bg-card border border-border/80 text-foreground shadow-2xs rounded-tl-xs"
                          }`}
                        >
                          <FormattedChatMessage text={msg.text} isUser={isUser} />
                        </div>

                        {/* Cited Campus Research Papers */}
                        {msg.citedPapers && msg.citedPapers.length > 0 && (
                          <div className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-2">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-purple-600" />
                              Cited Campus Research Evidence ({msg.citedPapers.length}):
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                              {msg.citedPapers.map((paper) => (
                                <div
                                  key={paper.id}
                                  onClick={() =>
                                    setInspectedPublication({
                                      id: paper.id,
                                      title: paper.title,
                                      authors: paper.authors,
                                      year: paper.year,
                                      citations: 0,
                                      journal: paper.journal,
                                    })
                                  }
                                  className="p-2.5 rounded-lg border border-border/60 bg-card hover:border-emerald-500/50 hover:bg-muted/40 transition-all cursor-pointer flex items-center justify-between gap-3 text-xs shadow-2xs group"
                                >
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 text-purple-600 border-purple-300">
                                        Ref {paper.refId}
                                      </Badge>
                                      <span className="font-semibold text-foreground truncate group-hover:text-emerald-600">
                                        {paper.title}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground truncate">
                                      {Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors} ({paper.year})
                                    </p>
                                  </div>
                                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-emerald-600 shrink-0" />
                                </div>
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
              </div>

              {/* Bottom Quick Action Bar */}
              <div className="p-3 border-t border-border/60 bg-muted/10 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Grounded in PSU Asingan publications & verified system statistics
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleContinueInBubble(selectedSession)}
                  className="h-8 gap-1.5 text-emerald-600 hover:text-emerald-700 font-semibold"
                >
                  <span>Ask follow-up in bubble</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ) : (
            /* Empty State when no conversation is selected */
            <Card className="flex-1 bg-card border-border/70 flex flex-col items-center justify-center p-8 text-center min-h-[480px]">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-emerald-500/30 shadow-md mb-4">
                <img src={mascotImg} alt="Mascot" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-base font-bold text-foreground">Welcome to Campus AI History</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1 leading-relaxed">
                Select a past inquiry from the list on the left to read its full transcript and inspect cited research papers.
              </p>

              <div className="mt-6 pt-4 border-t border-border/60 w-full max-w-md text-left space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Suggested inquiries to ask Campus AI:
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => handleNewQuestionInBubble("How many research publications and faculty profiles are currently tracked in our system?")}
                    className="p-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-emerald-500/40 text-left text-xs transition-colors flex items-center justify-between group"
                  >
                    <span className="text-foreground group-hover:text-emerald-600">
                      📊 How many research publications and faculty profiles are tracked?
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-emerald-600 shrink-0" />
                  </button>

                  <button
                    onClick={() => handleNewQuestionInBubble("How does the system prevent saving duplicate research papers from Google Scholar?")}
                    className="p-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-emerald-500/40 text-left text-xs transition-colors flex items-center justify-between group"
                  >
                    <span className="text-foreground group-hover:text-emerald-600">
                      🛡️ How does the system prevent duplicate research papers?
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-emerald-600 shrink-0" />
                  </button>

                  <button
                    onClick={() => handleNewQuestionInBubble("What are our campus research clusters and how do they address UN SDG 4 (Quality Education)?")}
                    className="p-2.5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-emerald-500/40 text-left text-xs transition-colors flex items-center justify-between group"
                  >
                    <span className="text-foreground group-hover:text-emerald-600">
                      🎯 What are our campus research clusters and how do they address UN SDG 4?
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-emerald-600 shrink-0" />
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Confirmation Modal for Clearing History */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear All Campus AI History?"
        message="This will permanently delete all your saved conversations with Campus AI. This action cannot be undone."
        confirmText="Yes, Clear All"
        cancelText="Cancel"
        variant="danger"
        icon="trash"
        onConfirm={handleClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Confirmation Modal for Deleting Single Session */}
      <ConfirmModal
        isOpen={Boolean(sessionToDelete)}
        title="Delete Conversation?"
        message="Are you sure you want to delete this conversation from your history?"
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        icon="trash"
        onConfirm={() => sessionToDelete && handleDeleteSession(sessionToDelete)}
        onCancel={() => setSessionToDelete(null)}
      />

      {/* Cited Publication Inspector Drawer */}
      <PublicationInspectorDrawer
        publication={inspectedPublication}
        isOpen={Boolean(inspectedPublication)}
        onClose={() => setInspectedPublication(null)}
      />
    </div>
  );
}
