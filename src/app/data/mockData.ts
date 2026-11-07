// Core domain models for the PSU Research Publication Tracking System

export interface Publication {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  citations: number;
  abstract?: string;
  url?: string;
  citedByLink?: string;
  citationTrend?: { year: number; citations: number; id: string }[];
  impactScore?: number;
  jc3Points?: number;
  jc3_points?: number;
  nbc461Points?: number;
  nbc461_points?: number;
  journal_indexing?: string;
  journalIndexing?: string;
  is_predatory_flag?: number | boolean;
  sdg_tags?: string | string[];
  sdgTags?: string[];
  sdg_rationale?: string;
  sdgRationale?: string;
  ched_priority?: string;
  approval_status?: string;
  approvalStatus?: string;
  research_status?: string;
  researchStatus?: string;
  isPublic?: boolean;
  is_public?: number | boolean;
  owner_name?: string;
  ownerName?: string;
  owner_id?: string;
  ownerId?: string;
  publication_date?: string;
  publicationDate?: string;
  volume_issue?: string;
  volumeIssue?: string;
  issn_isbn?: string;
  issnIsbn?: string;
  doi?: string;
  keywords?: string;
  publication_level?: string;
  publicationLevel?: string;
  citingPapers?: {
    title: string;
    authors?: string;
    year?: number;
    link?: string;
  }[];
}

export interface Researcher {
  id: string;
  name: string;
  affiliation: string;
  department: string;
  totalPublications: number;
  totalCitations: number;
  publications: Publication[];
  isFaculty?: boolean;
  scholarUrl?: string;
  googleScholarId?: string;
  photoUrl?: string;
}
