import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, User, FileText, Quote } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { getFacultyPhoto } from "../utils/facultyUtils";
import { useResearcher } from "../hooks/useResearchers";

type SortOption = "year" | "citations" | "journal";

export function ResearcherProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<SortOption>("year");

  const { researcher, loading } = useResearcher(id || "");

  const sortedPublications = useMemo(() => {
    if (!researcher || !researcher.publications) return [];
    
    const pubs = [...researcher.publications];
    
    switch (sortBy) {
      case "year":
        return pubs.sort((a, b) => b.year - a.year);
      case "citations":
        return pubs.sort((a, b) => b.citations - a.citations);
      case "journal":
        return pubs.sort((a, b) => a.journal.localeCompare(b.journal));
      default:
        return pubs;
    }
  }, [researcher, sortBy]);

  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Loading researcher profile from database...</p>
      </div>
    );
  }

  if (!researcher) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Researcher not found in the database.</p>
        <Button onClick={() => navigate("/dashboard/researchers")} className="mt-4">
          Back to Researchers
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate("/dashboard/researchers")}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Researchers
      </Button>

      {/* Researcher Header */}
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Avatar */}
            {getFacultyPhoto(researcher.name) || (researcher as any).photoUrl ? (
              <img
                src={getFacultyPhoto(researcher.name) || (researcher as any).photoUrl}
                alt={researcher.name}
                className="w-24 h-24 rounded-full object-cover border-4 border-blue-200 flex-shrink-0"
              />
            ) : (
              <div className="bg-blue-100 rounded-full p-6 flex-shrink-0">
                <User className="w-12 h-12 text-blue-600" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1">
              <h1 className="text-3xl text-gray-900 mb-2">{researcher.name}</h1>
              <p className="text-lg text-gray-600 mb-6">{researcher.affiliation || "Pangasinan State University - Asingan Campus"}</p>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <p className="text-sm text-gray-600">Publications</p>
                  </div>
                  <p className="text-2xl text-gray-900">{researcher.totalPublications || 0}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Quote className="w-4 h-4 text-gray-500" />
                    <p className="text-sm text-gray-600">Total Citations</p>
                  </div>
                  <p className="text-2xl text-gray-900">{researcher.totalCitations || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Publications Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl text-gray-900">Publications</h2>
          
          {sortedPublications.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Sort by:</span>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-40">
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
          {sortedPublications.map((publication) => (
            <Card
              key={publication.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/dashboard/publication/${publication.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-sm flex-shrink-0">
                    {publication.year}
                  </div>

                  <div className="flex-1">
                    <h3 className="text-lg text-gray-900 mb-2 hover:text-blue-600 transition-colors">
                      {publication.title}
                    </h3>

                    <p className="text-sm text-gray-600 mb-2">
                      {Array.isArray(publication.authors) ? publication.authors.join(", ") : publication.authors}
                    </p>

                    <p className="text-sm text-gray-700 mb-3">
                      {publication.journal}
                    </p>

                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2">
                        <Quote className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {publication.citations} citations
                        </span>
                      </div>

                      {publication.impactScore !== undefined && (
                        <div className="flex items-center gap-2">
                          <div className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">
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
                  >
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {sortedPublications.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <FileText className="mx-auto h-12 w-12 text-gray-300 mb-2" />
                <p>No publications registered for this researcher yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}