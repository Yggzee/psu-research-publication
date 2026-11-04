/**
 * Google Scholar Direct & Hybrid Scraper
 * Extracts complete, accurate search results and citing papers from Google Scholar.
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/^(\s*\[[^\]]+\]\s*)+/gi, '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function normalizeForMatch(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getQuarterFromMonth(month) {
  const m = Number(month);
  if (!m || m < 1 || m > 12) return 'First';
  if (m <= 3) return 'First';
  if (m <= 6) return '2nd';
  if (m <= 9) return '3rd';
  return '4th';
}

function extractKeywordsFromText(title = '', abstract = '') {
  const stopWords = new Set([
    'the', 'and', 'for', 'with', 'using', 'from', 'that', 'this', 'into', 'among',
    'based', 'study', 'analysis', 'towards', 'through', 'effect', 'effects', 'impact',
    'among', 'their', 'between', 'under', 'over', 'case', 'review', 'approach',
    'pangasinan', 'state', 'university', 'asingan', 'campus', 'philippines'
  ]);
  const combined = `${title} ${abstract}`
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4 && !stopWords.has(w.toLowerCase()));
  const unique = [];
  const seen = new Set();
  for (const w of combined) {
    const low = w.toLowerCase();
    if (!seen.has(low)) {
      seen.add(low);
      unique.push(w);
    }
    if (unique.length >= 5) break;
  }
  return unique.join(', ');
}

/**
 * Enrich a publication or citing paper using CrossRef public metadata API
 * Retrieves full un-truncated author list (lead + all co-researchers),
 * journal title, volume/issue/page, ISSN/ISBN/DOI, publication date, and quarter.
 */
export async function enrichPaperWithCrossRef(paper) {
  if (!paper || !paper.title) return paper;
  try {
    const cleanTitle = cleanText(paper.title);
    const normTarget = normalizeForMatch(cleanTitle);
    if (!normTarget || normTarget.length < 6) return paper;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const url = `https://api.crossref.org/works?query.title=${encodeURIComponent(cleanTitle)}&rows=3`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PSUResearchTracker/1.0 (mailto:research@psu.edu.ph)',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return paper;
    const data = await res.json();
    const items = data?.message?.items;
    if (!Array.isArray(items) || items.length === 0) return paper;

    // Find best matching item by title overlap
    const targetWords = normTarget.split(' ').filter((w) => w.length > 2);
    let matchedItem = null;
    for (const candidate of items) {
      const candTitle = normalizeForMatch(candidate?.title?.[0] || '');
      if (!candTitle) continue;
      if (candTitle === normTarget || candTitle.includes(normTarget) || normTarget.includes(candTitle)) {
        matchedItem = candidate;
        break;
      }
      const hits = targetWords.filter((w) => candTitle.includes(w)).length;
      if (targetWords.length > 0 && hits / targetWords.length >= 0.75) {
        matchedItem = candidate;
        break;
      }
    }

    if (!matchedItem) return paper;

    // 1. Full Authors list (Lead researcher + all co-researchers)
    if (Array.isArray(matchedItem.author) && matchedItem.author.length > 0) {
      const fullAuthors = matchedItem.author
        .map((a) => {
          const given = (a.given || '').trim();
          const family = (a.family || '').trim();
          const name = (a.name || '').trim();
          return given && family ? `${given} ${family}` : family || given || name;
        })
        .filter(Boolean);

      if (fullAuthors.length > 0) {
        if (Array.isArray(paper.authors)) {
          paper.authors = fullAuthors;
        } else {
          paper.authors = fullAuthors.join(', ');
        }
      }
    }

    // 2. Journal / Venue Title
    const containerTitle = matchedItem['container-title']?.[0] || matchedItem.publisher || '';
    if (containerTitle && (!paper.journal || paper.journal === 'Academic Publication' || paper.journal.length < containerTitle.length)) {
      paper.journal = cleanText(containerTitle);
    }

    // 3. Volume / Issue / Page No.
    const vol = matchedItem.volume ? `Vol. ${matchedItem.volume}` : '';
    const iss = matchedItem.issue ? `No. ${matchedItem.issue}` : '';
    const page = matchedItem.page ? `pp. ${matchedItem.page}` : matchedItem['article-number'] ? `Art. ${matchedItem['article-number']}` : '';
    const volIssueParts = [vol, iss, page].filter(Boolean);
    if (volIssueParts.length > 0 && !paper.volume_issue) {
      paper.volume_issue = volIssueParts.join(', ');
    }

    // 4. ISSN / ISBN / DOI
    const issns = Array.isArray(matchedItem.ISSN) ? matchedItem.ISSN : [];
    const isbns = Array.isArray(matchedItem.ISBN) ? matchedItem.ISBN : [];
    const doi = matchedItem.DOI ? String(matchedItem.DOI).trim() : '';
    if (doi && !paper.doi) {
      paper.doi = doi;
    }
    const issnDoiParts = [];
    if (issns.length > 0) issnDoiParts.push(`ISSN ${issns.join(' / ')}`);
    if (isbns.length > 0) issnDoiParts.push(`ISBN ${isbns[0]}`);
    if (doi) issnDoiParts.push(`DOI: ${doi}`);
    if (issnDoiParts.length > 0) {
      paper.issn_isbn = paper.issn_isbn || issnDoiParts.join('\n');
      paper.doi_issn = paper.doi_issn || (doi ? `https://doi.org/${doi}` : issns[0] ? `ISSN ${issns[0]}` : '');
    }
    if (!paper.volume_issue && paper.doi_issn) {
      paper.volume_issue = paper.doi_issn;
    }

    // 5. Link fallback to DOI URL if missing or generic scholar search link
    if (doi && (!paper.link && !paper.url || String(paper.link || paper.url).includes('scholar.google.com/scholar?q='))) {
      const doiUrl = `https://doi.org/${doi}`;
      if ('link' in paper) paper.link = doiUrl;
      if ('url' in paper) paper.url = doiUrl;
    }

    // 6. Date of Publication & Quarter
    const dateParts =
      matchedItem.published?.['date-parts']?.[0] ||
      matchedItem['published-online']?.['date-parts']?.[0] ||
      matchedItem['published-print']?.['date-parts']?.[0] ||
      matchedItem.issued?.['date-parts']?.[0];

    if (Array.isArray(dateParts) && dateParts.length > 0) {
      const [y, m, d] = dateParts;
      if (y && !paper.year) paper.year = Number(y);
      if (y && m && d) {
        paper.publication_date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      } else if (y && m) {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        paper.publication_date = `${monthNames[m - 1] || m}, ${y}`;
      } else if (y) {
        paper.publication_date = String(y);
      }
      if (m) {
        paper.quarter = getQuarterFromMonth(m);
      }
    }

    // 7. Keywords
    if (!paper.keywords) {
      if (Array.isArray(matchedItem.subject) && matchedItem.subject.length > 0) {
        paper.keywords = matchedItem.subject.join(', ');
      } else {
        paper.keywords = extractKeywordsFromText(paper.title, paper.abstract);
      }
    }
  } catch {
    // Ignore enrichment network timeouts and preserve scraped Google Scholar data
  }
  if (!paper.keywords && paper.title) {
    paper.keywords = extractKeywordsFromText(paper.title, paper.abstract);
  }
  if (!paper.quarter) {
    paper.quarter = 'First';
  }
  return paper;
}

/**
 * Enrich a batch of papers with bounded concurrency
 */
export async function enrichBatchWithCrossRef(papers, concurrency = 4) {
  if (!Array.isArray(papers) || papers.length === 0) return papers;
  const queue = [...papers];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await enrichPaperWithCrossRef(item);
    }
  });
  await Promise.all(workers);
  return papers;
}

/**
 * Directly scrapes Google Scholar search results for a given query (1 page / 10 results by default)
 */
export async function scrapeGoogleScholarDirect(query, pageOrOptions = 0, limit = 10) {
  let page = 0;
  let start = 0;
  if (typeof pageOrOptions === 'object' && pageOrOptions !== null) {
    page = Number(pageOrOptions.page) || 0;
    start = Number(pageOrOptions.start ?? page * 10) || 0;
    limit = Number(pageOrOptions.limit) || 10;
  } else if (typeof pageOrOptions === 'number') {
    page = pageOrOptions;
    start = page * 10;
  }

  const allResults = [];
  const seenTitles = new Set();
  let captchaBlocked = false;

  const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}&hl=en&start=${start}`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (res.status === 429) {
      captchaBlocked = true;
    } else if (res.ok) {
      const html = await res.text();
      if (html.includes('detected unusual traffic') || html.includes('recaptcha') || html.includes('captcha')) {
        captchaBlocked = true;
      } else {
        // Robust pattern matching individual Google Scholar result blocks
        const itemRegex = /<div class="gs_r gs_or[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="gs_r gs_or|<div id="gs_res_ccl_bot"|$)/g;
        const matches = [...html.matchAll(itemRegex)];

        for (const m of matches) {
          if (allResults.length >= limit) break;
          const block = m[1];

          // 1. Title and publisher URL
          const titleMatch = block.match(/<h3[^>]* class="gs_rt"[^>]*>([\s\S]*?)<\/h3>/);
          if (!titleMatch) continue;

          const cleanTitle = cleanText(titleMatch[1]);
          if (!cleanTitle) continue;

          const linkMatch = titleMatch[1].match(/href="([^"]+)"/);
          let paperUrl = linkMatch ? linkMatch[1].replace(/&amp;/g, '&') : '';

          // 2. Direct PDF / file link
          const pdfMatch = block.match(/<div class="gs_or_ggsm"[^>]*>[\s\S]*?href="([^"]+)"/i) ||
                           block.match(/<div class="gs_ggs[^"]*"[^>]*>[\s\S]*?href="([^"]+)"/i);
          const pdfUrl = pdfMatch ? pdfMatch[1].replace(/&amp;/g, '&') : '';

          if (!paperUrl && pdfUrl) {
            paperUrl = pdfUrl;
          }
          if (!paperUrl) {
            paperUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(cleanTitle)}`;
          }

          // 3. Authors, Year, and Journal/Source from gs_a
          const authorMatch = block.match(/<div class="gs_a">([\s\S]*?)<\/div>/);
          const authorSummary = authorMatch ? cleanText(authorMatch[1]) : '';
          const parts = authorSummary.split(/\s+-\s+/);

          const authorsPart = parts[0] || '';
          let authors = [];
          if (authorsPart) {
            authors = authorsPart.split(',').map((a) => a.trim().replace(/…$/, '').trim()).filter(Boolean);
          }
          if (authors.length === 0) {
            authors = [query];
          }

          const ym = authorSummary.match(/\b(19\d{2}|20\d{2})\b/);
          const year = ym ? parseInt(ym[1], 10) : new Date().getFullYear();

          let journal = 'Academic Publication';
          if (parts.length > 2) {
            journal = parts[1].replace(/,?\s*\b(19\d{2}|20\d{2})\b/g, '').trim() || parts[2].trim();
          } else if (parts.length === 2) {
            journal = parts[1].replace(/,?\s*\b(19\d{2}|20\d{2})\b/g, '').trim() || parts[1].trim();
          }

          // 4. Snippet / Abstract from gs_rs
          const snippetMatch = block.match(/<div class="gs_rs">([\s\S]*?)<\/div>/);
          const snippet = snippetMatch ? cleanText(snippetMatch[1]) : '';

          // 5. Cites link, count, and cites ID
          const citesMatch = block.match(/href="(\/scholar\?cites=(\d+)[^"]*)"[^>]*>Cited by (\d+)</i);
          let citedByLink = '';
          let citations = 0;
          let citesId = '';
          if (citesMatch) {
            citesId = citesMatch[2];
            citedByLink = `https://scholar.google.com${citesMatch[1].replace(/&amp;/g, '&')}`;
            citations = parseInt(citesMatch[3], 10) || 0;
          }

          const firstAuthor = authors[0] || '';
          const dedupKey = citesId ? `cites:${citesId}` : `${cleanTitle}|${firstAuthor}|${year}`.toLowerCase();
          if (seenTitles.has(dedupKey)) continue;
          seenTitles.add(dedupKey);

          const id = citesId ? `gs-${citesId}` : `gs-${hashString(cleanTitle.toLowerCase() + firstAuthor.toLowerCase() + (year || ''))}`;

          allResults.push({
            id,
            title: cleanTitle,
            authors,
            journal,
            year,
            citations,
            abstract: snippet,
            url: paperUrl,
            pdfUrl: pdfUrl || null,
            citedByLink,
            fromCache: false
          });
        }
      }
    }
  } catch (err) {
    console.warn('[ScholarScraper] Direct search page error:', err.message);
  }

  await enrichBatchWithCrossRef(allResults, 5);

  allResults.captchaBlocked = captchaBlocked;
  allResults.hasMore = allResults.length === limit;
  return allResults;
}

/**
 * Directly scrapes all citing papers from Google Scholar
 */
export async function scrapeGoogleScholarCitations(citesIdOrUrl, maxPages = 50) {
  let targetUrl = '';
  const citesMatch = String(citesIdOrUrl).match(/cites=(\d+)/);
  const citesId = citesMatch ? citesMatch[1] : String(citesIdOrUrl).replace(/[^0-9]/g, '');

  if (citesId) {
    targetUrl = `https://scholar.google.com/scholar?cites=${citesId}&hl=en&scipsc=&filter=0`;
  } else if (String(citesIdOrUrl).startsWith('http')) {
    targetUrl = citesIdOrUrl;
  } else {
    targetUrl = `https://scholar.google.com/scholar?cites=${encodeURIComponent(citesIdOrUrl)}&hl=en&filter=0`;
  }

  const citingPapers = [];
  const seenTitles = new Set();

  for (let page = 0; page < maxPages; page++) {
    const start = page * 10;
    const separator = targetUrl.includes('?') ? '&' : '?';
    const pageUrl = `${targetUrl}${separator}start=${start}`;

    try {
      const res = await fetch(pageUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      });
      if (!res.ok) break;

      const html = await res.text();
      if (html.includes('detected unusual traffic') || html.includes('recaptcha')) {
        break;
      }

      const re = /<div class="gs_ri">([\s\S]*?)<\/div>\s*<\/div>/g;
      const matches = [...html.matchAll(re)];
      if (matches.length === 0) break;

      for (const m of matches) {
        const block = m[1];
        const titleMatch = block.match(/<h3[^>]* class="gs_rt"[^>]*>([\s\S]*?)<\/h3>/);
        if (!titleMatch) continue;

        const linkMatch = titleMatch[1].match(/href="([^"]+)"/);
        const cleanTitle = cleanText(titleMatch[1]);
        if (!cleanTitle || seenTitles.has(cleanTitle.toLowerCase())) continue;
        seenTitles.add(cleanTitle.toLowerCase());

        const authorMatch = block.match(/<div class="gs_a">([\s\S]*?)<\/div>/);
        const authorSummary = authorMatch ? cleanText(authorMatch[1]) : '';

        const ym = authorSummary.match(/\b(19\d{2}|20\d{2})\b/);
        const year = ym ? parseInt(ym[1], 10) : null;
        const parts = authorSummary.split(/\s+-\s+/);
        const authorPart = (parts[0] || '').replace(/…/g, '').trim();

        let journalPart = '';
        if (parts.length > 1) {
          journalPart = parts[1].replace(/,?\s*\b(19\d{2}|20\d{2})\b/g, '').trim();
        }
        if (!journalPart && parts.length > 2) {
          journalPart = parts[2].trim();
        }

        let paperUrl = linkMatch ? linkMatch[1].replace(/&amp;/g, '&') : '';
        if (paperUrl.startsWith('/')) {
          paperUrl = `https://scholar.google.com${paperUrl}`;
        }
        if (!paperUrl && cleanTitle) {
          paperUrl = `https://scholar.google.com/scholar?q=${encodeURIComponent(cleanTitle)}`;
        }

        citingPapers.push({
          title: cleanTitle,
          authors: authorPart || 'Academic Authors',
          journal: journalPart || 'Academic Journal',
          volume_issue: '',
          year,
          quarter: 'First',
          doi_issn: '',
          link: paperUrl
        });
      }
    } catch (err) {
      console.warn('[ScholarScraper] Citations page error:', err.message);
      break;
    }
  }

  // Enrich citing papers with CrossRef so all co-authors, journal, vol/issue, and quarter are populated
  await enrichBatchWithCrossRef(citingPapers, 5);

  return citingPapers;
}

/**
 * Directly scrapes a Google Scholar researcher profile and all their indexed publications
 */
export async function scrapeGoogleScholarProfile(profileUrlOrId) {
  if (!profileUrlOrId || typeof profileUrlOrId !== 'string') {
    throw new Error('Google Scholar profile URL or user ID is required');
  }

  let userId = profileUrlOrId.trim();
  const userMatch = userId.match(/[?&]user=([a-zA-Z0-9_-]+)/);
  if (userMatch) {
    userId = userMatch[1];
  }

  const url = `https://scholar.google.com/citations?user=${encodeURIComponent(userId)}&hl=en&cstart=0&pagesize=100`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`Google Scholar profile request failed with status ${res.status}`);
  }

  const html = await res.text();
  if (html.includes('detected unusual traffic') || html.includes('recaptcha')) {
    throw new Error('Google Scholar detected unusual traffic (CAPTCHA triggered). An Apify token will be used as fallback.');
  }

  // Profile details
  const nameMatch = html.match(/<div id="gsc_prf_in">([^<]+)<\/div>/);
  const name = nameMatch ? cleanText(nameMatch[1]) : '';

  const affilMatch = html.match(/<div class="gsc_prf_il"(?: id="[^"]*")?>([\s\S]*?)<\/div>/);
  const affiliation = affilMatch ? cleanText(affilMatch[1]) : '';

  const emailMatch = html.match(/<div[^>]*id="gsc_prf_ivh"[^>]*>([\s\S]*?)<\/div>/);
  const verifiedEmail = emailMatch ? cleanText(emailMatch[1]) : '';

  const imgTagMatch = html.match(/<img[^>]*id="gsc_prf_pup-img"[^>]*>/) || html.match(/<img[^>]*gsc_prf_pup[^>]*>/);
  let photoUrl = '';
  if (imgTagMatch) {
    const srcMatch = imgTagMatch[0].match(/src="([^"]+)"/);
    if (srcMatch) {
      photoUrl = srcMatch[1].replace(/&amp;/g, '&');
      if (photoUrl.startsWith('/')) {
        photoUrl = `https://scholar.google.com${photoUrl}`;
      }
    }
  }

  // Citation stats from table #gsc_rsb_st
  let totalCitations = 0;
  let hIndex = 0;
  let i10Index = 0;
  const statsMatch = html.match(/<table id="gsc_rsb_st"[\s\S]*?<\/table>/);
  if (statsMatch) {
    const statNums = [...statsMatch[0].matchAll(/<td class="gsc_rsb_std">(\d+)<\/td>/g)].map((m) => parseInt(m[1], 10));
    if (statNums.length >= 1) totalCitations = statNums[0];
    if (statNums.length >= 3) hIndex = statNums[2];
    if (statNums.length >= 5) i10Index = statNums[4];
  }

  const isPsuAffiliated = /pangasinan|psu\.edu\.ph|\bpsu\b/i.test(affiliation + ' ' + verifiedEmail);

  // Publications
  const publications = [];
  const rows = [...html.matchAll(/<tr class="gsc_a_tr">([\s\S]*?)<\/tr>/g)];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i][1];
    const titleMatch = row.match(/<a[^>]*class="gsc_a_at"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleMatch) continue;

    const title = cleanText(titleMatch[1]);
    if (!title) continue;

    const hrefMatch =
      row.match(/<a[^>]*href="([^"]+)"[^>]*class="gsc_a_at"/i) ||
      row.match(/<a[^>]*class="gsc_a_at"[^>]*href="([^"]+)"/i);
    let paperHref = hrefMatch ? hrefMatch[1].replace(/&amp;/g, '&') : '';
    if (paperHref && paperHref.startsWith('/')) {
      paperHref = `https://scholar.google.com${paperHref}`;
    }

    const grays = [...row.matchAll(/<div class="gs_gray">([\s\S]*?)<\/div>/g)];
    const authorRaw = grays[0] ? cleanText(grays[0][1]) : '';
    const authors = authorRaw
      ? authorRaw.split(',').map((a) => a.trim()).filter(Boolean)
      : [name || 'Author'];

    const journalRaw = grays[1] ? cleanText(grays[1][1]) : '';
    const citeMatch = row.match(/<a[^>]*class="gsc_a_ac[^"]*"[^>]*>(\d+)<\/a>/);
    const citations = citeMatch ? parseInt(citeMatch[1], 10) : 0;

    const citeHrefMatch =
      row.match(/<a[^>]*href="([^"]+)"[^>]*class="gsc_a_ac/i) ||
      row.match(/<a[^>]*class="gsc_a_ac[^"]*"[^>]*href="([^"]+)"/i);
    const citedByLink =
      citeHrefMatch && citeHrefMatch[1] && citeHrefMatch[1].startsWith('http')
        ? citeHrefMatch[1].replace(/&amp;/g, '&')
        : '';

    const yearMatch = row.match(/<span[^>]*class="gsc_a_h[^"]*"[^>]*>(\d{4})<\/span>/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    publications.push({
      id: `gsp-${userId}-${i + 1}`,
      title,
      authors,
      journal: journalRaw || 'Academic Publication',
      year,
      citations,
      url: paperHref,
      citedByLink,
      abstract: '',
    });
  }

  await enrichBatchWithCrossRef(publications, 5);

  return {
    profile: {
      userId,
      scholarUrl: `https://scholar.google.com/citations?user=${userId}&hl=en`,
      name,
      affiliation,
      verifiedEmail,
      photoUrl,
      totalCitations,
      hIndex,
      i10Index,
      isPsuAffiliated,
    },
    publications,
  };
}

