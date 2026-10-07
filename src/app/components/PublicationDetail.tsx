import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Quote, TrendingUp, ExternalLink, Calendar, Users, BookOpen, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { apiService } from "../services/api.service";
import type { Publication } from "../data/mockData";

export function PublicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [publication, setPublication] = useState<Publication | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const loadPublication = async () => {
      setLoading(true);
      try {
        const data = await apiService.getPublicationById(id);
        if (data) {
          setPublication(data);
        }
      } catch (err) {
        console.warn("Failed to load publication from database:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPublication();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!publication) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Publication not found</p>
        <Button onClick={() => navigate("/dashboard")} className="mt-4">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const citationTrendData = publication.citationTrend || [];
  const citingPapers = publication.citingPapers || [];
  const currentYear = new Date().getFullYear();
  const yearsActive = Math.max(currentYear - publication.year, 1);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      {/* Publication Header */}
      <Card>
        <CardContent className="p-8">
          <div className="mb-4">
            <Badge className="bg-blue-600 mb-3">Research Publication</Badge>
            <h1 className="text-3xl text-gray-900 mb-4">{publication.title}</h1>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 mb-1">Authors</p>
                <p className="text-gray-900">
                  {Array.isArray(publication.authors)
                    ? publication.authors.join(", ")
                    : publication.authors}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <BookOpen className="w-5 h-5 text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 mb-1">Journal / Conference</p>
                <p className="text-gray-900">{publication.journal}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 mb-1">Publication Year</p>
                <p className="text-gray-900">{publication.year}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Quote className="w-5 h-5 text-gray-500 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Citations</p>
                <p className="text-2xl text-gray-900">{publication.citations}</p>
              </div>
            </div>
          </div>

          {/* Abstract */}
          {publication.abstract && (
            <div className="pt-6 border-t border-gray-200">
              <h3 className="text-lg text-gray-900 mb-2">Abstract</h3>
              <p className="text-gray-700 leading-relaxed">{publication.abstract}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Impact Analysis Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <CardTitle>Impact Analysis</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Impact Score */}
          {(publication as any).impactScore != null && (publication as any).impactScore > 0 && (
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm text-gray-600 mb-1">Research Impact Score</p>
                <p className="text-3xl text-green-700">{(publication as any).impactScore}/10</p>
              </div>
              <div className="w-32 h-32">
                <svg viewBox="0 0 36 36" className="transform -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#d1fae5"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeDasharray={`${((publication as any).impactScore / 10) * 100}, 100`}
                  />
                </svg>
              </div>
            </div>
          )}

          {/* Citation Trend Graph */}
          {citationTrendData.length > 0 && (
            <div>
              <h3 className="text-lg text-gray-900 mb-4">Citation Trend Over Time</h3>
              <ResponsiveContainer width="100%" height={300} key={`citation-trend-container-${id}`}>
                <LineChart data={citationTrendData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" key={`grid-${id}`} />
                  <XAxis dataKey="year" stroke="#6b7280" key={`xaxis-${id}`} />
                  <YAxis stroke="#6b7280" key={`yaxis-${id}`} />
                  <Tooltip
                    key={`tooltip-${id}`}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="citations"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", r: 5 }}
                    name="Citations"
                    key={`line-${id}`}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Citing Publications */}
      {citingPapers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Papers Citing This Research ({citingPapers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {citingPapers.map((paper: any, index: number) => (
                <div
                  key={`citing-${id}-${index}`}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="text-gray-900 mb-1">{paper.title}</h4>
                      <p className="text-sm text-gray-600 mb-1">{paper.authors}</p>
                      <p className="text-sm text-gray-500">Published in {paper.year}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(paper.link, "_blank")}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Quote className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Average Citations/Year</p>
              <p className="text-2xl text-gray-900">
                {(publication.citations / yearsActive).toFixed(1)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Citation Velocity</p>
              <p className="text-2xl text-gray-900">
                {citationTrendData.length > 0
                  ? citationTrendData[citationTrendData.length - 1].citations
                  : "N/A"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Last year</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <Users className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-1">Co-Authors</p>
              <p className="text-2xl text-gray-900">
                {Array.isArray(publication.authors) ? publication.authors.length : 1}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}