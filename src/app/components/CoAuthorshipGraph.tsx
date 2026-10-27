import { useState, useEffect, useRef } from "react";
import {
  Network,
  Users,
  Sparkles,
  RefreshCw,
  Search,
  Zap,
  BookOpen,
  ArrowRight,
  Shield,
  Layers,
  Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  apiService,
  type NetworkGraphResponse,
  type NetworkGraphNode,
  type SynergyCandidate,
  type SynergyMatchResponse,
} from "../services/api.service";
import { DEPARTMENT_COLORS } from "../utils/chartUtils";
import { useTheme } from "../utils/themeContext";
import { toast } from "sonner";

export function CoAuthorshipGraph() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [data, setData] = useState<NetworkGraphResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<NetworkGraphNode | null>(null);
  const [activeSynergy, setActiveSynergy] = useState<SynergyMatchResponse | null>(null);
  const [isGeneratingSynergy, setIsGeneratingSynergy] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<SynergyCandidate | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const nodesRef = useRef<Array<NetworkGraphNode & { x: number; y: number; vx: number; vy: number; radius: number }>>([]);
  const draggedNodeRef = useRef<any>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const graphData = await apiService.getNetworkGraph();
      setData(graphData);
    } catch (err: any) {
      toast.error(`Failed to load network graph: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Initialize Canvas simulation
  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Position nodes radially or randomly around center
    const simNodes = data.nodes.map((n, i) => {
      const angle = (i / Math.max(1, data.nodes.length)) * 2 * Math.PI;
      const dist = 120 + Math.random() * 80;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * dist,
        y: height / 2 + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: Math.max(18, Math.min(34, 18 + (n.publications || 0) * 2.5)),
      };
    });

    nodesRef.current = simNodes;

    // Simple physical force simulation loop
    const tick = () => {
      // 1. Center attraction
      simNodes.forEach((n) => {
        n.vx += (width / 2 - n.x) * 0.003;
        n.vy += (height / 2 - n.y) * 0.003;
      });

      // 2. Node repulsion
      for (let i = 0; i < simNodes.length; i++) {
        for (let j = i + 1; j < simNodes.length; j++) {
          const a = simNodes[i];
          const b = simNodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          const minDist = a.radius + b.radius + 40;
          if (dist < minDist) {
            const force = (minDist - dist) / dist * 0.05;
            a.vx -= dx * force;
            a.vy -= dy * force;
            b.vx += dx * force;
            b.vy += dy * force;
          }
        }
      }

      // 3. Link spring attraction
      data.links.forEach((l) => {
        const s = simNodes.find((n) => n.id === l.source);
        const t = simNodes.find((n) => n.id === l.target);
        if (s && t) {
          const dx = t.x - s.x;
          const dy = t.y - s.y;
          const dist = Math.hypot(dx, dy) || 1;
          const targetDist = 90;
          const force = (dist - targetDist) * 0.005;
          s.vx += dx * force;
          s.vy += dy * force;
          t.vx -= dx * force;
          t.vy -= dy * force;
        }
      });

      // Update positions
      simNodes.forEach((n) => {
        if (draggedNodeRef.current?.id === n.id) return;
        n.vx *= 0.88; // Damping
        n.vy *= 0.88;
        n.x += n.vx;
        n.y += n.vy;

        // Contain in bounds
        n.x = Math.max(n.radius + 10, Math.min(width - n.radius - 10, n.x));
        n.y = Math.max(n.radius + 10, Math.min(height - n.radius - 10, n.y));
      });

      // Draw
      ctx.clearRect(0, 0, width, height);

      // Draw Links
      data.links.forEach((l) => {
        const s = simNodes.find((n) => n.id === l.source);
        const t = simNodes.find((n) => n.id === l.target);
        if (s && t) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(t.x, t.y);
          ctx.strokeStyle = isDark ? "rgba(59, 130, 246, 0.4)" : "rgba(37, 99, 235, 0.3)";
          ctx.lineWidth = Math.min(6, 1 + l.weight * 1.5);
          ctx.stroke();
        }
      });

      // Draw Nodes
      simNodes.forEach((n) => {
        const isSelected = selectedNode?.id === n.id;
        const color = (DEPARTMENT_COLORS as Record<string, string>)[n.department] || "#3b82f6";

        // Outer glow
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
          ctx.fillStyle = isDark ? "rgba(255,255,255,0.2)" : "rgba(59, 130, 246, 0.25)";
          ctx.fill();
        }

        // Main node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = isSelected ? 3 : 2;
        ctx.strokeStyle = isDark ? "#1f2937" : "#ffffff";
        ctx.stroke();

        // Node label
        ctx.fillStyle = isDark ? "#f3f4f6" : "#111827";
        ctx.font = isSelected ? "bold 12px sans-serif" : "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(n.name.split(" ")[0] || n.name, n.x, n.y + n.radius + 14);
      });

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [data, isDark, selectedNode]);

  // Canvas Mouse Interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = nodesRef.current.find((n) => Math.hypot(n.x - x, n.y - y) <= n.radius);
    if (hit) {
      draggedNodeRef.current = hit;
      setSelectedNode(hit);
    } else {
      setSelectedNode(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!draggedNodeRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    draggedNodeRef.current.x = e.clientX - rect.left;
    draggedNodeRef.current.y = e.clientY - rect.top;
  };

  const handleMouseUp = () => {
    draggedNodeRef.current = null;
  };

  // Run Synergy Matchmaking
  const handleGenerateSynergy = async (candidate: SynergyCandidate) => {
    setSelectedCandidate(candidate);
    setIsGeneratingSynergy(true);
    toast.loading("Generating AI Interdisciplinary Research Proposal with Gemini...", { id: "synergy-gen" });
    try {
      const result = await apiService.calculateSynergy(candidate.researcherA.id, candidate.researcherB.id);
      setActiveSynergy(result);
      toast.success("AI Joint Research Proposal Generated!", { id: "synergy-gen" });
    } catch (err: any) {
      toast.error(`Synergy error: ${err.message}`, { id: "synergy-gen" });
    } finally {
      setIsGeneratingSynergy(false);
    }
  };

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Network className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Co-Authorship Network & Synergy Engine
              </h1>
              <p className="text-sm text-muted-foreground">
                Force-directed network visualization and AI interdisciplinary collaboration matchmaker
              </p>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={isLoading}
          className="text-xs h-9 gap-1.5 self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Recalculate Network
        </Button>
      </div>

      {/* Main Graph & Matchmaker Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Interactive Canvas (8 cols) */}
        <Card className="lg:col-span-8 border-border/60 shadow-xs flex flex-col overflow-hidden">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Interactive Collaboration Graph</CardTitle>
              <CardDescription className="text-xs">
                Drag nodes to inspect faculty clusters • Blue lines indicate co-authored publications
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {data?.nodes?.length || 0} Faculty • {data?.links?.length || 0} Links
            </Badge>
          </CardHeader>
          <CardContent className="p-0 flex-1 relative bg-gray-50/50 dark:bg-muted/10 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={750}
              height={520}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="cursor-grab active:cursor-grabbing w-full h-[520px]"
            />

            {/* Floating Node Inspector */}
            {selectedNode && (
              <div className="absolute bottom-4 left-4 p-4 rounded-xl bg-white/95 dark:bg-card/95 border border-border shadow-xl backdrop-blur-md max-w-xs space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-sm">{selectedNode.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {selectedNode.department}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground pt-1">
                  <span><strong>{selectedNode.publications}</strong> Publications</span>
                  <span><strong>{selectedNode.citations}</strong> Citations</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Interdisciplinary Synergy Matchmaker (4 cols) */}
        <div className="lg:col-span-4 space-y-6 flex flex-col">
          <Card className="border-border/60 shadow-xs flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                <CardTitle className="text-base font-bold">Interdisciplinary Synergy Radar</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Recommended cross-department faculty pairings predicted to yield high-impact joint research
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 flex-1 overflow-y-auto max-h-[500px]">
              {data?.synergyCandidates && data.synergyCandidates.length > 0 ? (
                data.synergyCandidates.map((candidate, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl border border-border/60 bg-white dark:bg-card hover:border-blue-400 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <Badge className="bg-blue-600/10 text-blue-700 dark:text-blue-400 font-mono text-[11px] font-bold">
                        {candidate.potentialScore}% Synergy Match
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleGenerateSynergy(candidate)}
                        disabled={isGeneratingSynergy}
                        className="h-7 text-xs text-blue-600 hover:text-blue-700 gap-1 p-1"
                      >
                        <Zap className="h-3 w-3" />
                        AI Proposal
                      </Button>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <span>{candidate.researcherA.name}</span>
                        <span className="text-muted-foreground font-normal">({candidate.researcherA.department})</span>
                      </div>
                      <div className="text-muted-foreground font-bold text-center text-[10px]">✕</div>
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <span>{candidate.researcherB.name}</span>
                        <span className="text-muted-foreground font-normal">({candidate.researcherB.department})</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Add more faculty researchers to generate cross-department synergy recommendations!
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active AI Proposal Modal / Card */}
          {activeSynergy && selectedCandidate && (
            <Card className="border-blue-500/40 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 shadow-md">
              <CardHeader className="pb-2">
                <Badge className="bg-emerald-600 text-white w-fit text-[10px] font-mono">
                  {activeSynergy.synergyScore}% Convergence Potential
                </Badge>
                <CardTitle className="text-sm font-bold text-foreground pt-1">
                  Proposed: {activeSynergy.proposedTitle}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-foreground/90 space-y-2">
                <p className="italic leading-relaxed">
                  "{activeSynergy.rationale}"
                </p>
                <div className="pt-2 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 gap-1"
                    onClick={() => {
                      navigator.clipboard.writeText(`Proposal: ${activeSynergy.proposedTitle}\nRationale: ${activeSynergy.rationale}`);
                      toast.success("Copied proposed joint concept to clipboard!");
                    }}
                  >
                    Copy Proposal Concept
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
