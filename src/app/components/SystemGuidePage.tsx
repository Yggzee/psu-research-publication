import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  HelpCircle,
  LayoutDashboard,
  Search,
  Users,
  FileText,
  TrendingUp,
  Target,
  FileBarChart,
  Sparkles,
  Shield,
  User,
  Settings,
  ArrowLeft,
  BookOpen,
  LogIn,
  Sun,
  Moon,
  CheckCircle2,
  MousePointerClick,
  Eye,
  Compass,
  Plus,
  RefreshCw,
  Save,
  Hand,
  Table,
  LayoutGrid,
  Copy,
  Download,
  Printer,
  Check,
  X,
  Edit3,
  Trash2,
  Send,
  ChevronLeft,
  ChevronRight,
  Quote,
  GraduationCap,
  Building2,
  Globe,
  ExternalLink,
  KeyRound,
  BarChart3,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import psuLogo from "../assets/psu-logo.png";
import { getCurrentUser, isAuthenticated } from "../utils/researchStore";
import { useTheme } from "../utils/themeContext";

interface GuideClickItem {
  label: string;
  visualReplica: ReactNode;
  explanation: string;
}

interface GuideCategory {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  narrativeParagraphs: [string, string];
  simulationSection?: {
    title: string;
    subtitle: string;
    visual: ReactNode;
    numberExplanation: string[];
  };
  clickableItems: GuideClickItem[];
}

/* ============================================================================
 * SIMULATED VISUAL & GRAPH COMPONENTS (FOR STEP-BY-STEP NUMERICAL WALKTHROUGHS)
 * ========================================================================== */

function SimulatedPublicCounterGraph() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 font-mono text-xs bg-muted/40 border border-border/70 px-4 py-3 rounded-xl">
        <span className="flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-brand" />
          <strong className="text-foreground text-sm">48</strong> Publications
        </span>
        <span className="text-border">•</span>
        <span className="flex items-center gap-1.5">
          <Quote className="w-4 h-4 text-amber-500" />
          <strong className="text-foreground text-sm">312</strong> Citations
        </span>
        <span className="text-border">•</span>
        <span className="flex items-center gap-1.5">
          <GraduationCap className="w-4 h-4 text-blue-500" />
          <strong className="text-foreground text-sm">24</strong> Researchers
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-1">
          <div className="flex items-center justify-between">
            <Badge className="bg-amber-500 text-white text-[10px]">#1 Most Cited</Badge>
            <span className="text-xs font-mono font-bold text-emerald-600">42 Citations</span>
          </div>
          <p className="text-xs font-bold text-foreground line-clamp-1 pt-1">
            Smart Agricultural Water Monitoring in Eastern Pangasinan
          </p>
          <p className="text-[11px] text-muted-foreground">Year: 2024 • BSIT Department</p>
        </div>
        <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-1">
          <div className="flex items-center justify-between">
            <Badge className="bg-slate-500 text-white text-[10px]">#2 Most Cited</Badge>
            <span className="text-xs font-mono font-bold text-emerald-600">29 Citations</span>
          </div>
          <p className="text-xs font-bold text-foreground line-clamp-1 pt-1">
            Community Entrepreneurship and Micro-Enterprise Resilience
          </p>
          <p className="text-[11px] text-muted-foreground">Year: 2023 • BSBA Department</p>
        </div>
        <div className="p-3.5 rounded-xl border border-border/70 bg-card space-y-1">
          <div className="flex items-center justify-between">
            <Badge className="bg-amber-700 text-white text-[10px]">#3 Most Cited</Badge>
            <span className="text-xs font-mono font-bold text-emerald-600">21 Citations</span>
          </div>
          <p className="text-xs font-bold text-foreground line-clamp-1 pt-1">
            Reading Comprehension Strategies in Public Elementary Schools
          </p>
          <p className="text-[11px] text-muted-foreground">Year: 2024 • BEE Department</p>
        </div>
      </div>
    </div>
  );
}

function SimulatedDashboardCharts() {
  const yearlySample = [
    { year: "2021", pubs: 6, citations: 28, heightPct: 24 },
    { year: "2022", pubs: 11, citations: 54, heightPct: 44 },
    { year: "2023", pubs: 16, citations: 89, heightPct: 64 },
    { year: "2024", pubs: 22, citations: 141, heightPct: 88 },
    { year: "2025", pubs: 25, citations: 176, heightPct: 100 },
  ];

  const deptSample = [
    { dept: "BSIT", count: 24, pct: 100, color: "bg-blue-600" },
    { dept: "BSE", count: 18, pct: 75, color: "bg-indigo-600" },
    { dept: "BSBA", count: 14, pct: 58, color: "bg-emerald-600" },
    { dept: "BEE", count: 11, pct: 46, color: "bg-amber-500" },
    { dept: "BTLED", count: 8, pct: 33, color: "bg-purple-600" },
    { dept: "BIT", count: 5, pct: 21, color: "bg-rose-500" },
  ];

  return (
    <div className="space-y-5">
      {/* Simulated Top 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border/70 bg-card">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase">Total Publications</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">80</p>
          <p className="text-[11px] text-emerald-600 font-medium mt-0.5">+25 published in 2025</p>
        </div>
        <div className="p-3.5 rounded-xl border border-border/70 bg-card">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase">Total Citations</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">488</p>
          <p className="text-[11px] text-blue-600 font-medium mt-0.5">Avg. 6.1 citations per work</p>
        </div>
        <div className="p-3.5 rounded-xl border border-border/70 bg-card">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase">Researchers</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">24</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Active across 6 departments</p>
        </div>
        <div className="p-3.5 rounded-xl border border-border/70 bg-card">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase">Campus H-Index</p>
          <p className="text-2xl font-extrabold text-foreground mt-1">12</p>
          <p className="text-[11px] text-amber-600 font-medium mt-0.5">12 works with 12+ citations</p>
        </div>
      </div>

      {/* Simulated Bar & Department Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Yearly Growth Chart */}
        <div className="p-4 rounded-xl border border-border/70 bg-card space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-foreground">Simulated Annual Publication Growth (2021–2025)</p>
              <p className="text-[11px] text-muted-foreground">Blue bars = Publications • Amber badge = Citations</p>
            </div>
            <BarChart3 className="w-4 h-4 text-brand" />
          </div>
          <div className="h-40 flex items-end justify-between gap-3 pt-6 px-2 border-b border-border/60">
            {yearlySample.map((item) => (
              <div key={item.year} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <span className="text-[10px] font-mono font-bold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  {item.citations}c
                </span>
                <div
                  style={{ height: `${item.heightPct}%` }}
                  className="w-full max-w-[38px] rounded-t-lg bg-brand flex items-start justify-center pt-1 text-[10px] font-bold text-white shadow-2xs"
                >
                  {item.pubs}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-2 text-[11px] font-mono text-muted-foreground">
            {yearlySample.map((item) => (
              <span key={item.year} className="flex-1 text-center font-semibold">
                {item.year}
              </span>
            ))}
          </div>
        </div>

        {/* Department Share Chart */}
        <div className="p-4 rounded-xl border border-border/70 bg-card space-y-3">
          <div>
            <p className="text-xs font-bold text-foreground">Simulated Publications by Department</p>
            <p className="text-[11px] text-muted-foreground">Comparing total published works across programs</p>
          </div>
          <div className="space-y-2.5 pt-1">
            {deptSample.map((d) => (
              <div key={d.dept} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{d.dept}</span>
                  <span className="font-mono text-muted-foreground">{d.count} publications</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${d.color}`} style={{ width: `${d.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulatedImpactGraph() {
  const citationTiers = [
    { label: "Highly Cited (20+ Citations)", count: 8, pct: 20, color: "bg-emerald-600" },
    { label: "Moderately Cited (5–19 Citations)", count: 22, pct: 55, color: "bg-blue-600" },
    { label: "Newly Cited (1–4 Citations)", count: 10, pct: 25, color: "bg-amber-500" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="p-4 rounded-xl border border-border/70 bg-card space-y-3">
        <p className="text-xs font-bold text-foreground">Simulated Citation Reach Breakdown (40 Cited Works)</p>
        <div className="space-y-3">
          {citationTiers.map((t) => (
            <div key={t.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">{t.label}</span>
                <span className="font-mono font-bold text-foreground">
                  {t.count} works ({t.pct}%)
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${t.color}`} style={{ width: `${t.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl border border-border/70 bg-card space-y-2.5">
        <p className="text-xs font-bold text-foreground">Simulated Department Citation Impact</p>
        <div className="divide-y divide-border/60 text-xs">
          <div className="py-2 flex items-center justify-between">
            <span className="font-semibold">BSIT (Information Technology)</span>
            <span className="font-mono text-emerald-600 font-bold">24 publications • 198 citations (Avg 8.2)</span>
          </div>
          <div className="py-2 flex items-center justify-between">
            <span className="font-semibold">BSE (Secondary Education)</span>
            <span className="font-mono text-blue-600 font-bold">18 publications • 117 citations (Avg 6.5)</span>
          </div>
          <div className="py-2 flex items-center justify-between">
            <span className="font-semibold">BSBA (Business Administration)</span>
            <span className="font-mono text-amber-600 font-bold">14 publications • 84 citations (Avg 6.0)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulatedSDGRadarGraph() {
  const sampleGoals = [
    { code: "SDG 4", name: "Quality Education", count: 28, pct: 100, color: "bg-red-600" },
    { code: "SDG 9", name: "Industry, Innovation & Infrastructure", count: 19, pct: 68, color: "bg-orange-500" },
    { code: "SDG 8", name: "Decent Work & Economic Growth", count: 14, pct: 50, color: "bg-rose-700" },
    { code: "SDG 3", name: "Good Health & Well-Being", count: 11, pct: 39, color: "bg-emerald-600" },
    { code: "SDG 13", name: "Climate Action", count: 8, pct: 29, color: "bg-green-700" },
  ];

  return (
    <div className="p-4 rounded-xl border border-border/70 bg-card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-foreground">Simulated UN Sustainable Development Goal Alignment</p>
          <p className="text-[11px] text-muted-foreground">Showing how 80 sample campus publications align with global goals</p>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-brand/40 text-brand">
          17 Global Goals
        </Badge>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
        {sampleGoals.map((g) => (
          <div key={g.code} className="p-3 rounded-xl border border-border/70 bg-muted/20 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded ${g.color}`}>{g.code}</span>
              <span className="text-xs font-mono font-bold text-foreground">{g.count} works</span>
            </div>
            <p className="text-xs font-semibold text-foreground line-clamp-1">{g.name}</p>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full ${g.color}`} style={{ width: `${g.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * 1. GUEST GUIDE CATEGORIES
 * ========================================================================== */
const guestGuideCategories: GuideCategory[] = [
  {
    id: "public-search",
    number: 1,
    title: "Public Search & Institutional Repository",
    subtitle: "Exploring PSU Asingan's published research works and citation numbers",
    icon: Search,
    narrativeParagraphs: [
      "When you open the Pangasinan State University — Asingan Campus Research Portal, you are greeted by the Public Search and Institutional Repository page. At the top left of the header, a live summary bar shows you the exact number of verified Publications, combined global Citations, and registered Researchers on campus. Directly below the university banner sits the main search box along with two search mode buttons—'PSU Repository (Verified)' and 'Global Academic Search'—followed by filter dropdowns for United Nations Sustainable Development Goals (SDG), Department, Publication Year, and Sorting order. This welcoming layout allows students, teachers, accreditors, and visitors to browse our campus's scholarly output without needing to sign in.",
      "Every section on this page is built to help you discover real research impact in seconds. Below the search controls, the 'Most Cited Institutional Works' showcase highlights the top three campus publications that have earned the highest number of citations from other researchers around the world, followed by the complete paginated catalog of campus studies. Whether you want to read studies written by a specific teacher, check which works support Quality Education or Climate Action, or open the original journal article to read the full text, everything is organized in one clear, open-access directory.",
    ],
    simulationSection: {
      title: "Simulated Public Repository Numbers & Top-Cited Showcase",
      subtitle: "Example of what the numbers on the Public Search page mean",
      visual: <SimulatedPublicCounterGraph />,
      numberExplanation: [
        "In the simulated counter bar at the top, '48 Publications' means 48 published studies authored by PSU Asingan researchers have been verified and stored in the campus repository.",
        "'312 Citations' is the combined total of how many times all 48 of those publications have been referenced by other scholars in their own research studies.",
        "'24 Researchers' tells you that 24 registered PSU Asingan researchers contributed to those 48 publications.",
        "In the 3 highlight cards below (#1, #2, and #3 Most Cited), a study showing '42 Citations' in 2024 means 42 other published studies worldwide have cited that BSIT study since it was published.",
      ],
    },
    clickableItems: [
      {
        label: "PSU Repository (Verified) Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold shadow-2xs">
            <Building2 className="w-3.5 h-3.5" />
            <span>PSU Repository (Verified)</span>
          </span>
        ),
        explanation:
          "Switches the search bar so that it searches only the official, verified publications written by PSU Asingan researchers.",
      },
      {
        label: "Global Academic Search Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-semibold">
            <Globe className="w-3.5 h-3.5 text-brand" />
            <span>Global Academic Search</span>
          </span>
        ),
        explanation:
          "Lets you search worldwide academic libraries for any research topic, while automatically placing works from Pangasinan State University and the Philippines at the top of the results.",
      },
      {
        label: "Read Source / Publication Title Link",
        visualReplica: (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-muted/40 text-brand text-xs font-semibold">
            <span>Read Source</span>
            <ExternalLink className="w-3 h-3" />
          </span>
        ),
        explanation:
          "Clicking a publication's title or its 'Read Source' button opens the original journal page in a new browser tab so you can read the full study.",
      },
      {
        label: "Sign In Button (Top-Right Header)",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold">
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </span>
        ),
        explanation:
          "Takes PSU Asingan researchers and the Research Coordinator to the Sign In screen so they can access their personal workspace.",
      },
    ],
  },
  {
    id: "signin-and-invitation",
    number: 2,
    title: "Sign In & Asking for an Invitation",
    subtitle: "How PSU Asingan researchers sign in or request an account using their ASIN-00000 Instructor ID",
    icon: LogIn,
    narrativeParagraphs: [
      "When you click the 'Sign In' button in the top-right corner of the public portal, you are taken to the Researcher Access screen. On the left side of the screen, you will see the Pangasinan State University — Asingan Campus branding, a 'Back to Public Search' link, and the 'Welcome Back' sign-in card where registered researchers enter their Username or Instructor ID and Password. On the right side of the screen is a photograph of the PSU Asingan campus building. This clean two-column screen serves as the secure entrance to the internal research portal.",
      "Because all campus records must remain accurate and official, researcher accounts are created by invitation only. If you are a PSU Asingan researcher who does not have an account yet, you will see an 'Ask for Invitation' link at the bottom of the sign-in card. Clicking that link opens a request window where you enter your name, email address, and your Instructor ID in the standardized ASIN-00000 format. Once you submit the request, it goes directly to Research Coordinator Sir Rodelio M. Garin, who reviews it and sends an activation link to your email.",
    ],
    clickableItems: [
      {
        label: "Back to Public Search Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-slate-600 bg-slate-100 text-xs font-semibold">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Public Search</span>
          </span>
        ),
        explanation:
          "Returns you immediately to the public search page if you want to continue browsing campus publications without signing in.",
      },
      {
        label: "Ask for Invitation Link",
        visualReplica: (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-600 border border-blue-200 text-xs font-semibold">
            <span>Ask for Invitation</span>
          </span>
        ),
        explanation:
          "Opens the invitation request form for PSU Asingan researchers who need a new account.",
      },
      {
        label: "Locked ASIN-00000 Instructor ID Input",
        visualReplica: (
          <div className="inline-flex items-center rounded-md border border-slate-300 overflow-hidden text-xs font-mono">
            <span className="bg-slate-100 text-slate-700 font-bold px-2.5 py-1 border-r border-slate-300">
              ASIN-
            </span>
            <span className="bg-white text-slate-500 px-2.5 py-1">00000</span>
          </div>
        ),
        explanation:
          "Both Faculty and Non-Faculty researchers use the exact same Instructor ID format (ASIN-00000). The 'ASIN-' prefix is permanently locked so you only need to type your 5 numeric digits.",
      },
      {
        label: "Submit Request Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold">
            <Send className="w-3.5 h-3.5" />
            <span>Submit Request</span>
          </span>
        ),
        explanation:
          "Sends your account request to Research Coordinator Sir Rodelio M. Garin for approval.",
      },
    ],
  },
];

/* ============================================================================
 * 2. RESEARCHER GUIDE CATEGORIES
 * ========================================================================== */
const researcherGuideCategories: GuideCategory[] = [
  {
    id: "my-publications",
    number: 1,
    title: "My Publications",
    subtitle: "Your personal portfolio for viewing your published research and adding new publications",
    icon: FileText,
    narrativeParagraphs: [
      "As soon as you sign in as a Researcher, your home screen is the 'My Publications' page. At the top of the workspace, you will see the page header titled 'My Publications' with a prominent blue 'Add Publication' button on the right, followed by summary cards that count how many verified publications you have in your portfolio, how many claimed works are awaiting coordinator approval, and the total number of publications across the entire campus. Directly beneath those summary cards are two navigation tabs: 'My Published Research' and 'Institutional Repository'.",
      "The purpose of this page is to give you a clean, single place to manage your published scholarly output without clutter. Because this system tracks completed, published research, you only add works that have already been published in a journal or conference. In the first tab ('My Published Research'), you see your own publications along with a status badge showing whether each work is 'Approved' or 'Pending Approval'. Switching to the second tab ('Institutional Repository') lets you browse all verified publications from your fellow PSU Asingan researchers.",
    ],
    clickableItems: [
      {
        label: "Add Publication Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold shadow-2xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Add Publication</span>
          </span>
        ),
        explanation:
          "Opens the 'Add Publication' form where you can enter the Title, Authors, Journal Name, Publication Year, and Link of a published work. Submitting it sends the record to Research Coordinator Sir Rodelio M. Garin for verification.",
      },
      {
        label: "My Published Research Tab",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-brand text-xs font-bold shadow-2xs">
            <FileText className="w-3.5 h-3.5" />
            <span>My Published Research</span>
          </span>
        ),
        explanation:
          "Displays only the publications assigned to your researcher profile, including both approved works and those awaiting coordinator approval.",
      },
      {
        label: "Institutional Repository Tab",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 text-muted-foreground text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Institutional Repository</span>
          </span>
        ),
        explanation:
          "Lets you explore all verified publications across Pangasinan State University — Asingan Campus right from your own workspace.",
      },
    ],
  },
  {
    id: "search",
    number: 2,
    title: "Search",
    subtitle: "Finding your published works online and claiming them into your profile",
    icon: Search,
    narrativeParagraphs: [
      "When you click 'Search' in the left navigation menu, you open the academic literature search page. At the top is a wide search bar where you can type your surname, the title of your published study, or 'Pangasinan State University'. Below the search bar, matching results are displayed in clean cards, showing 10 publications per page. Each card displays the publication title, authors, publication year, journal name, citation count, geographical badge, and United Nations Sustainable Development Goal tags.",
      "The main purpose of the Search page for a Researcher is to save you from having to type your publication details manually. When you find a study that you authored in the search results, look at the bottom bar of that result card where it says 'Assign Researcher'. Simply select your name from the dropdown ('Assign to Myself') and click the blue 'Claim & Request Approval' button. Your claim is immediately forwarded to Research Coordinator Sir Rodelio M. Garin, and once approved, the publication appears automatically in your 'My Published Research' portfolio.",
    ],
    clickableItems: [
      {
        label: "Search Input & Search Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold">
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </span>
        ),
        explanation:
          "Searches online academic libraries for published studies matching the title, author surname, or topic you typed.",
      },
      {
        label: "Assign to Myself Dropdown",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-background text-xs font-medium text-foreground">
            <User className="w-3.5 h-3.5 text-brand" />
            <span>Assign to Myself (Required)</span>
          </span>
        ),
        explanation:
          "Located at the bottom of every search result card. Selecting your name links the publication to your Instructor ID before you submit your claim.",
      },
      {
        label: "Claim & Request Approval Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold shadow-2xs">
            <Hand className="w-3.5 h-3.5" />
            <span>Claim & Request Approval</span>
          </span>
        ),
        explanation:
          "Submits the selected publication as your own work and sends it to Research Coordinator Sir Rodelio M. Garin for approval.",
      },
    ],
  },
  {
    id: "researchers",
    number: 3,
    title: "Researchers",
    subtitle: "Browsing the campus directory and viewing Faculty (Department) and Non-Faculty badges",
    icon: Users,
    narrativeParagraphs: [
      "Clicking 'Researchers' in the left sidebar opens the complete directory of registered PSU Asingan researchers. At the top of the page, you will see a search bar to look up a colleague by name, a Department filter dropdown, a Sort menu (to order by Most Publications, Most Citations, or Alphabetical), and view buttons to switch between 'All Researchers' and 'By Department'. Below the controls, each researcher is presented in a profile card showing their photo, full name, Instructor ID (ASIN-00000), publication count, and total citations.",
      "Across the entire system, everyone is referred to simply as a Researcher—except right here on the Researchers page (and when viewing an individual Researcher Profile), which is the dedicated place where you can see whether a colleague is a teaching faculty member or non-teaching staff. Faculty members display a badge showing 'Faculty (Department)'—such as 'Faculty (BSIT)' or 'Faculty (BSBA)'—while non-teaching researchers display 'Non-Faculty', and Sir Rodelio M. Garin displays 'Research Coordinator'.",
    ],
    clickableItems: [
      {
        label: "Classification Badges (Researchers Page Only)",
        visualReplica: (
          <div className="inline-flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/30 font-semibold">
              Faculty (BSIT)
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-700 border-slate-500/30 font-semibold">
              Non-Faculty
            </Badge>
          </div>
        ),
        explanation:
          "Shows each researcher's classification and department right on their directory card and profile page.",
      },
      {
        label: "All Researchers / By Department View Switch",
        visualReplica: (
          <div className="inline-flex items-center rounded-lg border border-border p-0.5 bg-muted/40 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-card text-foreground font-semibold shadow-2xs">
              All Researchers
            </span>
            <span className="px-2.5 py-1 text-muted-foreground">By Department</span>
          </div>
        ),
        explanation:
          "Switches between viewing all researchers in one combined grid or grouping them under their respective departments.",
      },
      {
        label: "Clicking Any Researcher Card",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-brand/30 bg-brand/5 text-brand text-xs font-semibold">
            <User className="w-3.5 h-3.5" />
            <span>View Researcher Profile</span>
          </span>
        ),
        explanation:
          "Clicking anywhere on a researcher's card opens their full profile page, where you can view all of their published works and citation numbers.",
      },
    ],
  },
  {
    id: "sdg-radar",
    number: 4,
    title: "SDG Radar",
    subtitle: "Understanding how campus publications align with the 17 United Nations Goals",
    icon: Target,
    narrativeParagraphs: [
      "The 'SDG Radar' page shows how the published research of Pangasinan State University — Asingan Campus contributes to the 17 United Nations Sustainable Development Goals (SDGs). When you open this page, you see an overall visual radar chart paired with 17 color-coded cards—one for each global goal, such as SDG 3 (Good Health and Well-being), SDG 4 (Quality Education), SDG 8 (Decent Work and Economic Growth), SDG 9 (Industry, Innovation and Infrastructure), and SDG 13 (Climate Action). Each card displays the number of campus publications mapped to that goal.",
      "Modern university accreditation and institutional evaluations look closely at how campus studies solve real community challenges. Instead of guessing which goals our campus covers, this page gives you a clear visual map of our strengths. When you click on any of the 17 goal cards, the list at the bottom of the page updates to show the exact PSU Asingan publications supporting that goal, along with a plain-English explanation of why each study fits.",
    ],
    simulationSection: {
      title: "Simulated UN SDG Goal Alignment Numbers",
      subtitle: "How to read the goal cards and progress bars on the SDG Radar page",
      visual: <SimulatedSDGRadarGraph />,
      numberExplanation: [
        "In this simulated example of 80 campus publications, 'SDG 4: Quality Education' shows '28 works' with a full bar—meaning 28 published studies on campus focus on teaching, learning, or curriculum improvement.",
        "'SDG 9: Industry, Innovation & Infrastructure' shows '19 works', representing technology, engineering, and software studies.",
        "When you see a goal card with a lower number (such as 'SDG 13: Climate Action' with 8 works), it highlights an opportunity where researchers can focus future studies.",
      ],
    },
    clickableItems: [
      {
        label: "17 UN SDG Goal Cards",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-bold">
            <Target className="w-3.5 h-3.5" />
            <span>SDG 4: Quality Education</span>
          </span>
        ),
        explanation:
          "Click any of the 17 goal cards to filter the publication list below and see every campus study that supports that specific United Nations goal.",
      },
    ],
  },
  {
    id: "ask-campus-ai",
    number: 5,
    title: "Ask Campus AI",
    subtitle: "Asking everyday questions in English or Tagalog about campus publications",
    icon: Sparkles,
    narrativeParagraphs: [
      "You can open 'Ask Campus AI' either from the left navigation sidebar or by clicking the floating assistant button in the bottom-right corner of any screen. Inside, you will see a clean conversation window with starter question buttons at the top, a chat history list on the side, and a message input box at the bottom. It works just like sending a text message to a knowledgeable colleague who has memorized every publication in the PSU Asingan repository.",
      "The purpose of Ask Campus AI is to give you instant answers without having to filter tables or count records by hand. You can ask questions in plain English or Tagalog—such as 'How many publications do I have?', 'Which studies on campus talk about agriculture?', or 'Who are the most cited researchers in BSIT?'—and the assistant will immediately reply with accurate numbers and publication titles drawn directly from our campus records.",
    ],
    clickableItems: [
      {
        label: "Ask Campus AI Sidebar Item / Floating Assistant Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ai-soft text-ai font-semibold border border-ai-border text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask Campus AI</span>
          </span>
        ),
        explanation:
          "Opens the AI research assistant so you can ask questions about PSU Asingan publications, citations, and researchers.",
      },
    ],
  },
  {
    id: "profile-and-settings",
    number: 6,
    title: "My Profile & Settings",
    subtitle: "Updating your researcher profile, Google Scholar link, password, and display theme",
    icon: Settings,
    narrativeParagraphs: [
      "At the bottom of the left navigation sidebar (or by clicking your name and photo in the top-right header), you will find 'My Profile' and 'Settings'. On the 'My Profile' page, you see your researcher card displaying your photo, full name, Instructor ID (ASIN-00000), department, email address, and Google Scholar profile link. You can upload a new profile picture, update your Google Scholar URL, or click 'Sync My Publications' to automatically fetch newly published works from your Google Scholar profile.",
      "On the 'Settings' page, you will see tabs for 'Appearance & Theme', 'Security & Password', and 'Display Preferences'. In 'Appearance & Theme', you can switch the entire workspace between Light Mode, Dark Mode, or System Default. In 'Security & Password', you can change your sign-in password at any time. In 'Display Preferences', you can choose between 'Compact' and 'Standard' row spacing for tables.",
    ],
    clickableItems: [
      {
        label: "Sync My Publications Button (My Profile)",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync My Publications</span>
          </span>
        ),
        explanation:
          "Checks your linked Google Scholar profile and retrieves any new publications you have authored.",
      },
      {
        label: "Light Mode / Dark Mode Switch (Settings & Top Header)",
        visualReplica: (
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-amber-50 text-amber-700 text-xs font-semibold">
              <Sun className="w-3.5 h-3.5" />
              <span>Light Mode</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-blue-300 text-xs font-semibold">
              <Moon className="w-3.5 h-3.5" />
              <span>Dark Mode</span>
            </span>
          </div>
        ),
        explanation:
          "Switches the screen appearance between bright daylight colors and a dark theme that is comfortable for low-light reading.",
      },
      {
        label: "Update Password Button (Settings -> Security & Password)",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold">
            <KeyRound className="w-3.5 h-3.5" />
            <span>Update Password</span>
          </span>
        ),
        explanation:
          "Saves your new sign-in password after verifying your current password.",
      },
    ],
  },
];

/* ============================================================================
 * 3. RESEARCH COORDINATOR (ADMIN) GUIDE CATEGORIES
 * ========================================================================== */
const coordinatorGuideCategories: GuideCategory[] = [
  {
    id: "dashboard",
    number: 1,
    title: "Dashboard",
    subtitle: "Your executive overview of PSU Asingan's publications, citations, and annual growth",
    icon: LayoutDashboard,
    narrativeParagraphs: [
      "When you sign in as the Research Coordinator, the Dashboard is your command overview of Pangasinan State University — Asingan Campus. Across the top of the screen, four summary cards display the campus's core numbers at a glance: Total Publications, Total Citations, Registered Researchers, and the Campus H-Index. Directly below those cards, you see interactive charts showing annual publication and citation growth year by year, a horizontal bar breakdown comparing output across departments (BSIT, BSBA, BSE, BEE, BTLED, BIT, and Non-Faculty), and a ranked list of the most-cited publications on campus.",
      "The purpose of the Dashboard is to give you immediate situational awareness without having to run manual reports. Whether the Campus Executive Director asks for this year's publication count or you want to check which departments have increased their output compared to last year, the visual charts translate raw records into clear trends. Clicking on the summary cards or highlighted publications takes you straight to the underlying directory or record.",
    ],
    simulationSection: {
      title: "Simulated Dashboard Graphs & How to Read the Numbers",
      subtitle: "Visual walkthrough using sample campus numbers (80 Publications, 488 Citations, 24 Researchers)",
      visual: <SimulatedDashboardCharts />,
      numberExplanation: [
        "Top Summary Cards: '80 Total Publications' and '488 Total Citations' mean that across all 24 registered researchers, their 80 published works have been cited 488 times worldwide (an average of 6.1 citations per publication).",
        "Campus H-Index (12): An H-Index of 12 means that PSU Asingan has at least 12 published works that have each received 12 or more citations.",
        "Annual Growth Bar Chart (Left Graph): Each blue bar shows how many publications were produced in that calendar year, while the amber tag above it ('28c', '54c', '176c') shows citations. Rising bars from 6 publications in 2021 up to 25 publications in 2025 show steady institutional growth.",
        "Department Breakdown (Right Graph): The colored horizontal bars compare total publications by program—for example, BSIT with 24 publications (longest bar), BSE with 18, and BSBA with 14—so you can immediately see each program's share of campus output.",
      ],
    },
    clickableItems: [
      {
        label: "Dashboard Navigation Link (Left Sidebar)",
        visualReplica: (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-semibold">
            <LayoutDashboard className="w-4 h-4" />
            <span>Dashboard</span>
          </span>
        ),
        explanation:
          "Returns you to this executive overview from anywhere in the portal.",
      },
      {
        label: "Top Summary Cards (Publications / Researchers)",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-border bg-card text-xs font-semibold text-foreground">
            <FileText className="w-3.5 h-3.5 text-brand" />
            <span>Total Publications / Researchers</span>
          </span>
        ),
        explanation:
          "Clicking the summary cards jumps directly to the full Publications Repository or the Researchers directory.",
      },
    ],
  },
  {
    id: "search",
    number: 2,
    title: "Search",
    subtitle: "Searching academic libraries and saving publications directly to any registered researcher",
    icon: Search,
    narrativeParagraphs: [
      "The 'Search' page lets you look up published studies across worldwide academic libraries by typing a researcher's name, a study title, or 'Pangasinan State University'. Below the search box, results appear 10 per page with each study's title, co-authors, publication year, journal name, citation count, geographical priority badge ('Pangasinan State University', 'Philippines Research', or 'International Literature'), and United Nations SDG focus tags.",
      "As Research Coordinator, you have a direct publishing privilege on this page that regular researchers do not have. At the bottom of every search result card, you will see an 'Assign Researcher' dropdown containing every registered researcher in PSU Asingan along with their Instructor ID (ASIN-00000). Once you select the researcher who authored the study and click the green 'Save to Repository' button, the publication is immediately saved as an approved record in the campus repository.",
    ],
    clickableItems: [
      {
        label: "Search Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold">
            <Search className="w-3.5 h-3.5" />
            <span>Search</span>
          </span>
        ),
        explanation:
          "Queries online academic libraries and ranks Pangasinan State University and Philippine studies first.",
      },
      {
        label: "Select Registered Researcher Dropdown",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-background text-xs font-medium text-foreground">
            <User className="w-3.5 h-3.5 text-brand" />
            <span>-- Select Registered Researcher (Required) --</span>
          </span>
        ),
        explanation:
          "Lets you pick which registered PSU Asingan researcher authored the publication before saving it.",
      },
      {
        label: "Save to Repository Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-2xs">
            <Save className="w-3.5 h-3.5" />
            <span>Save to Repository</span>
          </span>
        ),
        explanation:
          "Immediately saves the publication into the official repository under the selected researcher's name without needing a separate approval step.",
      },
      {
        label: "Scraper Settings / Quota Button (Top-Right)",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-card text-xs font-mono text-muted-foreground">
            <KeyRound className="w-3.5 h-3.5 text-amber-500" />
            <span>$5.00 quota</span>
          </span>
        ),
        explanation:
          "Opens the backup search allowance window where you can check remaining monthly credits or add a backup search key.",
      },
    ],
  },
  {
    id: "researchers",
    number: 3,
    title: "Researchers",
    subtitle: "Browsing the campus directory and seeing Faculty (Department) and Non-Faculty badges",
    icon: Users,
    narrativeParagraphs: [
      "The 'Researchers' page displays the complete directory of all registered researchers at PSU Asingan. At the top, you have a search box, a Department filter dropdown, a Sort selector (Most Publications, Most Citations, or Name), and a view switch between 'All Researchers' and 'By Department'. Every card shows the researcher's profile photo, full name, Instructor ID (ASIN-00000), total publications, and total citations.",
      "Following our campus terminology standard, this page and the individual Researcher Profile page are the only places where users are distinguished as Faculty or Non-Faculty. Teaching faculty display a badge formatted as 'Faculty (Department)'—such as 'Faculty (BSIT)' or 'Faculty (BSBA)'—while non-teaching staff display 'Non-Faculty', and your own card displays a single clean 'Research Coordinator' badge.",
    ],
    clickableItems: [
      {
        label: "Faculty (Department), Non-Faculty & Research Coordinator Badges",
        visualReplica: (
          <div className="inline-flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/30 font-semibold">
              Faculty (BSIT)
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-slate-500/10 text-slate-700 border-slate-500/30 font-semibold">
              Non-Faculty
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30 font-semibold">
              Research Coordinator
            </Badge>
          </div>
        ),
        explanation:
          "Displayed on each researcher's card on the Researchers page and on their individual Researcher Profile.",
      },
      {
        label: "All Researchers / By Department Switch",
        visualReplica: (
          <div className="inline-flex items-center rounded-lg border border-border p-0.5 bg-muted/40 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-card text-foreground font-semibold shadow-2xs">
              All Researchers
            </span>
            <span className="px-2.5 py-1 text-muted-foreground">By Department</span>
          </div>
        ),
        explanation:
          "Toggles between a unified grid of all researchers and department-by-department sections showing each program's researcher and publication counts.",
      },
    ],
  },
  {
    id: "publications",
    number: 4,
    title: "Publications",
    subtitle: "Managing the master catalog of verified campus publications, citations, and APA exports",
    icon: FileText,
    narrativeParagraphs: [
      "The 'Publications' page is the master catalog of every verified publication in the PSU Asingan repository. At the top right of the header, you can switch between 'Table' view (a dense spreadsheet layout) and 'Cards' view, trigger 'Auto-Tag SDGs', or click 'Refresh'. Below the header sits the filter ribbon with a search box, an 'All Researchers' dropdown showing how many publications each researcher has, an 'All Years' dropdown, and a Sort dropdown.",
      "Every column header in the Table view—Publication Title, Registered Researcher, Authors, Journal / Index, Year, Citations, and UN SDG Goal—is clickable so you can sort the entire catalog in ascending or descending order. You can also check the boxes on the left side of any rows to bring up a floating bottom bar that copies formatted APA citations to your clipboard, or click anywhere on a publication row to open the side inspector drawer where you can edit its details or view citing works.",
    ],
    clickableItems: [
      {
        label: "Table / Cards View Switch",
        visualReplica: (
          <div className="inline-flex items-center rounded-lg border border-border p-0.5 bg-muted/40 text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-card text-foreground font-semibold shadow-2xs">
              <Table className="w-3.5 h-3.5" />
              <span>Table</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-muted-foreground">
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </span>
          </div>
        ),
        explanation:
          "Switches the publications list between a multi-column table and a two-column card grid.",
      },
      {
        label: "Auto-Tag SDGs Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-purple-300 bg-purple-50 text-purple-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Tag SDGs</span>
          </span>
        ),
        explanation:
          "Automatically analyzes any untagged publications in the repository and assigns their matching United Nations Sustainable Development Goals.",
      },
      {
        label: "Copy APA Citations Button (Batch Dock)",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold">
            <Copy className="w-3.5 h-3.5" />
            <span>Copy APA Citations</span>
          </span>
        ),
        explanation:
          "Appears at the bottom of the screen when you check one or more publications, copying ready-to-paste APA references to your clipboard.",
      },
    ],
  },
  {
    id: "impact-analysis",
    number: 5,
    title: "Impact Analysis",
    subtitle: "Measuring citation velocity, department reach, and scholarly influence",
    icon: TrendingUp,
    narrativeParagraphs: [
      "The 'Impact Analysis' page goes deeper than raw publication counts to examine how frequently PSU Asingan's published studies are cited by other researchers worldwide. On this screen, you see citation distribution tiers (Highly Cited, Moderately Cited, and Newly Cited works), multi-year citation trend curves, average citations per publication across departments, and a leaderboard of the most influential studies on campus.",
      "This page helps you evaluate the scholarly reach of each academic program during university reviews and research planning. For example, even if two departments have a similar number of publications, Impact Analysis reveals which department's studies are gaining stronger international readership and citations, helping you identify best practices such as publishing in open-access and internationally indexed journals.",
    ],
    simulationSection: {
      title: "Simulated Impact Analysis Graphs & Number Walkthrough",
      subtitle: "How to interpret Citation Reach Tiers and Department Citation Averages",
      visual: <SimulatedImpactGraph />,
      numberExplanation: [
        "Citation Reach Breakdown (Left Panel): Out of 40 sample cited works, '8 works (20%)' are in the Highly Cited tier (20 or more citations each), '22 works (55%)' are in the Moderately Cited tier (5 to 19 citations), and '10 works (25%)' have 1 to 4 citations.",
        "Department Citation Impact (Right Panel): Comparing '24 publications • 198 citations (Avg 8.2)' for BSIT against '18 publications • 117 citations (Avg 6.5)' for BSE tells you that on average, every BSIT publication earns 8.2 citations while every BSE publication earns 6.5 citations.",
      ],
    },
    clickableItems: [
      {
        label: "Impact Analysis Navigation Item",
        visualReplica: (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 text-xs font-semibold">
            <TrendingUp className="w-4 h-4" />
            <span>Impact Analysis</span>
          </span>
        ),
        explanation:
          "Opens the citation analytics and department impact comparison charts.",
      },
    ],
  },
  {
    id: "sdg-radar",
    number: 6,
    title: "SDG Radar",
    subtitle: "Mapping campus research output across the 17 United Nations Sustainable Development Goals",
    icon: Target,
    narrativeParagraphs: [
      "The 'SDG Radar' page visualizes how PSU Asingan's research portfolio supports the 17 United Nations Sustainable Development Goals. At the top is a radar chart showing the campus's overall coverage footprint, paired with 17 interactive goal cards—from SDG 1 (No Poverty) to SDG 17 (Partnerships for the Goals)—each displaying the exact number of campus publications aligned with that goal.",
      "Accrediting bodies and university rankings require clear evidence of how campus research addresses sustainable development. By clicking any of the 17 goal cards on this page, you can immediately inspect the list of PSU Asingan publications supporting that goal along with the rationale for each classification, making it effortless to prepare SDG evidence portfolios.",
    ],
    simulationSection: {
      title: "Simulated UN SDG Coverage Map",
      subtitle: "How to read the publication counts on each United Nations Goal card",
      visual: <SimulatedSDGRadarGraph />,
      numberExplanation: [
        "In this simulated chart, 'SDG 4: Quality Education' has 28 works (the highest bar), showing that instructional and educational research is the campus's strongest area.",
        "'SDG 9: Industry, Innovation & Infrastructure' has 19 works and 'SDG 8: Decent Work & Economic Growth' has 14 works, reflecting strong contributions from computing, technology, and business researchers.",
      ],
    },
    clickableItems: [
      {
        label: "SDG Goal Card Filter",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold">
            <Target className="w-3.5 h-3.5" />
            <span>SDG 3: Good Health & Well-Being</span>
          </span>
        ),
        explanation:
          "Clicking any of the 17 goal cards filters the table below to display only the campus publications aligned with that goal.",
      },
    ],
  },
  {
    id: "reports",
    number: 7,
    title: "Reports",
    subtitle: "Exporting official Excel spreadsheets and printable PDF reports for CHED and AACCUP accreditation",
    icon: FileBarChart,
    narrativeParagraphs: [
      "The 'Reports' page is built specifically to eliminate hours of manual spreadsheet formatting before CHED, AACCUP, or university-wide evaluations. At the top of the screen, you will see filter selectors for Department (All Departments, BSIT, BSBA, BSE, BEE, BTLED, BIT, or Non-Faculty) and Publication Year range, alongside two primary action buttons: 'Export Excel' and 'Print / Save PDF'. Below the controls is a live preview table of the exact records that will be included in your exported document.",
      "Whenever you change the department or year filter, the summary counts and preview table update immediately. Clicking 'Export Excel' generates a clean, multi-column Excel workbook (.xlsx) organized with publication titles, authors, journals, years, citations, and assigned researchers. Clicking 'Print / Save PDF' formats the report with official Pangasinan State University headers ready for printing or saving as a PDF.",
    ],
    clickableItems: [
      {
        label: "Export Excel Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold shadow-2xs">
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel (.xlsx)</span>
          </span>
        ),
        explanation:
          "Downloads a formatted Microsoft Excel spreadsheet containing all publications matching your selected filters.",
      },
      {
        label: "Print / Save PDF Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs font-semibold">
            <Printer className="w-3.5 h-3.5 text-brand" />
            <span>Print / Save PDF</span>
          </span>
        ),
        explanation:
          "Opens the print-ready institutional report view so you can print on paper or save as an official PDF.",
      },
    ],
  },
  {
    id: "ask-campus-ai",
    number: 8,
    title: "Ask Campus AI",
    subtitle: "Using the conversational research assistant for instant campus summaries",
    icon: Sparkles,
    narrativeParagraphs: [
      "Accessible from the left sidebar under 'Ask Campus AI' or via the floating assistant button at the bottom right of the screen, Ask Campus AI provides a conversational interface connected to the campus repository. You will see suggested starter prompts, a sidebar of your previous chat sessions, and a message box where you can type any question in English or Tagalog.",
      "During meetings or planning sessions, you can ask questions like 'Summarize our campus publications in 2024 by department' or 'Which researchers have the highest citations?' and receive a structured, accurate response in seconds without leaving your workflow.",
    ],
    clickableItems: [
      {
        label: "Ask Campus AI Navigation Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ai-soft text-ai font-semibold border border-ai-border text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ask Campus AI</span>
          </span>
        ),
        explanation:
          "Opens the full-page AI chat workspace and conversation history.",
      },
    ],
  },
  {
    id: "admin-console",
    number: 9,
    title: "Admin Console",
    subtitle: "Approving publication claims, managing researchers, and sending ASIN-00000 invitations",
    icon: Shield,
    narrativeParagraphs: [
      "The 'Admin Console' is your exclusive management center as Research Coordinator. At the top of the page sits your coordinator profile card (Sir Rodelio M. Garin) displaying a single 'Research Coordinator' badge and a 'Sync My Publications' button, followed by four live summary counters: Total Researchers, Invitation Requests, Pending Activations, and Pending Claims. Beneath those counters are four management tabs: 'Pending Claims', 'Researchers', 'Invite Researcher', and 'Invitation Requests'.",
      "Every administrative workflow is organized cleanly across those four tabs. In 'Pending Claims', you review publications claimed or submitted by researchers and click 'Approve' or 'Reject'. In 'Researchers', you can sync any researcher's Google Scholar publications, edit their details, or remove an account. In 'Invite Researcher', you invite new researchers using the locked 'ASIN-' prefix + 5-digit Instructor ID (ASIN-00000) and select whether they are Faculty (with their department) or Non-Faculty. In 'Invitation Requests', you can approve requests sent from the login page with one click.",
    ],
    clickableItems: [
      {
        label: "Sync My Publications Button (Coordinator Card)",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync My Publications</span>
          </span>
        ),
        explanation:
          "Updates your own Google Scholar publications in the campus repository with one click.",
      },
      {
        label: "Approve & Reject Buttons (Tab 1: Pending Claims)",
        visualReplica: (
          <div className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-semibold">
              <Check className="w-3.5 h-3.5" />
              <span>Approve</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold">
              <X className="w-3.5 h-3.5" />
              <span>Reject</span>
            </span>
          </div>
        ),
        explanation:
          "Approves a researcher's claimed or added publication so it appears in the official repository, or rejects it if inaccurate.",
      },
      {
        label: "Sync, Edit, and Delete Icons (Tab 2: Researchers)",
        visualReplica: (
          <div className="inline-flex items-center gap-1.5">
            <span className="p-1.5 rounded-lg border border-border bg-card text-brand">
              <RefreshCw className="w-3.5 h-3.5" />
            </span>
            <span className="p-1.5 rounded-lg border border-border bg-card text-foreground">
              <Edit3 className="w-3.5 h-3.5" />
            </span>
            <span className="p-1.5 rounded-lg border border-border bg-card text-red-600">
              <Trash2 className="w-3.5 h-3.5" />
            </span>
          </div>
        ),
        explanation:
          "In the Researchers table, these buttons let you sync a researcher's Google Scholar works, edit their account details, or remove their record.",
      },
      {
        label: "Locked ASIN-00000 Input & Send Invitation Button (Tab 3: Invite Researcher)",
        visualReplica: (
          <div className="inline-flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-md border border-border overflow-hidden text-xs font-mono">
              <span className="bg-muted text-foreground font-bold px-2 py-1 border-r border-border">
                ASIN-
              </span>
              <span className="bg-background text-muted-foreground px-2 py-1">00000</span>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand text-white text-xs font-semibold">
              <Send className="w-3 h-3" />
              <span>Send Invitation</span>
            </span>
          </div>
        ),
        explanation:
          "Type the 5 digits of the researcher's Instructor ID (ASIN-00000), fill in their name, email, and classification, and click 'Send Invitation' to email their activation link.",
      },
    ],
  },
  {
    id: "profile-and-settings",
    number: 10,
    title: "My Profile & Settings",
    subtitle: "Managing your coordinator profile, appearance theme, password, and cloud database backup",
    icon: Settings,
    narrativeParagraphs: [
      "At the bottom left of the sidebar, 'My Profile' and 'Settings' allow you to manage your personal coordinator account and system-wide display preferences. In 'My Profile', you can update your photo, contact email, and Google Scholar link. In 'Settings', you have four tabs: 'Appearance & Theme', 'Security & Password', 'Display Preferences', and 'System & Cloud Storage'.",
      "The 'System & Cloud Storage' tab shows the live connection status of the portal's Turso Cloud storage, ensuring that all researcher accounts, invitations, publications, and citations are permanently backed up and never lost even when the cloud server restarts.",
    ],
    clickableItems: [
      {
        label: "Appearance Mode Cards (Light / Dark / System)",
        visualReplica: (
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-amber-50 text-amber-700 text-xs font-semibold">
              <Sun className="w-3.5 h-3.5" />
              <span>Light Mode</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 text-blue-300 text-xs font-semibold">
              <Moon className="w-3.5 h-3.5" />
              <span>Dark Mode</span>
            </span>
          </div>
        ),
        explanation:
          "Switches the interface theme between Light Mode, Dark Mode, and System Default.",
      },
      {
        label: "Sync Local Tables to Turso Cloud Button",
        visualReplica: (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Local Tables to Turso Cloud</span>
          </span>
        ),
        explanation:
          "Triggers an immediate manual backup of all local records to persistent cloud storage.",
      },
    ],
  },
];

export function SystemGuidePage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const loggedIn = isAuthenticated() && Boolean(currentUser);
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Strictly show ONLY the guide corresponding to the user's current role (no role switcher)
  const roleView: "guest" | "researcher" | "coordinator" = !loggedIn
    ? "guest"
    : currentUser?.role === "admin"
    ? "coordinator"
    : "researcher";

  const categories =
    roleView === "coordinator"
      ? coordinatorGuideCategories
      : roleView === "researcher"
      ? researcherGuideCategories
      : guestGuideCategories;

  const [currentIndex, setCurrentIndex] = useState(0);

  // Ensure index stays in bounds and scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentIndex]);

  const activeCategory = categories[currentIndex] || categories[0];
  const prevCategory = currentIndex > 0 ? categories[currentIndex - 1] : null;
  const nextCategory = currentIndex < categories.length - 1 ? categories[currentIndex + 1] : null;
  const ActiveIcon = activeCategory.icon;

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col font-sans">
      {/* ==================================================== */}
      {/* FULL-WIDTH INSTITUTIONAL TOP HEADER                  */}
      {/* ==================================================== */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="w-full px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: PSU Brand */}
          <div
            onClick={() =>
              navigate(
                !loggedIn
                  ? "/"
                  : currentUser?.role === "admin"
                  ? "/dashboard"
                  : "/dashboard/publications"
              )
            }
            className="flex items-center gap-3 cursor-pointer group"
          >
            <img src={psuLogo} alt="PSU Logo" className="w-10 h-10 object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight group-hover:text-brand transition-colors">
                  Research Portal • PSU Asingan Campus
                </h1>
                <Badge variant="outline" className="text-[10px] font-semibold border-brand/40 text-brand bg-brand/5">
                  {roleView === "coordinator"
                    ? "Research Coordinator Guide"
                    : roleView === "researcher"
                    ? "Researcher Guide"
                    : "Visitor & New Researcher Guide"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Step-by-Step Visual Walkthrough — Page {currentIndex + 1} of {categories.length}
              </p>
            </div>
          </div>

          {/* Right: Theme Toggle & Return Button */}
          <div className="flex items-center gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={cycleTheme}
              title={`Theme: ${theme}. Click to switch.`}
              className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-full"
            >
              {resolvedTheme === "dark" ? (
                <Moon className="w-4 h-4 text-blue-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
            </Button>

            {loggedIn ? (
              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  navigate(currentUser?.role === "admin" ? "/dashboard" : "/dashboard/publications")
                }
                className="gap-2 text-xs font-semibold bg-brand hover:bg-brand/90 text-white h-9 px-4"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>
                  Return to {currentUser?.role === "admin" ? "Dashboard" : "My Publications"}
                </span>
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/")}
                  className="gap-1.5 text-xs font-medium h-9"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Public Search</span>
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate("/login")}
                  className="gap-1.5 text-xs font-semibold bg-brand hover:bg-brand/90 text-white h-9"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ==================================================== */}
      {/* FULL-WIDTH EDGE-TO-EDGE WORKSPACE LAYOUT             */}
      {/* ==================================================== */}
      <div className="flex-1 w-full flex flex-col lg:flex-row">
        {/* Left Topic Sidebar (Mirrors Workspace Navigation) */}
        <aside className="w-full lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-border/70 bg-card/60 p-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="px-2 py-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-brand" />
                <span>Guide Chapters ({categories.length} Pages)</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Click any page below or use the Next / Previous buttons.
              </p>
            </div>

            <nav className="space-y-1">
              {categories.map((cat, idx) => {
                const Icon = cat.icon;
                const isActive = idx === currentIndex;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer ${
                      isActive
                        ? "bg-blue-50 dark:bg-[#263951] text-blue-600 dark:text-[#4599ff] font-semibold border border-blue-200/80 dark:border-[#2d88ff]/40 shadow-2xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-brand text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {cat.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm truncate">{cat.title}</p>
                    </div>
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-brand" : "text-muted-foreground/60"
                      }`}
                    />
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Progress Indicator Box at Bottom of Sidebar */}
          <div className="hidden lg:block mt-6 p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Reading Progress</span>
              <span className="font-mono font-bold text-brand">
                Page {currentIndex + 1} / {categories.length}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / categories.length) * 100}%` }}
              />
            </div>
          </div>
        </aside>

        {/* Right Full-Width Single-Page Content Area */}
        <main className="flex-1 min-w-0 p-5 sm:p-8 lg:p-10 flex flex-col justify-between space-y-8">
          <div className="space-y-8">
            {/* Page Title Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/70">
              <div className="flex items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand text-white flex items-center justify-center shrink-0 shadow-sm">
                  <ActiveIcon className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-brand/10 text-brand border border-brand/20 text-[11px] font-bold">
                      Page {activeCategory.number} of {categories.length}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium">
                      • Interactive System Guide
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight mt-1">
                    {activeCategory.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    {activeCategory.subtitle}
                  </p>
                </div>
              </div>
            </div>

            {/* Section 1: Detailed 2-Paragraph Narrative */}
            <Card className="border-border/70 shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
                <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-brand flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  <span>What You See on This Page & What Each Part Is For</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 sm:p-7 space-y-4 text-sm sm:text-[15px] text-foreground/90 leading-relaxed">
                <p>{activeCategory.narrativeParagraphs[0]}</p>
                <p>{activeCategory.narrativeParagraphs[1]}</p>
              </CardContent>
            </Card>

            {/* Section 2: Interactive Graph / Numbers Simulation (When Applicable) */}
            {activeCategory.simulationSection && (
              <Card className="border-brand/30 bg-brand/[0.02] shadow-2xs">
                <CardHeader className="pb-3 border-b border-border/60 bg-brand/5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-brand flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        <span>{activeCategory.simulationSection.title}</span>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activeCategory.simulationSection.subtitle}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-semibold bg-background border-brand/30 text-brand">
                      Simulated Sample Data Preview
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5 sm:p-7 space-y-6">
                  {/* Visual Graph Preview */}
                  {activeCategory.simulationSection.visual}

                  {/* Step-by-Step Numerical Explanation */}
                  <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/80 space-y-2.5">
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-brand" />
                      <span>How to Read These Sample Numbers:</span>
                    </p>
                    <ul className="space-y-2 text-xs sm:text-sm text-foreground/90 leading-relaxed">
                      {activeCategory.simulationSection.numberExplanation.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-brand/10 text-brand font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Section 3: Exact Workspace Buttons & Clickable Links */}
            <Card className="border-border/70 shadow-2xs">
              <CardHeader className="pb-3 border-b border-border/60 bg-muted/20">
                <CardTitle className="text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <MousePointerClick className="w-4 h-4" />
                  <span>Workspace Buttons & Clickable Links on This Page</span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Each item below shows the exact button or badge you will see in the workspace along with what happens when you click it.
                </p>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/60">
                {activeCategory.clickableItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                  >
                    {/* Left: Exact Workspace Button / Badge Visual Replica */}
                    <div className="md:w-72 lg:w-80 shrink-0 space-y-1.5">
                      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{item.label}</span>
                      </p>
                      <div className="pt-1">{item.visualReplica}</div>
                    </div>

                    {/* Right: Plain-Language Explanation */}
                    <div className="flex-1 text-xs sm:text-sm text-foreground/90 leading-relaxed md:border-l md:border-border/60 md:pl-6">
                      {item.explanation}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* ==================================================== */}
          {/* BOTTOM PAGINATION BAR (PREVIOUS PAGE / NEXT PAGE)    */}
          {/* ==================================================== */}
          <div className="pt-6 border-t border-border/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            {prevCategory ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentIndex(currentIndex - 1)}
                className="w-full sm:w-auto h-11 px-5 text-xs sm:text-sm font-semibold gap-2 justify-start"
              >
                <ChevronLeft className="w-4 h-4" />
                <div className="text-left">
                  <span className="block text-[10px] text-muted-foreground uppercase">
                    Previous Page ({prevCategory.number} of {categories.length})
                  </span>
                  <span>{prevCategory.title}</span>
                </div>
              </Button>
            ) : (
              <div />
            )}

            <div className="text-xs font-mono text-muted-foreground">
              Page {currentIndex + 1} of {categories.length}
            </div>

            {nextCategory ? (
              <Button
                type="button"
                variant="default"
                onClick={() => setCurrentIndex(currentIndex + 1)}
                className="w-full sm:w-auto h-11 px-6 text-xs sm:text-sm font-semibold bg-brand hover:bg-brand/90 text-white gap-2 justify-end shadow-sm"
              >
                <div className="text-right">
                  <span className="block text-[10px] text-white/80 uppercase">
                    Next Page ({nextCategory.number} of {categories.length})
                  </span>
                  <span>{nextCategory.title}</span>
                </div>
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <div />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
