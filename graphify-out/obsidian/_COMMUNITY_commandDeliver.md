---
type: community
cohesion: 0.27
members: 17
---

# commandDeliver

**Cohesion:** 0.27 - loosely connected
**Members:** 17 nodes

## Members
- [[cleanText()]] - code - src/server/scholarScraper.mjs
- [[enrichBatchWithCrossRef()]] - code - src/server/scholarScraper.mjs
- [[enrichPaperWithCrossRef()]] - code - src/server/scholarScraper.mjs
- [[extractKeywordsFromText()]] - code - src/server/scholarScraper.mjs
- [[fetchCitingPapersFromOpenAlex()]] - code - src/server/scholarScraper.mjs
- [[getQuarterFromMonth()]] - code - src/server/scholarScraper.mjs
- [[hashString()]] - code - src/server/scholarScraper.mjs
- [[isInitialsToken()]] - code - src/server/scholarScraper.mjs
- [[levenshteinDistance()]] - code - src/server/scholarScraper.mjs
- [[matchAuthorName()]] - code - src/server/scholarScraper.mjs
- [[normalizeForMatch()]] - code - src/server/scholarScraper.mjs
- [[reconstructOpenAlexAbstract()]] - code - src/server/scholarScraper.mjs
- [[scholarScraper.mjs]] - code - src/server/scholarScraper.mjs
- [[scrapeGoogleScholarCitations()]] - code - src/server/scholarScraper.mjs
- [[scrapeGoogleScholarDirect()]] - code - src/server/scholarScraper.mjs
- [[scrapeGoogleScholarProfile()]] - code - src/server/scholarScraper.mjs
- [[searchOpenAlexAndCrossRef()]] - code - src/server/scholarScraper.mjs

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/commandDeliver
SORT file.name ASC
```

## Connections to other communities
- 19 edges to [[_COMMUNITY_render-class.mjs]]

## Top bridge nodes
- [[scholarScraper.mjs]] - degree 17, connects to 1 community
- [[enrichPaperWithCrossRef()]] - degree 8, connects to 1 community
- [[searchOpenAlexAndCrossRef()]] - degree 8, connects to 1 community
- [[enrichBatchWithCrossRef()]] - degree 7, connects to 1 community
- [[matchAuthorName()]] - degree 6, connects to 1 community