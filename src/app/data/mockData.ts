// Mock data for the Research Publication Tracking System

export interface Publication {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  citations: number;
  abstract?: string;
  citationTrend?: { year: number; citations: number; id: string }[];
  impactScore?: number;
  citingPapers?: {
    title: string;
    authors: string;
    year: number;
    link: string;
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
}

export const mockResearchers: Researcher[] = [
  {
    id: "1",
    name: "Rodelio M. Garin",
    affiliation: "Pangasinan State University - Asingan Campus",
    department: "BSIT",
    totalPublications: 15,
    totalCitations: 342,
    publications: [
      {
        id: "pub1",
        title: "Machine Learning Applications in Agricultural Education: A Systematic Review",
        authors: ["Rodelio M. Garin", "Maria Santos", "John Reyes"],
        journal: "International Journal of Educational Technology",
        year: 2023,
        citations: 45,
        abstract: "This paper presents a comprehensive systematic review of machine learning applications in agricultural education...",
        impactScore: 8.5,
        citationTrend: [
          { year: 2023, citations: 12, id: 'pub1-trend-2023' },
          { year: 2024, citations: 23, id: 'pub1-trend-2024' },
          { year: 2025, citations: 10, id: 'pub1-trend-2025' },
        ],
        citingPapers: [
          {
            title: "AI in Higher Education: Current Trends",
            authors: "Smith, J. et al.",
            year: 2024,
            link: "https://scholar.google.com",
          },
          {
            title: "Digital Transformation in Agricultural Curricula",
            authors: "Johnson, M. et al.",
            year: 2024,
            link: "https://scholar.google.com",
          },
        ],
      },
      {
        id: "pub2",
        title: "Student Performance Prediction Using Data Mining Techniques",
        authors: ["Rodelio M. Garin", "Anna Cruz"],
        journal: "Journal of Educational Data Science",
        year: 2022,
        citations: 67,
        abstract: "We propose a novel approach to predicting student performance using advanced data mining techniques...",
        impactScore: 9.2,
        citationTrend: [
          { year: 2022, citations: 15, id: 'pub2-trend-2022' },
          { year: 2023, citations: 28, id: 'pub2-trend-2023' },
          { year: 2024, citations: 19, id: 'pub2-trend-2024' },
          { year: 2025, citations: 5, id: 'pub2-trend-2025' },
        ],
        citingPapers: [
          {
            title: "Educational Analytics: A Review",
            authors: "Brown, P. et al.",
            year: 2023,
            link: "https://scholar.google.com",
          },
        ],
      },
      {
        id: "pub3",
        title: "Digital Literacy Enhancement Through Gamified Learning Platforms",
        authors: ["Rodelio M. Garin", "Jose Martinez", "Lisa Garcia"],
        journal: "Computers & Education",
        year: 2021,
        citations: 89,
        abstract: "This study explores the effectiveness of gamified learning platforms in enhancing digital literacy...",
        impactScore: 9.8,
        citationTrend: [
          { year: 2021, citations: 18, id: 'pub3-trend-2021' },
          { year: 2022, citations: 32, id: 'pub3-trend-2022' },
          { year: 2023, citations: 25, id: 'pub3-trend-2023' },
          { year: 2024, citations: 14, id: 'pub3-trend-2024' },
        ],
        citingPapers: [
          {
            title: "Gamification in Education: Meta-Analysis",
            authors: "Davis, K. et al.",
            year: 2023,
            link: "https://scholar.google.com",
          },
        ],
      },
      {
        id: "pub4",
        title: "Assessment of E-Learning Readiness in Rural Universities",
        authors: ["Rodelio M. Garin"],
        journal: "Asia Pacific Education Review",
        year: 2020,
        citations: 52,
        impactScore: 7.9,
        citationTrend: [
          { year: 2020, citations: 8, id: 'pub4-trend-2020' },
          { year: 2021, citations: 15, id: 'pub4-trend-2021' },
          { year: 2022, citations: 18, id: 'pub4-trend-2022' },
          { year: 2023, citations: 11, id: 'pub4-trend-2023' },
        ],
      },
      {
        id: "pub5",
        title: "Cloud-Based Learning Management Systems: Implementation and Impact",
        authors: ["Rodelio M. Garin", "Pedro Santos"],
        journal: "Educational Technology Research and Development",
        year: 2019,
        citations: 41,
        impactScore: 7.5,
        citationTrend: [
          { year: 2019, citations: 5, id: 'pub5-trend-2019' },
          { year: 2020, citations: 12, id: 'pub5-trend-2020' },
          { year: 2021, citations: 14, id: 'pub5-trend-2021' },
          { year: 2022, citations: 10, id: 'pub5-trend-2022' },
        ],
      },
    ],
  },
  {
    id: "2",
    name: "Wenna Lyn L. Honrado",
    affiliation: "Pangasinan State University - Asingan Campus",
    department: "BEE",
    totalPublications: 12,
    totalCitations: 218,
    publications: [
      {
        id: "pub6",
        title: "Sustainable Agriculture Practices in Northern Luzon",
        authors: ["Wenna Lyn L. Honrado", "Roberto Cruz"],
        journal: "Philippine Journal of Agriculture",
        year: 2023,
        citations: 38,
        impactScore: 8.1,
        citationTrend: [
          { year: 2023, citations: 15, id: 'pub6-trend-2023' },
          { year: 2024, citations: 18, id: 'pub6-trend-2024' },
          { year: 2025, citations: 5, id: 'pub6-trend-2025' },
        ],
      },
      {
        id: "pub7",
        title: "Climate Change Impact on Rice Production",
        authors: ["Wenna Lyn L. Honrado", "Juan Reyes", "Ana Lopez"],
        journal: "Agricultural Systems",
        year: 2022,
        citations: 71,
        impactScore: 9.3,
        citationTrend: [
          { year: 2022, citations: 20, id: 'pub7-trend-2022' },
          { year: 2023, citations: 31, id: 'pub7-trend-2023' },
          { year: 2024, citations: 15, id: 'pub7-trend-2024' },
          { year: 2025, citations: 5, id: 'pub7-trend-2025' },
        ],
      },
      {
        id: "pub8",
        title: "Organic Farming Methods and Soil Health",
        authors: ["Wenna Lyn L. Honrado"],
        journal: "Soil Science Society Journal",
        year: 2021,
        citations: 54,
        impactScore: 8.7,
        citationTrend: [
          { year: 2021, citations: 12, id: 'pub8-trend-2021' },
          { year: 2022, citations: 22, id: 'pub8-trend-2022' },
          { year: 2023, citations: 15, id: 'pub8-trend-2023' },
          { year: 2024, citations: 5, id: 'pub8-trend-2024' },
        ],
      },
    ],
  },
  {
    id: "3",
    name: "JB O. Doria",
    affiliation: "Pangasinan State University - Asingan Campus",
    department: "BIT",
    totalPublications: 18,
    totalCitations: 456,
    publications: [
      {
        id: "pub9",
        title: "Advanced Statistical Methods in Agricultural Research",
        authors: ["JB O. Doria", "Carmen Villa"],
        journal: "Journal of Agricultural Science",
        year: 2023,
        citations: 62,
        impactScore: 9.0,
        citationTrend: [
          { year: 2023, citations: 28, id: 'pub9-trend-2023' },
          { year: 2024, citations: 24, id: 'pub9-trend-2024' },
          { year: 2025, citations: 10, id: 'pub9-trend-2025' },
        ],
      },
      {
        id: "pub10",
        title: "Big Data Analytics in Precision Agriculture",
        authors: ["JB O. Doria", "Luis Fernandez", "Sofia Martinez"],
        journal: "Precision Agriculture",
        year: 2022,
        citations: 95,
        impactScore: 9.7,
        citationTrend: [
          { year: 2022, citations: 25, id: 'pub10-trend-2022' },
          { year: 2023, citations: 38, id: 'pub10-trend-2023' },
          { year: 2024, citations: 24, id: 'pub10-trend-2024' },
          { year: 2025, citations: 8, id: 'pub10-trend-2025' },
        ],
      },
    ],
  },
  {
    id: "4",
    name: "Ma Jo Ann B. Ventura",
    affiliation: "Pangasinan State University - Asingan Campus",
    department: "BSE",
    totalPublications: 14,
    totalCitations: 289,
    publications: [
      {
        id: "pub11",
        title: "Educational Leadership in Rural Schools: Challenges and Opportunities",
        authors: ["Ma Jo Ann B. Ventura", "Patricia Santos"],
        journal: "Educational Management Administration & Leadership",
        year: 2023,
        citations: 43,
        impactScore: 8.3,
        citationTrend: [
          { year: 2023, citations: 18, id: 'pub11-trend-2023' },
          { year: 2024, citations: 20, id: 'pub11-trend-2024' },
          { year: 2025, citations: 5, id: 'pub11-trend-2025' },
        ],
      },
      {
        id: "pub12",
        title: "Teacher Professional Development in the Digital Age",
        authors: ["Ma Jo Ann B. Ventura", "Ramon Lopez", "Clara Gonzales"],
        journal: "Teaching and Teacher Education",
        year: 2022,
        citations: 78,
        impactScore: 9.1,
        citationTrend: [
          { year: 2022, citations: 22, id: 'pub12-trend-2022' },
          { year: 2023, citations: 35, id: 'pub12-trend-2023' },
          { year: 2024, citations: 16, id: 'pub12-trend-2024' },
          { year: 2025, citations: 5, id: 'pub12-trend-2025' },
        ],
      },
      {
        id: "pub13",
        title: "Assessment Practices in Higher Education: A Meta-Analysis",
        authors: ["Ma Jo Ann B. Ventura"],
        journal: "Assessment & Evaluation in Higher Education",
        year: 2021,
        citations: 61,
        impactScore: 8.8,
        citationTrend: [
          { year: 2021, citations: 15, id: 'pub13-trend-2021' },
          { year: 2022, citations: 24, id: 'pub13-trend-2022' },
          { year: 2023, citations: 17, id: 'pub13-trend-2023' },
          { year: 2024, citations: 5, id: 'pub13-trend-2024' },
        ],
      },
    ],
  },
  {
    id: "5",
    name: "Dr. Ana Maria Santos",
    affiliation: "Pangasinan State University - Asingan Campus",
    department: "BSBA",
    totalPublications: 10,
    totalCitations: 165,
    publications: [
      {
        id: "pub14",
        title: "Entrepreneurship Education in Rural Communities",
        authors: ["Dr. Ana Maria Santos", "Carlos Rivera"],
        journal: "Journal of Business Education",
        year: 2023,
        citations: 32,
        impactScore: 7.8,
        citationTrend: [
          { year: 2023, citations: 15, id: 'pub14-trend-2023' },
          { year: 2024, citations: 12, id: 'pub14-trend-2024' },
          { year: 2025, citations: 5, id: 'pub14-trend-2025' },
        ],
      },
      {
        id: "pub15",
        title: "Small Business Management Practices in Pangasinan",
        authors: ["Dr. Ana Maria Santos"],
        journal: "Asian Business Review",
        year: 2022,
        citations: 48,
        impactScore: 8.2,
        citationTrend: [
          { year: 2022, citations: 18, id: 'pub15-trend-2022' },
          { year: 2023, citations: 20, id: 'pub15-trend-2023' },
          { year: 2024, citations: 10, id: 'pub15-trend-2024' },
        ],
      },
    ],
  },
  {
    id: "6",
    name: "Prof. Carlos D. Mendoza",
    affiliation: "Pangasinan State University - Asingan Campus",
    department: "BTLED",
    totalPublications: 8,
    totalCitations: 142,
    publications: [
      {
        id: "pub16",
        title: "Technology Integration in Technical-Vocational Education",
        authors: ["Prof. Carlos D. Mendoza", "Elena Rodriguez"],
        journal: "Journal of Technical Education",
        year: 2023,
        citations: 28,
        impactScore: 7.5,
        citationTrend: [
          { year: 2023, citations: 12, id: 'pub16-trend-2023' },
          { year: 2024, citations: 11, id: 'pub16-trend-2024' },
          { year: 2025, citations: 5, id: 'pub16-trend-2025' },
        ],
      },
      {
        id: "pub17",
        title: "Skills Development for Industry 4.0 in the Philippines",
        authors: ["Prof. Carlos D. Mendoza"],
        journal: "International Journal of Vocational Education",
        year: 2022,
        citations: 41,
        impactScore: 8.0,
        citationTrend: [
          { year: 2022, citations: 15, id: 'pub17-trend-2022' },
          { year: 2023, citations: 18, id: 'pub17-trend-2023' },
          { year: 2024, citations: 8, id: 'pub17-trend-2024' },
        ],
      },
    ],
  },
];

export const dashboardStats = {
  totalResearchers: 24,
  totalPublications: 187,
  totalCitations: 3456,
  averageImpactScore: 8.4,
};

export const publicationsPerYear = [
  { year: 2019, publications: 12, id: 'pub-year-2019' },
  { year: 2020, publications: 18, id: 'pub-year-2020' },
  { year: 2021, publications: 25, id: 'pub-year-2021' },
  { year: 2022, publications: 38, id: 'pub-year-2022' },
  { year: 2023, publications: 52, id: 'pub-year-2023' },
  { year: 2024, publications: 42, id: 'pub-year-2024' },
  { year: 2025, publications: 48, id: 'pub-year-2025' },
  { year: 2026, publications: 55, id: 'pub-year-2026' },
];

export const citationGrowth = [
  { year: 2019, citations: 245, id: 'cite-year-2019' },
  { year: 2020, citations: 378, id: 'cite-year-2020' },
  { year: 2021, citations: 512, id: 'cite-year-2021' },
  { year: 2022, citations: 689, id: 'cite-year-2022' },
  { year: 2023, citations: 854, id: 'cite-year-2023' },
  { year: 2024, citations: 778, id: 'cite-year-2024' },
  { year: 2025, citations: 920, id: 'cite-year-2025' },
  { year: 2026, citations: 1050, id: 'cite-year-2026' },
];

// Citations by Department and Year (for multi-line charts)
export const citationsByDepartment = [
  { year: 2015, BSIT: 45, BSBA: 32, BEE: 28, BTLED: 22, BIT: 38, BSE: 35, id: 'dept-cite-2015' },
  { year: 2016, BSIT: 52, BSBA: 38, BEE: 34, BTLED: 28, BIT: 45, BSE: 42, id: 'dept-cite-2016' },
  { year: 2017, BSIT: 68, BSBA: 45, BEE: 41, BTLED: 35, BIT: 52, BSE: 48, id: 'dept-cite-2017' },
  { year: 2018, BSIT: 82, BSBA: 58, BEE: 52, BTLED: 43, BIT: 65, BSE: 58, id: 'dept-cite-2018' },
  { year: 2019, BSIT: 98, BSBA: 72, BEE: 65, BTLED: 52, BIT: 78, BSE: 72, id: 'dept-cite-2019' },
  { year: 2020, BSIT: 125, BSBA: 88, BEE: 82, BTLED: 65, BIT: 92, BSE: 88, id: 'dept-cite-2020' },
  { year: 2021, BSIT: 158, BSBA: 105, BEE: 98, BTLED: 82, BIT: 112, BSE: 105, id: 'dept-cite-2021' },
  { year: 2022, BSIT: 192, BSBA: 128, BEE: 118, BTLED: 98, BIT: 135, BSE: 128, id: 'dept-cite-2022' },
  { year: 2023, BSIT: 235, BSBA: 152, BEE: 142, BTLED: 118, BIT: 165, BSE: 152, id: 'dept-cite-2023' },
  { year: 2024, BSIT: 268, BSBA: 175, BEE: 162, BTLED: 135, BIT: 188, BSE: 172, id: 'dept-cite-2024' },
  { year: 2025, BSIT: 305, BSBA: 198, BEE: 185, BTLED: 152, BIT: 215, BSE: 195, id: 'dept-cite-2025' },
  { year: 2026, BSIT: 342, BSBA: 225, BEE: 208, BTLED: 172, BIT: 245, BSE: 218, id: 'dept-cite-2026' },
];

// Publications by Department and Year (for clustered column charts)
export const publicationsByDepartment = [
  { year: 2015, BSIT: 3, BSBA: 2, BEE: 2, BTLED: 1, BIT: 3, BSE: 2, id: 'dept-pub-2015' },
  { year: 2016, BSIT: 4, BSBA: 3, BEE: 2, BTLED: 2, BIT: 4, BSE: 3, id: 'dept-pub-2016' },
  { year: 2017, BSIT: 5, BSBA: 3, BEE: 3, BTLED: 2, BIT: 5, BSE: 4, id: 'dept-pub-2017' },
  { year: 2018, BSIT: 6, BSBA: 4, BEE: 4, BTLED: 3, BIT: 6, BSE: 5, id: 'dept-pub-2018' },
  { year: 2019, BSIT: 8, BSBA: 5, BEE: 5, BTLED: 4, BIT: 7, BSE: 6, id: 'dept-pub-2019' },
  { year: 2020, BSIT: 10, BSBA: 6, BEE: 6, BTLED: 5, BIT: 9, BSE: 7, id: 'dept-pub-2020' },
  { year: 2021, BSIT: 12, BSBA: 8, BEE: 7, BTLED: 6, BIT: 11, BSE: 9, id: 'dept-pub-2021' },
  { year: 2022, BSIT: 15, BSBA: 10, BEE: 9, BTLED: 7, BIT: 13, BSE: 11, id: 'dept-pub-2022' },
  { year: 2023, BSIT: 18, BSBA: 12, BEE: 11, BTLED: 9, BIT: 16, BSE: 13, id: 'dept-pub-2023' },
  { year: 2024, BSIT: 21, BSBA: 14, BEE: 13, BTLED: 10, BIT: 18, BSE: 15, id: 'dept-pub-2024' },
  { year: 2025, BSIT: 24, BSBA: 16, BEE: 15, BTLED: 12, BIT: 21, BSE: 17, id: 'dept-pub-2025' },
  { year: 2026, BSIT: 27, BSBA: 18, BEE: 17, BTLED: 14, BIT: 24, BSE: 19, id: 'dept-pub-2026' },
];

export const topResearchers = [
  { name: "JB O. Doria", citations: 456, id: 'top-res-1' },
  { name: "Rodelio M. Garin", citations: 342, id: 'top-res-2' },
  { name: "Ma Jo Ann B. Ventura", citations: 289, id: 'top-res-3' },
  { name: "Wenna Lyn L. Honrado", citations: 218, id: 'top-res-4' },
  { name: "Dr. Roberto Cruz", citations: 189, id: 'top-res-5' },
];

// Additional exports for compatibility
export const researchers = mockResearchers.map(r => ({
  id: r.id,
  name: r.name,
  department: r.department,
  citations: r.totalCitations,
  publications: r.totalPublications,
}));

// Publications structured by author for easier access
export const publications = mockResearchers.map(r => ({
  authorId: r.id,
  authorName: r.name,
  publications: r.publications.map(pub => ({
    ...pub,
    impactFactor: pub.impactScore,
  })),
}));