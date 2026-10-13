import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, User, FileText, Quote, ChevronRight, GraduationCap, ExternalLink, Shield } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { getFacultyPhoto, isPSUPaper, hasExternalCollaborators, categorizeAuthors } from "../utils/facultyUtils";
import { apiService } from "../services/api.service";

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
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard/researchers")} className="dark:text-gray-300">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Researchers
        </Button>
        <Card className="dark:border-gray-800">
          <CardContent className="p-12 text-center text-gray-500 dark:text-gray-400">
            <p>Loading researcher profile from database...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!researcher) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/dashboard/researchers")} className="dark:text-gray-300">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Researchers
        </Button>
        <Card className="dark:border-gray-800">
          <CardContent className="p-12 text-center text-gray-500 dark:text-gray-400">
            <User className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Researcher Not Found</h2>
            <p>The requested researcher could not be found in the institutional records.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate("/dashboard/researchers")} className="dark:text-gray-300">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Researchers
      </Button>

      {/* Profile Header */}
      <Card className="dark:border-gray-800">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Photo / Avatar */}
            {getFacultyPhoto(researcher.name) || researcher.photoUrl ? (
              <img
                src={getFacultyPhoto(researcher.name) || researcher.photoUrl}
                alt={researcher.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-blue-200 dark:border-blue-900 shadow-md flex-shrink-0"
              />
            ) : (
              <div className="bg-blue-100 dark:bg-blue-950/40 rounded-full p-6 flex-shrink-0">
                <User className="w-12 h-12 text-blue-600 dark:text-blue-400" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{researcher.name}</h1>
                <Badge className="bg-blue-600 text-white text-xs">
                  <Shield className="w-3 h-3 mr-1" />
                  {researcher.isFaculty !== false ? "PSU Faculty" : "Non-Teaching"}
                </Badge>
                {researcher.scholarUrl && (
                  <a
                    href={
                      researcher.scholarUrl.startsWith("http")
                        ? researcher.scholarUrl
                        : `https://scholar.google.com/citations?user=${researcher.scholarUrl}&hl=en`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-900/50 transition-colors"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    Google Scholar Profile <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-base text-gray-600 dark:text-gray-300 mb-6">
                {researcher.department} • {researcher.affiliation || "Pangasinan State University - Asingan Campus"}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Publications</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{researcher.totalPublications || 0}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Quote className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Citations</p>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{researcher.totalCitations || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Publications Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Publications</h2>
          
          {sortedPublications.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">Sort by:</span>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-40 dark:border-gray-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="year">Year</SelectItem>
                  <SelectItem value="citations">Citation Count</SelectItem>
                  <SelectItem value="journal">Journal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Publications List */}
        <div className="space-y-4">
          {sortedPublications.map((publication) => {
            const hasCollab = Array.isArray(publication.authors) && hasExternalCollaborators(publication.authors);
            const isPsu = Array.isArray(publication.authors) && isPSUPaper(publication.authors);

            return (
              <Card
                key={publication.id}
                className="hover:shadow-md transition-shadow cursor-pointer dark:border-gray-800"
                onClick={() => navigate(`/dashboard/publication/${publication.id}`)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-3 py-1 rounded-lg text-sm font-semibold flex-shrink-0">
                      {publication.year}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                          {publication.title}
                        </h3>
                        {hasCollab ? (
                          <Badge variant="outline" className="text-[11px] border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300">
                            PSU + External Collaboration
                          </Badge>
                        ) : isPsu ? (
                          <Badge variant="outline" className="text-[11px] border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300">
                            Pure PSU Paper
                          </Badge>
                        ) : null}
                      </div>

                      {/* Authors List with PSU vs Non-PSU Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 mr-1 flex items-center gap-1">
                          Users Authors:
                        </span>
                        {Array.isArray(publication.authors) ? (
                          categorizeAuthors(publication.authors).map((cat, aIdx) => (
                            <span
                              key={aIdx}
                              className={`text-xs px-2 py-0.5 rounded-md font-medium inline-flex items-center gap-1 ${
                                cat.isPsu
                                  ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              }`}
                              title={cat.isPsu ? "PSU Faculty Author" : "External / Non-PSU Collaborator"}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  cat.isPsu ? "bg-emerald-500" : "bg-slate-400"
                                }`}
                              />
                              {cat.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-gray-600 dark:text-gray-300">{publication.authors}</span>
                        )}
                      </div>

                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 italic">
                        {publication.journal}
                      </p>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Quote className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                            {publication.citations} citations
                          </span>
                        </div>

                        {publication.impactScore !== undefined && (
                          <div className="flex items-center gap-2">
                            <div className="bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 px-2 py-1 rounded text-xs font-semibold">
                              Impact Score: {publication.impactScore}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/dashboard/publication/${publication.id}`);
                      }}
                      className="dark:border-gray-700"
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {sortedPublications.length === 0 && (
            <Card className="dark:border-gray-800">
              <CardContent className="py-12 text-center text-gray-500 dark:text-gray-400">
                <FileText className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
                <p>No publications registered for this researcher yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}