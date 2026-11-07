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
  if (!paper || (!paper.title && !paper.doi && !paper.doi_issn)) return paper;
  try {
    const cleanTitle = cleanText(paper.title || '');
    const normTarget = normalizeForMatch(cleanTitle);

    let cleanDoi = '';
    const rawDoi = `${paper.doi || ''} ${paper.doi_issn || ''} ${paper.link || ''} ${paper.url || ''}`;
    const doiMatch = rawDoi.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/);
    if (doiMatch) {
      cleanDoi = doiMatch[1].replace(/[.,;]+$/, '').replace(/\.s\d+$/i, '').replace(/\/v\d+\/review\d+$/i, '');
    }

    let matchedItem = null;

    // 1. Direct CrossRef DOI lookup if DOI is known
    if (cleanDoi) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);
        const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, {
          headers: {
            'User-Agent': 'PSUResearchTracker/1.0 (mailto:research@psu.edu.ph)',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          const d = await res.json();
          if (d?.message && d.message.type !== 'component' && (Array.isArray(d.message.author) || d.message.published)) {
            matchedItem = d.message;
          }
        }
      } catch {}
    }

    // 2. Query by title if not resolved by DOI
    if (!matchedItem && normTarget && normTarget.length >= 6) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const url = `https://api.crossref.org/works?query.title=${encodeURIComponent(cleanTitle)}&rows=5`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'PSUResearchTracker/1.0 (mailto:research@psu.edu.ph)',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        const rawItems = data?.message?.items;
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          // Exclude component/supplementary items (.s001, etc.)
          const items = rawItems.filter((it) => it.type !== 'component' && !/\.s\d+$/i.test(it.DOI || ''));
          const candidatePool = items.length > 0 ? items : rawItems;
          const targetWords = normTarget.split(' ').filter((w) => w.length > 2);
          for (const candidate of candidatePool) {
            const candTitle = normalizeForMatch(candidate?.title?.[0] || '');
            if (!candTitle) continue;
            const hasAuthors = Array.isArray(candidate.author) && candidate.author.length > 0;
            if (candTitle === normTarget || candTitle.includes(normTarget) || normTarget.includes(candTitle)) {
              matchedItem = candidate;
              if (hasAuthors) break;
            }
            const hits = targetWords.filter((w) => candTitle.includes(w)).length;
            if (targetWords.length > 0 && hits / targetWords.length >= 0.75) {
              matchedItem = candidate;
              if (hasAuthors) break;
            }
          }
        }
      }
    }

    if (matchedItem) {
      // 1. Full Authors list (Lead researcher + all co-researchers)
      const rawAuthors = (Array.isArray(matchedItem.author) && matchedItem.author.length > 0)
        ? matchedItem.author
        : (Array.isArray(matchedItem.editor) && matchedItem.editor.length > 0 ? matchedItem.editor : []);

      if (rawAuthors.length > 0) {
        const fullAuthors = rawAuthors
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
      if (containerTitle && (!paper.journal || paper.journal === 'Academic Publication' || paper.journal === 'American Chemical Society (ACS)' || paper.journal.length < containerTitle.length)) {
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
        matchedItem.issued?.['date-parts']?.[0] ||
        matchedItem.created?.['date-parts']?.[0];

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
    }

    // 8. OpenAlex Fallback if authors, year, volume_issue, or journal remain incomplete
    const currentAuthorsStr = Array.isArray(paper.authors) ? paper.authors.join(', ') : String(paper.authors || '');
    const isAuthorsMissing = !paper.authors || currentAuthorsStr === 'Academic Authors' || currentAuthorsStr.includes('Academic Authors');
    const isJournalGeneric = !paper.journal || paper.journal === 'Academic Publication' || paper.journal === 'Academic Journal' || paper.journal.includes('(ACS)');
    if ((isAuthorsMissing || !paper.year || !paper.volume_issue || isJournalGeneric) && (cleanDoi || cleanTitle)) {
      try {
        let best = null;
        if (cleanDoi) {
          try {
            const oaRes = await fetch(`https://api.openalex.org/works/doi:${cleanDoi}`, {
              headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' },
            });
            if (oaRes.ok) {
              best = await oaRes.json();
            }
          } catch {}
        }
        if (!best && cleanTitle) {
          const oaRes = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(cleanTitle)}&per-page=3`, {
            headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' },
          });
          if (oaRes.ok) {
            const oaData = await oaRes.json();
            const results = oaData?.results || [];
            for (const r of results) {
              const rTitle = normalizeForMatch(r.title || '');
              if (rTitle === normTarget || rTitle.includes(normTarget) || normTarget.includes(rTitle)) {
                best = r;
                break;
              }
            }
            if (!best && results.length > 0) {
              best = results[0];
            }
          }
        }

        if (best) {
          if (Array.isArray(best.authorships) && best.authorships.length > 0 && isAuthorsMissing) {
            const oaAuthors = best.authorships.map((a) => a?.author?.display_name).filter(Boolean);
            if (oaAuthors.length > 0) {
              paper.authors = Array.isArray(paper.authors) ? oaAuthors : oaAuthors.join(', ');
            }
          }
          if (best.publication_year && !paper.year) {
            paper.year = Number(best.publication_year);
          }
          if (best.primary_location?.source?.display_name && isJournalGeneric) {
            paper.journal = best.primary_location.source.display_name;
          }
          if (!paper.volume_issue && best.biblio) {
            const bib = best.biblio;
            const volParts = [];
            if (bib.volume) volParts.push(`Vol. ${bib.volume}`);
            if (bib.issue) volParts.push(`No. ${bib.issue}`);
            if (bib.first_page) {
              volParts.push(bib.last_page && bib.last_page !== bib.first_page ? `pp. ${bib.first_page}-${bib.last_page}` : `pp. ${bib.first_page}`);
            }
            if (volParts.length > 0) {
              paper.volume_issue = volParts.join(', ');
            }
          }
          if (best.publication_date) {
            const m = parseInt(String(best.publication_date).split('-')[1], 10);
            if (m) paper.quarter = getQuarterFromMonth(m);
          }
          if (best.doi && (!paper.doi || /\.s\d+$/i.test(paper.doi))) {
            const cleanBestDoi = String(best.doi).replace(/^https?:\/\/doi\.org\//i, '');
            paper.doi = cleanBestDoi;
            paper.doi_issn = `DOI: ${cleanBestDoi}`;
            paper.link = `https://doi.org/${cleanBestDoi}`;
          }
        }
      } catch {}
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
            continue;
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
 * Fetches citing papers from OpenAlex + Semantic Scholar + CrossRef (free, no rate-limit/CAPTCHA)
 * using either the paper's DOI or title, returning complete co-authors, journal, vol/issue, year, quarter, and link
 * up to `maxResults`.
 */
export async function fetchCitingPapersFromOpenAlex(paper, maxResults = 10000) {
  if (!paper || (!paper.title && !paper.doi && !paper.issn_isbn)) return [];

  const normalizeCompareTitle = (str) =>
    String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const results = [];
  const seenKeys = new Set();
  const cleanSearchTitle = String(paper.title || '')
    .replace(/\.\s*Technologies.*$/i, '')
    .replace(/,\s*Technologies.*$/i, '')
    .trim();
  const normParent = normalizeCompareTitle(cleanSearchTitle);

  const addUniqueCiting = (entry) => {
    if (results.length >= maxResults) return;
    const normT = normalizeCompareTitle(entry.title || '');
    if (!normT || normT.length < 8) return;
    if (normParent && (normT === normParent || normT.includes(normParent) || normParent.includes(normT))) {
      return; // Skip self-matches
    }
    if (seenKeys.has(normT)) return;
    seenKeys.add(normT);
    results.push(entry);
  };

  try {
    let openAlexWorkId = null;
    const rawDoiStr = `${paper.doi || ''} ${paper.issn_isbn || ''} ${paper.url || ''}`;
    const doiMatch = rawDoiStr.match(/\b(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)\b/);
    const cleanDoi = doiMatch ? doiMatch[1].replace(/[.,;]+$/, '') : '';

    // 1. Try resolving via DOI on OpenAlex
    if (cleanDoi) {
      try {
        let doiRes = await fetch(`https://api.openalex.org/works/doi:${cleanDoi}`, {
          headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' },
        });
        if (!doiRes.ok) {
          doiRes = await fetch(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}`, {
            headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' },
          });
        }
        if (doiRes.ok) {
          const doiData = await doiRes.json();
          if (doiData?.id) {
            openAlexWorkId = doiData.id.split('/').pop();
          }
        }
      } catch {}
    }

    // 2. Fallback to title search on OpenAlex if no DOI match
    if (!openAlexWorkId && cleanSearchTitle) {
      try {
        const searchUrl = `https://api.openalex.org/works?search=${encodeURIComponent(cleanSearchTitle)}&per-page=5`;
        const searchRes = await fetch(searchUrl, {
          headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' },
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const items = searchData?.results || [];
          for (const candidate of items) {
            const candTitle = candidate?.title || candidate?.display_name || '';
            const normCand = normalizeCompareTitle(candTitle);
            if (normCand && (normCand === normParent || normCand.includes(normParent) || normParent.includes(normCand))) {
              openAlexWorkId = candidate.id.split('/').pop();
              break;
            }
          }
        }
      } catch {}
    }

    // 3. Fetch citing works from OpenAlex using Cursor Pagination (supports 1,000 to 10,000+ citations without page limits)
    if (openAlexWorkId) {
      let cursor = '*';
      let safetyPages = 0;
      const maxCursorPages = Math.ceil(maxResults / 200) + 5;
      while (cursor && results.length < maxResults && safetyPages < maxCursorPages) {
        safetyPages++;
        const citesUrl = `https://api.openalex.org/works?filter=cites:${openAlexWorkId}&per-page=200&cursor=${encodeURIComponent(cursor)}`;
        let citesRes = await fetch(citesUrl, {
          headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' },
        });
        if (!citesRes.ok && citesRes.status === 429) {
          await new Promise((r) => setTimeout(r, 600));
          citesRes = await fetch(citesUrl, {
            headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' },
          });
        }
        if (!citesRes.ok) break;
        const citesData = await citesRes.json();
        const works = citesData?.results || [];
        if (works.length === 0) break;

        for (const w of works) {
          if (results.length >= maxResults) break;
          const wTitle = cleanText(w.title || w.display_name || '');
          if (!wTitle) continue;

          const wAuthors = Array.isArray(w.authorships)
            ? w.authorships.map((a) => a?.author?.display_name).filter(Boolean).join(', ')
            : '';

          const wJournal =
            w.primary_location?.source?.display_name ||
            w.host_venue?.display_name ||
            'Academic Journal';

          const bib = w.biblio || {};
          const volParts = [];
          if (bib.volume) volParts.push(`Vol. ${bib.volume}`);
          if (bib.issue) volParts.push(`No. ${bib.issue}`);
          if (bib.first_page) {
            volParts.push(
              bib.last_page && bib.last_page !== bib.first_page
                ? `pp. ${bib.first_page}-${bib.last_page}`
                : `pp. ${bib.first_page}`
            );
          }

          let quarter = 'First';
          if (w.publication_date) {
            const m = parseInt(String(w.publication_date).split('-')[1], 10);
            if (m >= 1 && m <= 3) quarter = 'First';
            else if (m >= 4 && m <= 6) quarter = 'Second';
            else if (m >= 7 && m <= 9) quarter = 'Third';
            else if (m >= 10 && m <= 12) quarter = 'Fourth';
          }

          const cleanWdoi = w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//i, '') : '';
          const issnL = w.primary_location?.source?.issn_l || '';
          const doiIssn = cleanWdoi ? `DOI: ${cleanWdoi}` : issnL ? `ISSN ${issnL}` : '';
          const link = w.doi || w.primary_location?.landing_page_url || w.id || '';

          addUniqueCiting({
            title: wTitle,
            authors: wAuthors || 'Academic Authors',
            journal: wJournal,
            volume_issue: volParts.join(', '),
            year: w.publication_year || null,
            quarter,
            doi_issn: doiIssn,
            link,
          });
        }

        cursor = citesData?.meta?.next_cursor || null;
        if (works.length < 200 || results.length >= maxResults) break;
      }
    }

    // 4. Supplement with Semantic Scholar Graph API (paginated in batches of 100 up to 10,000) if we still need more citing papers
    if (results.length < maxResults) {
      try {
        let s2PaperId = cleanDoi ? `DOI:${cleanDoi}` : null;
        if (!s2PaperId && cleanSearchTitle) {
          const s2Search = await fetch(
            `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(cleanSearchTitle)}&limit=3&fields=title`,
            { headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' } }
          );
          if (s2Search.ok) {
            const s2SearchData = await s2Search.json();
            const match = (s2SearchData?.data || []).find((cand) => {
              const nc = normalizeCompareTitle(cand?.title || '');
              return nc && (nc === normParent || nc.includes(normParent) || normParent.includes(nc));
            });
            if (match?.paperId) s2PaperId = match.paperId;
          }
        }

        if (s2PaperId) {
          const s2Limit = 100;
          for (let offset = 0; offset < Math.min(maxResults, 9000) && results.length < maxResults; offset += s2Limit) {
            const s2Res = await fetch(
              `https://api.semanticscholar.org/graph/v1/paper/${encodeURIComponent(s2PaperId)}/citations?fields=title,authors,year,venue,publicationDate,externalIds,url&offset=${offset}&limit=${s2Limit}`,
              { headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' } }
            );
            if (!s2Res.ok) break;
            const s2Data = await s2Res.json();
            const rows = s2Data?.data || [];
            if (rows.length === 0) break;

            for (const row of rows) {
              if (results.length >= maxResults) break;
              const cp = row?.citingPaper;
              if (!cp?.title) continue;
              const cpAuthors = Array.isArray(cp.authors)
                ? cp.authors.map((a) => a?.name).filter(Boolean).join(', ')
                : 'Academic Authors';
              let quarter = 'First';
              if (cp.publicationDate) {
                const m = parseInt(String(cp.publicationDate).split('-')[1], 10);
                if (m >= 1 && m <= 3) quarter = 'First';
                else if (m >= 4 && m <= 6) quarter = 'Second';
                else if (m >= 7 && m <= 9) quarter = 'Third';
                else if (m >= 10 && m <= 12) quarter = 'Fourth';
              }
              const s2Doi = cp.externalIds?.DOI || '';
              addUniqueCiting({
                title: cleanText(cp.title),
                authors: cpAuthors || 'Academic Authors',
                journal: cp.venue || 'Academic Journal',
                volume_issue: '',
                year: cp.year || null,
                quarter,
                doi_issn: s2Doi ? `DOI: ${s2Doi}` : '',
                link: s2Doi ? `https://doi.org/${s2Doi}` : cp.url || '',
              });
            }

            if (rows.length < s2Limit) break;
          }
        }
      } catch {}
    }

    // 5. Supplement with CrossRef Bibliographic Query (fully offset-paginated) if we still need more citing papers to reach maxResults
    if (results.length < maxResults && cleanSearchTitle) {
      try {
        const crRowsPerPage = 100;
        const needed = maxResults - results.length;
        const maxOffset = Math.min(needed + 100, 2000);
        for (let offset = 0; offset < maxOffset && results.length < maxResults; offset += crRowsPerPage) {
          const crUrl = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(cleanSearchTitle)}&rows=${crRowsPerPage}&offset=${offset}`;
          const crRes = await fetch(crUrl, {
            headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' },
          });
          if (!crRes.ok) break;
          const crData = await crRes.json();
          const items = crData?.message?.items || [];
          if (items.length === 0) break;

          for (const item of items) {
            if (results.length >= maxResults) break;
            // Strictly exclude CrossRef component items and supplementary files (.s001, etc.)
            if (item.type === 'component' || (item.DOI && /\.s\d+$/i.test(item.DOI))) continue;
            const cTitle = Array.isArray(item.title) ? item.title[0] : '';
            if (!cTitle) continue;
            const cAuthors = Array.isArray(item.author)
              ? item.author
                  .map((a) => [a.given, a.family].filter(Boolean).join(' ') || a.name || '')
                  .filter(Boolean)
                  .join(', ')
              : 'Academic Authors';
            const cJournal =
              (Array.isArray(item['container-title']) && item['container-title'][0]) ||
              item.publisher ||
              'Academic Journal';
            const volParts = [];
            if (item.volume) volParts.push(`Vol. ${item.volume}`);
            if (item.issue) volParts.push(`No. ${item.issue}`);
            if (item.page) volParts.push(`pp. ${item.page}`);
            const dateParts =
              item.published?.['date-parts']?.[0] ||
              item['published-print']?.['date-parts']?.[0] ||
              item['published-online']?.['date-parts']?.[0] ||
              [];
            const cYear = dateParts[0] || null;
            const cMonth = dateParts[1] || 1;
            const quarter =
              cMonth <= 3 ? 'First' : cMonth <= 6 ? 'Second' : cMonth <= 9 ? 'Third' : 'Fourth';

            addUniqueCiting({
              title: cleanText(cTitle),
              authors: cAuthors || 'Academic Authors',
              journal: cleanText(cJournal),
              volume_issue: volParts.join(', '),
              year: cYear,
              quarter,
              doi_issn: item.DOI ? `DOI: ${item.DOI}` : '',
              link: item.DOI ? `https://doi.org/${item.DOI}` : item.URL || '',
            });
          }
          if (items.length < crRowsPerPage) break;
        }
      } catch {}
    }

    // 6. Supplement with Google Scholar direct citation scraping if still below maxResults and cited_by_link is available
    if (results.length < maxResults && paper.cited_by_link) {
      try {
        const neededPages = Math.min(Math.ceil((maxResults - results.length) / 10) + 1, 20);
        const gsCiting = await scrapeGoogleScholarCitations(paper.cited_by_link, neededPages);
        for (const gc of gsCiting) {
          if (results.length >= maxResults) break;
          addUniqueCiting(gc);
        }
      } catch {}
    }

    return results.slice(0, maxResults);
  } catch (err) {
    console.warn('[OpenAlexCitations] Error fetching citing works:', err.message);
    return results.slice(0, maxResults);
  }
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

  // Publications (support researchers with 100+ papers via cstart pagination)
  const publications = [];
  let currentHtml = html;
  for (let cstart = 0; cstart <= 500; cstart += 100) {
    if (cstart > 0) {
      try {
        const nextUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(userId)}&hl=en&cstart=${cstart}&pagesize=100`;
        const nextRes = await fetch(nextUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
          },
        });
        if (!nextRes.ok) break;
        currentHtml = await nextRes.text();
      } catch {
        break;
      }
    }

    const rows = [...currentHtml.matchAll(/<tr class="gsc_a_tr">([\s\S]*?)<\/tr>/g)];
    if (rows.length === 0) break;

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
        id: `gsp-${userId}-${publications.length + 1}`,
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

    if (rows.length < 100) break;
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

/**
 * Reconstruct readable abstract text from OpenAlex inverted index
 */
function reconstructOpenAlexAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const wordPairs = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (Array.isArray(positions)) {
      for (const pos of positions) {
        wordPairs.push([pos, word]);
      }
    }
  }
  wordPairs.sort((a, b) => a[0] - b[0]);
  return wordPairs.map((p) => p[1]).join(' ');
}

/**
 * Multi-source academic search fallback & supplement (CrossRef API + OpenAlex API)
 * Universal academic search across titles, author names, institutions (e.g. Pangasinan State University), and topics.
 */
export async function searchOpenAlexAndCrossRef(rawQuery, page = 0, limit = 10) {
  const cleanQ = String(rawQuery || '')
    .replace(/^author:\s*"?/i, '')
    .replace(/"$/g, '')
    .trim();
  if (!cleanQ) return [];

  const isExplicitAuthor = /^author:/i.test(String(rawQuery || '').trim());
  const words = cleanQ.split(/\s+/).filter(Boolean);
  const nameTokens = cleanQ
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !['sir', 'maam', 'dr', 'prof', 'mr', 'ms', 'mrs', 'engr', 'atty'].includes(w));

  const isPersonNameQuery =
    isExplicitAuthor ||
    (words.length >= 2 &&
      words.length <= 4 &&
      nameTokens.length >= 2 &&
      nameTokens.length <= 3 &&
      !/university|college|school|campus|department|journal|republic|philippines|state|system|analysis|development|assessment|evaluation|education|technology|learning|management|farming|agriculture|arduino|iot|model|framework|study|impact|effect|design|implementation/i.test(cleanQ));

  const matchesPersonAuthorList = (authorsArr) => {
    if (!Array.isArray(authorsArr) || authorsArr.length === 0) return false;
    if (nameTokens.length === 0) return false;
    const targetLast = nameTokens[nameTokens.length - 1];
    const targetFirst = nameTokens[0];
    const targetFirstInitial = targetFirst[0];

    return authorsArr.some((a) => {
      const aNorm = String(a || '')
        .toLowerCase()
        .replace(/[^a-z\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!aNorm) return false;
      const aWords = aNorm.split(' ');
      if (!aWords.includes(targetLast)) return false;
      if (nameTokens.length === 1) return true;
      return (
        aWords.includes(targetFirst) ||
        aWords.some((w) => w !== targetLast && (w.startsWith(targetFirst) || (w.length <= 3 && w.startsWith(targetFirstInitial))))
      );
    });
  };

  const results = [];
  const seenNorm = new Set();
  const addResult = (item) => {
    const norm = normalizeForMatch(item.title || '');
    if (!norm || norm.length < 5 || seenNorm.has(norm)) return;
    seenNorm.add(norm);
    results.push(item);
  };

  const EXCLUDED_CROSSREF_TYPES = new Set([
    'component',
    'reference-entry',
    'reference-book',
    'dataset',
    'peer-review',
    'grant',
    'standard',
  ]);

  // 1. CrossRef Search: Comprehensive, un-rate-limited global academic index
  try {
    const crQueryParam = isPersonNameQuery
      ? `query.author=${encodeURIComponent(nameTokens.join(' '))}`
      : `query=${encodeURIComponent(cleanQ)}`;
    const crUrl = `https://api.crossref.org/works?${crQueryParam}&rows=25&offset=${page * 15}`;
    const crRes = await fetch(crUrl, {
      headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' },
    });
    if (crRes.ok) {
      const crData = await crRes.json();
      for (const item of crData?.message?.items || []) {
        // Strictly exclude component/reference/dictionary items and supplementary files (.s001, etc.)
        if (EXCLUDED_CROSSREF_TYPES.has(item.type) || (item.DOI && /(\.s\d+|\/benz\/)/i.test(item.DOI))) continue;
        const cTitle = Array.isArray(item.title) ? cleanText(item.title[0]) : '';
        if (!cTitle) continue;
        const cAuthors = Array.isArray(item.author)
          ? item.author
              .map((a) => [a.given, a.family].filter(Boolean).join(' ') || a.name || '')
              .filter(Boolean)
          : [];

        // Never fabricate authors on anonymous/dictionary entries
        if (cAuthors.length === 0) continue;
        if (isPersonNameQuery && !matchesPersonAuthorList(cAuthors)) continue;

        const cJournal =
          (Array.isArray(item['container-title']) && item['container-title'][0]) ||
          item.publisher ||
          'Academic Publication';
        if (/\b(benezit dictionary|oxford art online|who's who)\b/i.test(cJournal)) continue;

        const crAffiliations = [];
        if (Array.isArray(item.author)) {
          for (const a of item.author) {
            if (Array.isArray(a.affiliation)) {
              for (const aff of a.affiliation) {
                if (aff?.name) crAffiliations.push(aff.name);
              }
            }
          }
        }
        const cAffiliation = [...new Set(crAffiliations)].join('; ');

        const dateParts =
          item.published?.['date-parts']?.[0] ||
          item['published-print']?.['date-parts']?.[0] ||
          item['published-online']?.['date-parts']?.[0] ||
          [];
        const cYear = dateParts[0] || new Date().getFullYear();

        addResult({
          id: `cr-${hashString(item.DOI || cTitle)}`,
          title: cTitle,
          authors: cAuthors,
          journal: cleanText(cJournal),
          affiliation: cAffiliation,
          year: Number(cYear),
          citations: Number(item['is-referenced-by-count']) || 0,
          abstract: item.abstract ? cleanText(item.abstract) : '',
          url: item.DOI ? `https://doi.org/${item.DOI}` : item.URL || '',
          pdfUrl: Array.isArray(item.link) ? item.link.find((l) => l['content-type']?.includes('pdf'))?.URL || null : null,
          citedByLink: '',
          fromCache: false,
        });
      }
    }
  } catch (crErr) {
    console.warn('[HybridSearch] CrossRef search error:', crErr.message);
  }

  // Helper to parse OpenAlex works with full institution / affiliation data
  const parseOpenAlexWork = (w) => {
    const wTitle = cleanText(w.title || w.display_name || '');
    if (!wTitle) return;
    const wAuthors = Array.isArray(w.authorships)
      ? w.authorships.map((a) => a?.author?.display_name).filter(Boolean)
      : [];

    // Never fabricate the search query as an author if the work has no authors
    if (wAuthors.length === 0) return;
    if (isPersonNameQuery && !matchesPersonAuthorList(wAuthors)) return;

    const wJournal =
      w.primary_location?.source?.display_name ||
      w.host_venue?.display_name ||
      'Academic Publication';
    if (/\b(benezit dictionary|oxford art online)\b/i.test(wJournal)) return;

    const wInstitutions = [];
    if (Array.isArray(w.authorships)) {
      for (const a of w.authorships) {
        if (Array.isArray(a.institutions)) {
          for (const inst of a.institutions) {
            if (inst?.display_name) wInstitutions.push(inst.display_name);
          }
        }
      }
    }
    const wAffiliation = [...new Set(wInstitutions)].join('; ');

    const wUrl = w.doi || w.primary_location?.landing_page_url || w.id || '';
    const fullAbstract = reconstructOpenAlexAbstract(w.abstract_inverted_index);

    addResult({
      id: `oa-${w.id?.split('/').pop() || hashString(wTitle)}`,
      title: wTitle,
      authors: wAuthors,
      journal: wJournal,
      affiliation: wAffiliation,
      year: w.publication_year || new Date().getFullYear(),
      citations: Number(w.cited_by_count) || 0,
      abstract: fullAbstract,
      url: wUrl,
      pdfUrl: w.open_access?.oa_url || null,
      citedByLink: '',
      fromCache: false,
    });
  };

  // 2. OpenAlex Search: full author resolution OR multi-tier topic search with reconstructed abstracts
  try {
    if (isPersonNameQuery) {
      try {
        const searchNames = [...new Set([cleanQ, nameTokens.join(' ')].filter(Boolean))];
        const authorIdSet = new Set();
        for (const sName of searchNames) {
          const authUrl = `https://api.openalex.org/authors?filter=display_name.search:${encodeURIComponent(sName)}&per-page=5&mailto=research@psu.edu.ph`;
          const authRes = await fetch(authUrl, {
            headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' },
          });
          if (authRes.ok) {
            const authData = await authRes.json();
            for (const a of authData?.results || []) {
              const idPart = a?.id?.split('/').pop();
              if (idPart && matchesPersonAuthorList([a.display_name])) {
                authorIdSet.add(idPart);
              }
            }
          }
        }

        const authorIds = [...authorIdSet];
        if (authorIds.length > 0) {
          const worksUrl = `https://api.openalex.org/works?filter=authorships.author.id:${authorIds.join('|')}&per-page=20&page=${page + 1}&sort=cited_by_count:desc&mailto=research@psu.edu.ph`;
          const worksRes = await fetch(worksUrl, {
            headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' },
          });
          if (worksRes.ok) {
            const worksData = await worksRes.json();
            for (const w of worksData?.results || []) {
              parseOpenAlexWork(w);
            }
          }
        }
      } catch {}
    } else {
      // Topic / Content Search: 3-tier concurrent search
      // Query 1: Topic + PSU (pulling local campus literature)
      // Query 2: Topic + Philippines (pulling nationwide literature)
      // Query 3: Topic Global (pulling top worldwide literature)
      try {
        const searchUrls = [
          `https://api.openalex.org/works?search=${encodeURIComponent(cleanQ + ' Pangasinan State University')}&per-page=15&sort=relevance_score:desc&mailto=research@psu.edu.ph`,
          `https://api.openalex.org/works?search=${encodeURIComponent(cleanQ + ' Philippines')}&per-page=20&sort=relevance_score:desc&mailto=research@psu.edu.ph`,
          `https://api.openalex.org/works?search=${encodeURIComponent(cleanQ)}&per-page=25&page=${page + 1}&sort=relevance_score:desc&mailto=research@psu.edu.ph`,
        ];

        const openAlexResponses = await Promise.all(
          searchUrls.map((url) =>
            fetch(url, { headers: { 'User-Agent': 'PSUResearchPortal/1.0 (mailto:research@psu.edu.ph)' } })
              .then((r) => (r.ok ? r.json() : { results: [] }))
              .catch(() => ({ results: [] }))
          )
        );

        for (const data of openAlexResponses) {
          for (const w of data?.results || []) {
            parseOpenAlexWork(w);
          }
        }
      } catch (genErr) {
        console.warn('[HybridSearch] OpenAlex works search error:', genErr.message);
      }
    }
  } catch (oaErr) {
    console.warn('[HybridSearch] OpenAlex search error:', oaErr.message);
  }

  return results;
}

