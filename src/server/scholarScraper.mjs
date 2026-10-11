/**
 * Google Scholar Direct & Hybrid Scraper
 * Extracts complete, accurate search results and citing papers from Google Scholar.
 */

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]+>/g, '')
    .replace(/^\[[A-Z]+\]\s*/gi, '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Directly scrapes Google Scholar search results for a given query
 */
export async function scrapeGoogleScholarDirect(query, maxPages = 2) {
  const allResults = [];
  const seenTitles = new Set();

  for (let page = 0; page < maxPages; page++) {
    const start = page * 10;
    const url = `https://scholar.google.com/scholar?q=${encodeURIComponent(query)}&hl=en&start=${start}`;
    try {
      const res = await fetch(url, {
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

        const snippetMatch = block.match(/<div class="gs_rs">([\s\S]*?)<\/div>/);
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        // Cites link and count
        const citesMatch = block.match(/href="(\/scholar\?cites=(\d+)[^"]*)"[^>]*>Cited by (\d+)</i);
        let citedByLink = '';
        let citations = 0;
        let citesId = '';
        if (citesMatch) {
          citesId = citesMatch[2];
          citedByLink = `https://scholar.google.com${citesMatch[1].replace(/&amp;/g, '&')}`;
          citations = parseInt(citesMatch[3], 10) || 0;
        }

        // Year extraction
        const ym = authorSummary.match(/\b(19\d{2}|20\d{2})\b/);
        const year = ym ? parseInt(ym[1], 10) : new Date().getFullYear();

        // Authors extraction
        const authorPart = authorSummary.split('-')[0]?.trim() || '';
        let authors = [];
        if (authorPart) {
          authors = authorPart.split(',').map(a => a.trim()).filter(Boolean);
        }
        if (authors.length === 0) {
          authors = [query];
        }

        // Journal
        const parts = authorSummary.split('-');
        let journal = 'Academic Publication';
        if (parts.length > 1) {
          journal = parts[1].trim();
        }

        const id = citesId ? `gs-${citesId}` : `gs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const paperUrl = linkMatch ? linkMatch[1].replace(/&amp;/g, '&') : '';

        allResults.push({
          id,
          title: cleanTitle,
          authors,
          journal,
          year,
          citations,
          abstract: snippet,
          url: paperUrl,
          citedByLink,
          fromCache: false
        });
      }
    } catch (err) {
      console.warn('[ScholarScraper] Direct search page error:', err.message);
      break;
    }
  }

  return allResults;
}

/**
 * Directly scrapes all citing papers from Google Scholar
 */
export async function scrapeGoogleScholarCitations(citesIdOrUrl, maxPages = 4) {
  let targetUrl = '';
  if (citesIdOrUrl.startsWith('http')) {
    targetUrl = citesIdOrUrl;
  } else {
    targetUrl = `https://scholar.google.com/scholar?cites=${encodeURIComponent(citesIdOrUrl)}&hl=en`;
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
        const authorPart = authorSummary.split('-')[0]?.trim() || '';

        const paperUrl = linkMatch ? linkMatch[1].replace(/&amp;/g, '&') : '';

        citingPapers.push({
          title: cleanTitle,
          authors: authorPart || 'Academic Authors',
          year,
          link: paperUrl
        });
      }
    } catch (err) {
      console.warn('[ScholarScraper] Citations page error:', err.message);
      break;
    }
  }

  return citingPapers;
}
