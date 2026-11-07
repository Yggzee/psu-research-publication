import { useState } from "react";
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
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import psuLogo from "../assets/psu-logo.png";
import { getCurrentUser, isAuthenticated } from "../utils/researchStore";
import { useTheme } from "../utils/themeContext";

interface GuideClickItem {
  label: string;
  explanation: string;
}

interface GuideCategory {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  whatYouSee: string[];
  purposeSummary: string;
  clickableItems: GuideClickItem[];
}

const guestGuideCategories: GuideCategory[] = [
  {
    id: "about-system",
    number: 1,
    title: "Welcome to the PSU Asingan Research Portal",
    subtitle: "What this website is and who it is for",
    icon: Compass,
    whatYouSee: [
      "When you visit the Pangasinan State University — Asingan Campus Research Publication Tracking System, you are looking at the official home for all published research works written by our campus researchers.",
      "Everything on this public page is open for students, teachers, accreditors, and visitors to read and explore without needing an account.",
    ],
    purposeSummary:
      "This portal gathers all published studies from our campus in one organized place so anyone can discover what our researchers have studied, how many times their work has been cited by other scholars around the world, and how our campus contributes to the United Nations Sustainable Development Goals.",
    clickableItems: [
      {
        label: "Top-Left Summary Counter (Publications • Citations • Researchers)",
        explanation:
          "Shows the live total of verified campus publications, the combined number of times those publications have been cited, and the total number of registered researchers on campus.",
      },
      {
        label: "Sign In Button (Top-Right Corner)",
        explanation:
          "Takes registered PSU Asingan researchers and the Research Coordinator to the Sign In screen so they can manage their publications.",
      },
    ],
  },
  {
    id: "public-search",
    number: 2,
    title: "Public Search & Institutional Repository",
    subtitle: "Finding and reading published works from PSU Asingan",
    icon: Search,
    whatYouSee: [
      "In the center of the page, you will see a large search bar with two search modes right above it: 'PSU Repository (Verified)' and 'Global Academic Search'.",
      "Below the search bar, you will see filter menus for UN Sustainable Development Goals (SDG), Department, Publication Year, and Sorting order, followed by the 'Most Cited Institutional Works' highlight cards and the complete list of campus publications.",
    ],
    purposeSummary:
      "Each part of this page is designed to help you quickly find a specific study—whether you know the title, the researcher's surname, the department, or the community topic it addresses.",
    clickableItems: [
      {
        label: "PSU Repository (Verified) Tab",
        explanation:
          "Searches only the official, verified publications authored by PSU Asingan researchers.",
      },
      {
        label: "Global Academic Search Tab",
        explanation:
          "Lets you search worldwide academic libraries for broader literature, while automatically highlighting works from Pangasinan State University and the Philippines first.",
      },
      {
        label: "Filter Dropdowns (SDG Goal, Department, Year, Sort By)",
        explanation:
          "Narrows down the list of publications immediately. For example, you can pick 'SDG 4: Quality Education' or a specific year to see only matching publications.",
      },
      {
        label: "Publication Title Link or 'Read Source' Button",
        explanation:
          "Opens the original journal page or full article in a new browser tab so you can read the complete study.",
      },
      {
        label: "Previous / Page Numbers / Next Buttons (Bottom of List)",
        explanation:
          "Moves between pages of search results, showing 10 publications at a time.",
      },
    ],
  },
  {
    id: "signin-invitation",
    number: 3,
    title: "Signing In & Asking for an Invitation",
    subtitle: "How PSU Asingan researchers get their own account",
    icon: LogIn,
    whatYouSee: [
      "When you click 'Sign In' at the top right, you arrive at the Researcher Access screen. On the left is the Pangasinan State University welcome banner, and on the right is the Sign In form.",
      "At the bottom of the Sign In form, there is a link that says 'Ask for Invitation' for PSU Asingan researchers who do not have an account yet.",
    ],
    purposeSummary:
      "To keep campus records accurate, accounts are by invitation only. If you are a PSU Asingan researcher, you can either sign in with your existing credentials or send a quick request to Research Coordinator Sir Rodelio M. Garin.",
    clickableItems: [
      {
        label: "Back to Public Search Link",
        explanation:
          "Returns you to the public search page if you just want to browse publications without signing in.",
      },
      {
        label: "Email or Username & Password Fields + 'Sign In' Button",
        explanation:
          "Lets registered researchers and the Research Coordinator enter their credentials to open their personal workspace.",
      },
      {
        label: "'Ask for Invitation' Link",
        explanation:
          "Opens a simple request form where a PSU Asingan researcher can enter their First Name, Last Name, Email Address, and the 5 numbers of their Instructor ID (ASIN-00000). The 'ASIN-' part is already filled in for you—you only type your 5 digits.",
      },
      {
        label: "'Submit Request' Button (Inside Ask for Invitation)",
        explanation:
          "Sends your request directly to Research Coordinator Sir Rodelio M. Garin. Once he approves it, you will receive an email with a button to set your password and activate your account.",
      },
    ],
  },
];

const researcherGuideCategories: GuideCategory[] = [
  {
    id: "my-publications",
    number: 1,
    title: "My Publications",
    subtitle: "Your personal home screen for viewing and adding your published research",
    icon: FileText,
    whatYouSee: [
      "As soon as you sign in as a Researcher, you arrive at 'My Publications'. At the top, you see summary cards showing how many published works you have, how many awaiting-approval claims you have submitted, and the total publications across the campus.",
      "Below the summary cards, you see two tabs—'My Published Research' and 'Institutional Repository'—along with a search bar, a year filter, and your list of publications.",
    ],
    purposeSummary:
      "This page is your personal academic portfolio. It keeps all of your published research organized in one place and lets you browse what your fellow researchers across the campus have published.",
    clickableItems: [
      {
        label: "'Add Publication' Button (Top-Right Corner)",
        explanation:
          "Opens a simple form where you can type in the Title, Co-Authors, Journal or Conference Name, Year, and Link of a published study you authored. When you click Save, it is sent to Research Coordinator Sir Rodelio M. Garin for verification.",
      },
      {
        label: "Tab 1: 'My Published Research'",
        explanation:
          "Shows only the publications that belong to you, along with their approval status ('Approved' or 'Pending Approval').",
      },
      {
        label: "Tab 2: 'Institutional Repository'",
        explanation:
          "Lets you view all verified publications from every researcher in PSU Asingan without leaving your page.",
      },
      {
        label: "Clicking Any Publication Row or 'View Details'",
        explanation:
          "Opens the full details of that publication, including its abstract, citation count, United Nations Sustainable Development Goal tags, and a link to the journal.",
      },
    ],
  },
  {
    id: "search",
    number: 2,
    title: "Search",
    subtitle: "Finding your published works online and claiming them into your profile",
    icon: Search,
    whatYouSee: [
      "At the top of the Search page is a wide search bar where you can type your surname, a publication title, or 'Pangasinan State University'.",
      "When results appear below, each card shows the publication's title, authors, publication year, journal name, citation count, and an 'Assign Researcher' bar at the bottom of the card.",
    ],
    purposeSummary:
      "Instead of typing your publication details by hand, you can use the Search page to find your already-published studies from online academic libraries and claim them as yours in just two clicks.",
    clickableItems: [
      {
        label: "Search Bar & 'Search' Button",
        explanation:
          "Searches online academic libraries for published studies matching the title, author name, or topic you typed.",
      },
      {
        label: "Publication Title Link & 'PDF' Badge",
        explanation:
          "Clicking the title opens the original online source in a new tab; clicking 'PDF' opens the full printable article if available.",
      },
      {
        label: "'Assign Researcher' Dropdown (Bottom of Each Result Card)",
        explanation:
          "Lets you select your own name ('Assign to Myself') before claiming a publication.",
      },
      {
        label: "'Claim & Request Approval' Button",
        explanation:
          "Submits the publication under your name and forwards it to Research Coordinator Sir Rodelio M. Garin. Once he approves it, it automatically appears in your 'My Published Research' list.",
      },
      {
        label: "Previous / Page Numbers / Next Buttons",
        explanation:
          "Moves through additional pages of search results, 10 publications at a time.",
      },
    ],
  },
  {
    id: "researchers",
    number: 3,
    title: "Researchers",
    subtitle: "Exploring the directory of PSU Asingan researchers and their profiles",
    icon: Users,
    whatYouSee: [
      "On the Researchers page, you see a directory of all registered PSU Asingan researchers. Each researcher's card displays their photo, full name, Instructor ID, number of publications, and total citations.",
      "This is also the only place in the system where you will see each person's classification badge: either 'Faculty (Department)'—such as 'Faculty (BSIT)' or 'Faculty (BSBA)'—or 'Non-Faculty', plus 'Research Coordinator' for Sir Rodelio M. Garin.",
    ],
    purposeSummary:
      "This page helps you get to know your fellow campus researchers, see which departments are publishing, and explore each colleague's body of work.",
    clickableItems: [
      {
        label: "Search Bar & Department Filter Dropdown",
        explanation:
          "Lets you find a colleague by typing their name or filtering by their department (such as BSIT, BSBA, BSE, BEE, BTLED, BIT, or Non-Faculty).",
      },
      {
        label: "'All Researchers' vs. 'By Department' View Buttons",
        explanation:
          "Switches between viewing everyone in a single grid or grouping researchers neatly under their respective departments.",
      },
      {
        label: "Clicking Any Researcher Card",
        explanation:
          "Opens that researcher's complete profile page, where you can see their biography, academic metrics, citation trends, and every publication they have authored.",
      },
    ],
  },
  {
    id: "sdg-radar",
    number: 4,
    title: "SDG Radar",
    subtitle: "Seeing how campus publications support the 17 United Nations Goals",
    icon: Target,
    whatYouSee: [
      "The SDG Radar page displays a visual radar chart alongside cards for the 17 United Nations Sustainable Development Goals (such as Quality Education, Good Health and Well-being, Climate Action, and Decent Work).",
      "Each goal card shows how many campus publications contribute to that specific global goal.",
    ],
    purposeSummary:
      "Universities are evaluated on how their research helps solve real-world community and global problems. This page shows at a glance which United Nations goals our campus publications support the most.",
    clickableItems: [
      {
        label: "Clicking Any of the 17 SDG Goal Cards",
        explanation:
          "Filters the list below to show the exact campus publications that support that goal, along with a short explanation of why each study matches that goal.",
      },
    ],
  },
  {
    id: "ask-campus-ai",
    number: 5,
    title: "Ask Campus AI",
    subtitle: "Your friendly research assistant for instant answers about campus publications",
    icon: Sparkles,
    whatYouSee: [
      "You can open Ask Campus AI either from the left menu ('Ask Campus AI') or by clicking the floating assistant icon in the bottom-right corner of any page.",
      "You will see a conversation window with ready-made question buttons and a message box at the bottom.",
    ],
    purposeSummary:
      "Instead of manually counting publications or searching through tables, you can ask everyday questions in plain English or Tagalog—such as 'Who has the most citations in BSIT?' or 'Which publications focus on education?'—and get an instant, accurate answer based on our campus records.",
    clickableItems: [
      {
        label: "Suggested Question Buttons",
        explanation:
          "One-click starter questions you can press to immediately see what the assistant can do.",
      },
      {
        label: "Message Box & Send Button",
        explanation:
          "Type any question about PSU Asingan researchers, publications, citations, or departments and press Enter or Send.",
      },
      {
        label: "'New Chat' or 'Clear History' Button",
        explanation:
          "Starts a fresh conversation whenever you want to ask about a new topic.",
      },
    ],
  },
  {
    id: "profile-and-settings",
    number: 6,
    title: "My Profile & Settings",
    subtitle: "Managing your personal details, password, and screen appearance",
    icon: User,
    whatYouSee: [
      "At the bottom-left of the navigation menu (or by clicking your name in the top-right header), you will find 'My Profile' and 'Settings'.",
      "'My Profile' displays your photo, name, Instructor ID, department, and Google Scholar link. 'Settings' contains tabs for Appearance & Theme, Security & Password, and Display Preferences.",
    ],
    purposeSummary:
      "These pages let you keep your researcher information up to date, change your password for security, and adjust how the system looks on your computer or phone.",
    clickableItems: [
      {
        label: "'Upload Photo' & 'Save Profile' Buttons (My Profile)",
        explanation:
          "Lets you update your profile picture, Google Scholar profile link, and contact details.",
      },
      {
        label: "'Sync My Publications' Button (My Profile)",
        explanation:
          "If you have linked your Google Scholar profile, clicking this button automatically checks for your latest published works.",
      },
      {
        label: "Light Mode / Dark Mode / System Default Cards (Settings -> Appearance)",
        explanation:
          "Switches the colors of the entire system between bright daylight mode and dark mode that is gentler on the eyes at night.",
      },
      {
        label: "'Update Password' Button (Settings -> Security & Password)",
        explanation:
          "Lets you change your sign-in password anytime.",
      },
      {
        label: "Compact vs. Standard Buttons (Settings -> Display Preferences)",
        explanation:
          "Adjusts the spacing of rows in tables depending on whether you prefer seeing more items at once or larger spacing.",
      },
    ],
  },
];

const coordinatorGuideCategories: GuideCategory[] = [
  {
    id: "dashboard",
    number: 1,
    title: "Dashboard",
    subtitle: "Your executive overview of PSU Asingan's entire research performance",
    icon: LayoutDashboard,
    whatYouSee: [
      "When you sign in as Research Coordinator, the Dashboard greets you with four top summary cards: Total Publications, Total Citations, Registered Researchers, and Campus H-Index.",
      "Below the summary cards, you see visual charts showing publication growth year by year, publication counts by department, a list of the most-cited publications on campus, and recent activity.",
    ],
    purposeSummary:
      "The Dashboard gives you an instant snapshot of how the campus is performing as a whole—helping you spot trends, see which departments are active, and jump straight to common tasks.",
    clickableItems: [
      {
        label: "Top Summary Cards (Publications, Citations, Researchers, Impact)",
        explanation:
          "Displays live campus totals. Clicking on the Researchers or Publications cards takes you directly to those directories.",
      },
      {
        label: "Year & Department Filters on Charts",
        explanation:
          "Lets you adjust the time range or focus on a specific department to see how their output changed over the years.",
      },
      {
        label: "Top-Cited Publications List",
        explanation:
          "Clicking any publication in the highlight list opens its full details.",
      },
    ],
  },
  {
    id: "search",
    number: 2,
    title: "Search",
    subtitle: "Finding published works online and assigning them directly to researchers",
    icon: Search,
    whatYouSee: [
      "At the top of the Search page is a wide search bar where you can search by publication title, researcher name, or institution.",
      "Each result card shows the study's title, authors, year, journal, citation count, geographical badge (Pangasinan State University, Philippines Research, or International Literature), and an 'Assign Researcher' bar at the bottom.",
    ],
    purposeSummary:
      "As Research Coordinator, the Search page lets you look up published studies across academic libraries and save them directly to any registered researcher's profile without needing a separate approval step.",
    clickableItems: [
      {
        label: "Search Bar & 'Search' Button",
        explanation:
          "Finds published works from online academic libraries matching the words you typed.",
      },
      {
        label: "'Assign Researcher' Dropdown (Bottom of Each Result Card)",
        explanation:
          "Shows a list of all registered PSU Asingan researchers with their Instructor ID (ASIN-00000). Pick the researcher who authored the study.",
      },
      {
        label: "'Save to Repository' Button",
        explanation:
          "Immediately saves the publication into the official campus repository under the selected researcher's name.",
      },
      {
        label: "'Scraper Settings / Quota' Button (Top-Right Corner)",
        explanation:
          "Lets you view the remaining monthly search allowance for backup online searches.",
      },
    ],
  },
  {
    id: "researchers",
    number: 3,
    title: "Researchers",
    subtitle: "Viewing all registered campus researchers and their Faculty or Non-Faculty marks",
    icon: Users,
    whatYouSee: [
      "The Researchers page displays every registered researcher at PSU Asingan. Each card shows the person's photo, name, Instructor ID, publication count, and total citations.",
      "This page (and each individual's profile) is the dedicated place where you see whether a researcher is marked as 'Faculty (Department)'—for example, 'Faculty (BSIT)'—or 'Non-Faculty', as well as your 'Research Coordinator' badge.",
    ],
    purposeSummary:
      "Gives you a clean directory to browse researchers across all programs, compare publication counts, and open any individual researcher's portfolio.",
    clickableItems: [
      {
        label: "Search Box, Department Dropdown, and Sort Menu",
        explanation:
          "Lets you search by name, filter by department (BSIT, BSBA, BSE, BEE, BTLED, BIT, or Non-Faculty), or sort by Most Publications or Most Citations.",
      },
      {
        label: "'All Researchers' vs. 'By Department' Toggle",
        explanation:
          "Switches between a single grid of cards and a grouped view organized by department.",
      },
      {
        label: "Clicking Any Researcher Card",
        explanation:
          "Opens that researcher's profile page showing all of their publications, co-authors, and citation history.",
      },
    ],
  },
  {
    id: "publications",
    number: 4,
    title: "Publications",
    subtitle: "Inspecting, sorting, and managing all verified publications in the campus repository",
    icon: FileText,
    whatYouSee: [
      "The Publications page shows the complete master list of verified campus publications. You can view them as a compact Table or as visual Cards.",
      "Above the list, you have a search box, an 'All Researchers' filter, an 'All Years' filter, and a Sort dropdown.",
    ],
    purposeSummary:
      "This is your master catalog of every published work on campus. You can filter by researcher or year, copy formatted citations, automatically tag United Nations goals, or click any publication to inspect and edit its details.",
    clickableItems: [
      {
        label: "'Table' and 'Cards' View Switch (Top-Right Corner)",
        explanation:
          "Switches the display between a spreadsheet-style table and a two-column card layout.",
      },
      {
        label: "'Auto-Tag SDGs' Button (Top-Right Corner)",
        explanation:
          "Automatically reads any untagged publications and assigns the matching United Nations Sustainable Development Goals to them.",
      },
      {
        label: "Column Headers (Publication Title, Registered Researcher, Authors, Year, Citations, UN SDG Goal)",
        explanation:
          "Click any column title in Table view to sort the entire list alphabetically, by year, or by highest citations.",
      },
      {
        label: "Checkboxes & Floating Action Bar ('Copy APA Citations')",
        explanation:
          "Check the box next to one or more publications to open a bottom bar that copies ready-to-paste APA citations to your clipboard.",
      },
      {
        label: "Clicking Any Publication Row or Card",
        explanation:
          "Opens a side panel where you can read the abstract, view citing studies, edit the publication's details, or remove a duplicate entry.",
      },
    ],
  },
  {
    id: "impact-analysis",
    number: 5,
    title: "Impact Analysis",
    subtitle: "Understanding citation growth, department reach, and research influence",
    icon: TrendingUp,
    whatYouSee: [
      "The Impact Analysis page presents visual charts tracking how many citations campus publications receive over time, how impact is distributed across departments, and which publications have gained the strongest academic reach.",
    ],
    purposeSummary:
      "Helps the Research Coordinator measure not just how many studies were published, but how widely those studies are being read and cited by other researchers.",
    clickableItems: [
      {
        label: "Department & Timeframe Filters",
        explanation:
          "Updates the charts to focus on a specific program or multi-year window.",
      },
      {
        label: "Interactive Chart Bars & Publication Links",
        explanation:
          "Hovering over chart points shows exact numbers for that year or department, and clicking highlighted publications opens their full record.",
      },
    ],
  },
  {
    id: "sdg-radar",
    number: 6,
    title: "SDG Radar",
    subtitle: "Tracking campus alignment with the 17 United Nations Sustainable Development Goals",
    icon: Target,
    whatYouSee: [
      "Shows an overall campus radar chart and 17 cards representing each United Nations Sustainable Development Goal, along with the count of PSU Asingan publications supporting each goal.",
    ],
    purposeSummary:
      "Makes it easy to see our campus's strongest community impact areas and identify goals where future research can be encouraged.",
    clickableItems: [
      {
        label: "17 UN SDG Goal Cards",
        explanation:
          "Click any goal card to view the exact campus publications classified under that goal.",
      },
    ],
  },
  {
    id: "reports",
    number: 7,
    title: "Reports",
    subtitle: "Generating official Excel spreadsheets and printable reports for accreditation",
    icon: FileBarChart,
    whatYouSee: [
      "The Reports page displays filter controls (Year Range, Department, and Report Type) above a clean preview table of publications and researcher outputs.",
    ],
    purposeSummary:
      "Saves hours of manual paperwork during CHED, AACCUP, or university-wide evaluations by turning campus records into ready-to-submit spreadsheets and printable reports.",
    clickableItems: [
      {
        label: "Department & Year Filter Menus",
        explanation:
          "Lets you choose whether to include the entire campus or only a specific department and year range in your report.",
      },
      {
        label: "'Export Excel' Button",
        explanation:
          "Downloads a neatly formatted Excel file (.xlsx) containing the filtered publications and researcher details.",
      },
      {
        label: "'Print / Save PDF' Button",
        explanation:
          "Opens a clean, printer-ready version of the report that you can print on paper or save as a PDF document.",
      },
    ],
  },
  {
    id: "ask-campus-ai",
    number: 8,
    title: "Ask Campus AI",
    subtitle: "Asking plain-language questions about campus research statistics",
    icon: Sparkles,
    whatYouSee: [
      "A conversation page (also accessible via the bottom-right assistant icon) where you can ask questions about campus publications, citations, and researchers.",
    ],
    purposeSummary:
      "Gives you quick answers and summaries during meetings or accreditation reviews without having to filter multiple tables manually.",
    clickableItems: [
      {
        label: "Suggested Prompts & Question Box",
        explanation:
          "Click a suggested question or type your own question in English or Tagalog to get an immediate summary.",
      },
    ],
  },
  {
    id: "admin-console",
    number: 9,
    title: "Admin Console",
    subtitle: "Your command center for approvals, researcher accounts, and invitations",
    icon: Shield,
    whatYouSee: [
      "At the top of the Admin Console is your Research Coordinator profile card (Sir Rodelio M. Garin) with a single 'Research Coordinator' badge and a 'Sync My Publications' button.",
      "Below that are four summary counters—Total Researchers, Invitation Requests, Pending Activations, and Pending Claims—followed by four management tabs: 'Pending Claims', 'Researchers', 'Invite Researcher', and 'Invitation Requests'.",
    ],
    purposeSummary:
      "Everything related to managing people and approving publications happens here. You control who is invited to the system and which claimed publications become part of the official repository.",
    clickableItems: [
      {
        label: "'Sync My Publications' Button (Coordinator Card)",
        explanation:
          "Checks your linked Google Scholar profile and updates your own published works in one click.",
      },
      {
        label: "Tab 1: 'Pending Claims' (Approve / Reject Buttons)",
        explanation:
          "Shows publications that researchers have claimed or added. Clicking 'Approve' publishes the record to the official repository; clicking 'Reject' declines it.",
      },
      {
        label: "Tab 2: 'Researchers' (Sync Scholar, Edit, and Delete Buttons)",
        explanation:
          "Lists all registered researchers. You can click the refresh icon to sync a researcher's Google Scholar publications, the pencil icon to edit their name, department, or Instructor ID, or the trash icon to remove an account.",
      },
      {
        label: "Tab 3: 'Invite Researcher' Form & 'Send Invitation' Button",
        explanation:
          "Lets you invite a new researcher by entering the 5 digits of their Instructor ID (with 'ASIN-' locked in place as ASIN-00000), their name, email, and whether they are Faculty (with their department) or Non-Faculty. Clicking 'Send Invitation' emails them an activation link.",
      },
      {
        label: "Tab 4: 'Invitation Requests' ('Approve & Pre-Fill' / 'Decline' Buttons)",
        explanation:
          "Shows requests sent by researchers who clicked 'Ask for Invitation' on the sign-in screen. Clicking 'Approve & Pre-Fill' automatically copies their details into the Invite Researcher form so you can send their official invitation in seconds.",
      },
    ],
  },
  {
    id: "profile-and-settings",
    number: 10,
    title: "My Profile & Settings",
    subtitle: "Personalizing your account, theme, password, and cloud backup",
    icon: Settings,
    whatYouSee: [
      "Accessible from the bottom-left sidebar menu, 'My Profile' shows your coordinator details and Google Scholar link, while 'Settings' provides tabs for Appearance & Theme, Security & Password, Display Preferences, and System & Cloud Storage.",
    ],
    purposeSummary:
      "Lets you update your personal profile, switch between Light and Dark mode, change your password, and verify that campus records are safely backed up.",
    clickableItems: [
      {
        label: "Appearance Cards (Light Mode, Dark Mode, System Default)",
        explanation:
          "Changes the visual theme of the system immediately.",
      },
      {
        label: "'Update Password' Button (Security & Password Tab)",
        explanation:
          "Updates your Research Coordinator sign-in password.",
      },
      {
        label: "'Sync Local Tables to Turso Cloud' Button (System & Cloud Storage Tab)",
        explanation:
          "Manually triggers an immediate backup of all researcher accounts and publications to cloud storage.",
      },
    ],
  },
];

export function SystemGuidePage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const loggedIn = isAuthenticated() && Boolean(currentUser);
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Determine the user's natural role view
  const defaultRoleView: "guest" | "researcher" | "coordinator" = !loggedIn
    ? "guest"
    : currentUser?.role === "admin"
    ? "coordinator"
    : "researcher";

  // Allow the Research Coordinator to preview what Researchers or Guests see if desired;
  // Researchers only see the Researcher guide, and Guests only see the Guest guide.
  const [adminPreviewRole, setAdminPreviewRole] = useState<"coordinator" | "researcher" | "guest">("coordinator");

  const activeRoleView =
    defaultRoleView === "coordinator" ? adminPreviewRole : defaultRoleView;

  const categories =
    activeRoleView === "coordinator"
      ? coordinatorGuideCategories
      : activeRoleView === "researcher"
      ? researcherGuideCategories
      : guestGuideCategories;

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* ---------------------------------------------------- */}
      {/* TOP INSTITUTIONAL HEADER (KEPT CONSISTENT)           */}
      {/* ---------------------------------------------------- */}
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: PSU Brand */}
          <div
            onClick={() => navigate(loggedIn ? "/dashboard" : "/")}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <img src={psuLogo} alt="PSU Logo" className="w-10 h-10 object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-foreground tracking-tight group-hover:text-brand transition-colors">
                  PSU Asingan Research Portal
                </h1>
                <Badge variant="outline" className="text-[10px] font-semibold border-brand/40 text-brand bg-brand/5">
                  About & Visual Guide
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pangasinan State University — Asingan Campus
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

      {/* ---------------------------------------------------- */}
      {/* HERO BANNER                                          */}
      {/* ---------------------------------------------------- */}
      <section className="border-b border-border/60 bg-gradient-to-b from-blue-50/70 via-background to-background dark:from-blue-950/20 dark:via-background dark:to-background py-8 sm:py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-xs font-semibold">
            <BookOpen className="w-3.5 h-3.5" />
            <span>
              {activeRoleView === "coordinator"
                ? "Research Coordinator Edition (Complete System Walkthrough)"
                : activeRoleView === "researcher"
                ? "Researcher Edition (Your Personal Workspace Guide)"
                : "Public Visitor & New Researcher Guide"}
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2 max-w-3xl">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                How to Use the PSU Asingan Research Portal
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Welcome! This guide walks you through every screen, section, and clickable button in plain, everyday language—so you always know what you are looking at and what happens when you click any link.
              </p>
            </div>

            {/* Coordinator-Only Preview Switcher */}
            {defaultRoleView === "coordinator" && (
              <div className="flex flex-col gap-1.5 shrink-0">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  Coordinator View Switcher:
                </span>
                <div className="inline-flex rounded-xl border border-border/80 bg-card p-1 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setAdminPreviewRole("coordinator")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      adminPreviewRole === "coordinator"
                        ? "bg-brand text-white shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Coordinator Guide
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminPreviewRole("researcher")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      adminPreviewRole === "researcher"
                        ? "bg-brand text-white shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Researcher Guide
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminPreviewRole("guest")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      adminPreviewRole === "guest"
                        ? "bg-brand text-white shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Guest Guide
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- */}
      {/* MAIN CONTENT: TABLE OF CONTENTS + NARRATIVE CARDS    */}
      {/* ---------------------------------------------------- */}
      <main className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Sticky Table of Contents */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24">
            <Card className="border-border/70 shadow-xs">
              <CardHeader className="pb-3 border-b border-border/60">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-brand" />
                  <span>Topics in This Guide ({categories.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2.5 space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => scrollToSection(cat.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer group"
                  >
                    <span className="w-6 h-6 rounded-lg bg-brand/10 text-brand font-bold text-[11px] flex items-center justify-center shrink-0 group-hover:bg-brand group-hover:text-white transition-colors">
                      {cat.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{cat.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{cat.subtitle}</p>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>
          </aside>

          {/* Right Narrative Sections */}
          <div className="lg:col-span-8 space-y-8">
            {categories.map((cat) => {
              const IconComponent = cat.icon;
              return (
                <section
                  key={cat.id}
                  id={cat.id}
                  className="scroll-mt-24"
                >
                  <Card className="border-border/70 shadow-xs overflow-hidden">
                    {/* Category Header */}
                    <div className="bg-muted/30 border-b border-border/60 px-5 sm:px-6 py-4 flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-brand">
                            Section {cat.number}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-foreground leading-snug">
                          {cat.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">{cat.subtitle}</p>
                      </div>
                    </div>

                    <CardContent className="p-5 sm:p-6 space-y-6">
                      {/* Part 1: What Do You See & Purpose */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
                          <Eye className="w-4 h-4" />
                          <span>What You See on This Page & Its Purpose</span>
                        </div>

                        <div className="space-y-2.5 text-xs sm:text-sm text-foreground/90 leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/50">
                          {cat.whatYouSee.map((paragraph, idx) => (
                            <p key={idx}>{paragraph}</p>
                          ))}
                          <p className="pt-1 font-medium text-foreground border-t border-border/50 mt-2">
                            <strong className="text-brand">Why this matters: </strong>
                            {cat.purposeSummary}
                          </p>
                        </div>
                      </div>

                      {/* Part 2: Every Clickable Link & Button Explained */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                          <MousePointerClick className="w-4 h-4" />
                          <span>What Every Clickable Button & Link Does</span>
                        </div>

                        <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card overflow-hidden">
                          {cat.clickableItems.map((item, idx) => (
                            <div key={idx} className="p-3.5 sm:p-4 space-y-1 hover:bg-muted/20 transition-colors">
                              <div className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                <p className="text-xs sm:text-sm font-bold text-foreground">
                                  {item.label}
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                                {item.explanation}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              );
            })}
          </div>
        </div>
      </main>

      {/* ---------------------------------------------------- */}
      {/* FOOTER                                               */}
      {/* ---------------------------------------------------- */}
      <footer className="border-t border-border/60 bg-muted/20 py-6 px-4 sm:px-6 mt-12 text-center text-xs text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground">
          Pangasinan State University — Asingan Campus Research Publication Tracking System
        </p>
        <p className="text-[11px]">
          Need additional assistance? Contact Research Coordinator Sir Rodelio M. Garin.
        </p>
      </footer>
    </div>
  );
}

