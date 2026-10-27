import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  LayoutDashboard,
  Search,
  Users,
  FileText,
  TrendingUp,
  FileBarChart,
  Sparkles,
  Network,
  Target,
  Bot,
  Sun,
  Moon,
  Shield,
  Layers,
  Settings,
  User,
  History,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "./ui/command";
import { useTheme } from "../utils/themeContext";
import { apiService } from "../services/api.service";
import { toast } from "sonner";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [researchers, setResearchers] = useState<Array<{ id: string; name: string; department: string }>>([]);

  useEffect(() => {
    if (open) {
      apiService.getResearchers().then((res) => {
        if (Array.isArray(res)) {
          setResearchers(res.slice(0, 10));
        }
      }).catch(() => {});
    }
  }, [open]);

  const handleSelect = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  const runBatchClassify = async () => {
    toast.loading("Running Gemini Flash UN SDG Classifier on campus research...", { id: "batch-sdg" });
    try {
      const res = await apiService.batchClassifySDG();
      toast.success(`Successfully classified ${res.processed} publications into UN SDGs!`, { id: "batch-sdg" });
      navigate("/dashboard/sdg-matrix");
    } catch (err: any) {
      toast.error(`Auto-classification error: ${err.message}`, { id: "batch-sdg" });
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="PSU Research Command Center">
      <CommandInput placeholder="Type a command, faculty name, or research topic..." />
      <CommandList className="max-h-[380px]">
        <CommandEmpty>No results found.</CommandEmpty>

        {/* AI & Institutional Quick Actions */}
        <CommandGroup heading="⚡ AI & Institutional Tools">
          <CommandItem
            onSelect={() =>
              handleSelect(() => {
                window.dispatchEvent(new CustomEvent("open-ask-ai-bubble"));
              })
            }
            className="cursor-pointer"
          >
            <Bot className="mr-2 h-4 w-4 text-emerald-600" />
            <span>Ask Campus AI Assistant (Help Bubble)</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => navigate("/dashboard/ai-history"))}
            className="cursor-pointer"
          >
            <History className="mr-2 h-4 w-4 text-emerald-600" />
            <span>Campus AI Chat History & Inquiries</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(() => navigate("/dashboard/sdg-matrix"))}
            className="cursor-pointer"
          >
            <Target className="mr-2 h-4 w-4 text-emerald-600" />
            <span>UN SDG Impact Radar & Research Evidence Directory</span>
          </CommandItem>
          <CommandItem
            onSelect={() => handleSelect(runBatchClassify)}
            className="cursor-pointer"
          >
            <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
            <span>Batch Auto-Tag All Publications with UN SDGs (Gemini Flash)</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* Navigation */}
        <CommandGroup heading="📍 Navigation">
          <CommandItem onSelect={() => handleSelect(() => navigate("/dashboard"))}>
            <LayoutDashboard className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Executive Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/dashboard/search-engine"))}>
            <Search className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Scholar Search & Paper Claim Engine</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/dashboard/publications"))}>
            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Publications Repository (Dense Table & Kanban)</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/dashboard/researchers"))}>
            <Users className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Faculty Researchers Directory</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/dashboard/impact"))}>
            <TrendingUp className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Citations & Impact Analytics</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/dashboard/reports"))}>
            <FileBarChart className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Accreditation & SUC Leveling Reports</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/dashboard/admin"))}>
            <Shield className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>Institutional Admin Controls</span>
          </CommandItem>
        </CommandGroup>

        {/* Faculty Jump */}
        {researchers.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="👤 Faculty Profiles">
              {researchers.map((r) => (
                <CommandItem
                  key={r.id}
                  onSelect={() => handleSelect(() => navigate(`/dashboard/researcher/${r.id}`))}
                >
                  <User className="mr-2 h-4 w-4 text-blue-500" />
                  <span>{r.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{r.department}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        {/* Preferences */}
        <CommandGroup heading="⚙️ Preferences & Account">
          <CommandItem
            onSelect={() => handleSelect(() => setTheme(theme === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4 text-amber-500" />
            ) : (
              <Moon className="mr-2 h-4 w-4 text-blue-500" />
            )}
            <span>Toggle Theme ({theme === "dark" ? "Switch to Light" : "Switch to Dark"})</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/dashboard/profile"))}>
            <User className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>My Profile</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect(() => navigate("/dashboard/settings"))}>
            <Settings className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>System Settings</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
