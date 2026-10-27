import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft,
  User,
  FileText,
  Quote,
  ChevronRight,
  GraduationCap,
  ExternalLink,
  Shield,
  Building,
  BarChart3,
} from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { getFacultyPhoto, isPSUPaper, hasExternalCollaborators, categorizeAuthors } from "../utils/facultyUtils";
import { apiService } from "../services/api.service";
import { PageHeader, StatCard, StatusBadge, EmptyState } from "./common";

type SortOption = "year" | "citations" | "journal";

export function ResearcherProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>("year");
  const [researcher, setResearcher] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResearcher() {
      if (!id) return;
      setLoading(true);
      try {
        const data = await apiService.getResearcherById(id);
        setResearcher(data);
      } catch (err) {
        console.warn("Failed to load researcher profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadResearcher();
  }, [id]);

  const sortedPublications = useMemo(() => {
    if (!researcher || !researcher.publications) return [];

    return [...researcher.publications].sort((a, b) => {
      if (sortBy === "year") {
        return (b.year || 0) - (a.year || 0);
      } else if (sortBy === "citations") {
        return (b.citations || 0) - (a.citations || 0);
      } else {
        return (a.journal || "").localeCompare(b.journal || "");
      }
    });
  }, [researcher, sortBy]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/researchers")} className="text-xs gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Faculty Roster
        </Button>
        <Card className="border-border/60">
          <CardContent className="p-12 text-center text-muted-foreground text-xs">
            <p>Loading researcher profile from database...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!researcher) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/researchers")} className="text-xs gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Faculty Roster
        </Button>
        <EmptyState
          icon={User}
          title="Researcher Not Found"
          description="The requested researcher could not be found in institutional records."
          actionLabel="View All Faculty"
          onAction={() => navigate("/dashboard/researchers")}
        />
      </div>
    );
  }

  const facultyPhoto = getFacultyPhoto(researcher.name) || researcher.photoUrl;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      {/* 1. Page Header with Back Action */}
      <PageHeader
        title={researcher.name}
        description={`${researcher.department} • Pangasinan State University, Asingan Campus`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/dashboard/researchers")}
              className="text-xs h-8 gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Roster</span>
            </Button>
            {researcher.scholarUrl && (
              <Button size="sm" asChild className="text-xs h-8 gap-1.5 bg-brand hover:bg-brand/90 text-white">
                <a
                  href={
                    researcher.scholarUrl.startsWith("http")
                      ? researcher.scholarUrl
                      : `https://scholar.google.com/citations?user=${researcher.scholarUrl}&hl=en`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>Google Scholar</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              </Button>
            )}
          </div>
        }
      />

      {/* 2. Hero Profile Card */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {facultyPhoto ? (
              <img
                src={facultyPhoto}
                alt={researcher.name}
                className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl object-cover border border-border shadow-2xs shrink-0"
              />
            ) : (
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-brand-soft text-brand flex items-center justify-center shrink-0 font-bold text-2xl border border-brand/20">
                {researcher.name?.charAt(0) || "U"}
              </div>
            )}

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-bold text-foreground truncate">{researcher.name}</h2>
                <StatusBadge status={researcher.isFaculty !== false ? "faculty" : "active"} />
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-brand" />
                  <span>{researcher.department}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-brand" />
                  <span>Asingan Campus</span>
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Metric Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Publications"
          value={researcher.totalPublications || 0}
          subtitle="Verified campus outputs"
          icon={FileText}
        />
        <StatCard
          label="Total Citations"
          value={researcher.totalCitations || 0}
          subtitle="Google Scholar impact"
          icon={Quote}
        />
        <StatCard
          label="Citation Density"
          value={
            (researcher.totalPublications || 0) > 0
              ? ((researcher.totalCitations || 0) / researcher.totalPublications).toFixed(1)
              : "0.0"
          }
          subtitle="Average cites / paper"
          icon={BarChart3}
        />
      </div>

      {/* 4. Publications List Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Scholarly Works ({sortedPublications.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              All peer-reviewed articles and research papers attributed to {researcher.name}
            </p>
          </div>

          {sortedPublications.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sort:</span>
              <Select value={sortBy} onValueChange={(val) => setSortBy(val as SortOption)}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">Newest Year</SelectItem>
                  <SelectItem value="citations">Most Citations</SelectItem>
                  <SelectItem value="journal">Journal Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* List of Publications */}
        <div className="space-y-3">
          {sortedPublications.map((pub: any) => {
            const hasCollab = Array.isArray(pub.authors) && hasExternalCollaborators(pub.authors);
            const isPsu = Array.isArray(pub.authors) && isPSUPaper(pub.authors);

            return (
              <Card
                key={pub.id}
                className="border-border/60 hover:border-brand/40 transition-colors shadow-2xs"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {pub.year}
                        </Badge>
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {pub.citations || 0} citations
                        </Badge>
                        {hasCollab ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-warning-soft text-warning border border-warning-border">
                            PSU + External
                          </span>
                        ) : isPsu ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-success-soft text-success border border-success-border">
                            Pure PSU
                          </span>
                        ) : null}
                      </div>

                      <h4
                        onClick={() => navigate(`/dashboard/publication/${pub.id}`)}
                        className="text-sm font-semibold text-foreground hover:text-brand cursor-pointer transition-colors leading-snug"
                      >
                        {pub.title}
                      </h4>

                      {/* Author pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {Array.isArray(pub.authors) ? (
                          categorizeAuthors(pub.authors).map((cat, aIdx) => (
                            <span
                              key={aIdx}
                              className={`text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 ${
                                cat.isPsu
                                  ? "bg-success-soft text-success border border-success-border"
                                  : "bg-muted text-muted-foreground border border-border"
                              }`}
                            >
                              <span
                                className={`w-1 h-1 rounded-full ${
                                  cat.isPsu ? "bg-success" : "bg-muted-foreground"
                                }`}
                              />
                              {cat.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">{pub.authors}</span>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground truncate">
                        {pub.journal || "PSU Archive"}
                      </div>
                    </div>

                    <div className="self-end sm:self-center shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/dashboard/publication/${pub.id}`)}
                        className="text-xs h-7 gap-1"
                      >
                        <span>Details</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {sortedPublications.length === 0 && (
            <EmptyState
              icon={FileText}
              title="No publications recorded"
              description={`No publications are currently linked to ${researcher.name}.`}
            />
          )}
        </div>
      </div>
    </div>
  );
}