---
type: community
cohesion: 0.16
members: 34
---

# render-class.mjs

**Cohesion:** 0.16 - loosely connected
**Members:** 34 nodes

## Members
- [[activeCitationSyncJobs]] - code - src/server/apiHandler.mjs
- [[apiHandler.mjs]] - code - src/server/apiHandler.mjs
- [[attachTokenUsage()]] - code - src/server/apiHandler.mjs
- [[authHelper.mjs]] - code - src/server/authHelper.mjs
- [[authenticateCaller()]] - code - src/server/authHelper.mjs
- [[canCallerAccessPublication()]] - code - src/server/authHelper.mjs
- [[canCallerModifyPublication()]] - code - src/server/authHelper.mjs
- [[canCallerModifyResearcher()]] - code - src/server/authHelper.mjs
- [[cleanupOrphanedPublications()]] - code - src/server/apiHandler.mjs
- [[computePublicationCitationYears()]] - code - src/server/apiHandler.mjs
- [[deleteResearcherPublications()]] - code - src/server/apiHandler.mjs
- [[enqueuePublicationCitationSync()]] - code - src/server/apiHandler.mjs
- [[extractTopicVariants()]] - code - src/server/apiHandler.mjs
- [[fetchApifyTokenUsage()]] - code - src/server/apiHandler.mjs
- [[filterPublicationsForCaller()]] - code - src/server/authHelper.mjs
- [[getActiveApifyTokenRow()]] - code - src/server/apiHandler.mjs
- [[handleApiRequest()]] - code - src/server/apiHandler.mjs
- [[hasWordMatch()]] - code - src/server/apiHandler.mjs
- [[hashPassword()]] - code - src/server/authHelper.mjs
- [[inferCitingPaperYear()]] - code - src/server/apiHandler.mjs
- [[isCallerAdmin()]] - code - src/server/authHelper.mjs
- [[isCallerPublicationOwner()]] - code - src/server/authHelper.mjs
- [[matchesResearcher()_1]] - code - src/server/authHelper.mjs
- [[recalculateAllResearcherStats()]] - code - src/server/apiHandler.mjs
- [[ref_node_crypto]] - concept
- [[runInTransaction()]] - code - src/server/db.mjs
- [[sanitizePublicationInput()]] - code - src/server/authHelper.mjs
- [[sanitizeResearcherInput()]] - code - src/server/authHelper.mjs
- [[signSessionToken()]] - code - src/server/authHelper.mjs
- [[syncSinglePublicationCitations()]] - code - src/server/apiHandler.mjs
- [[syncedPublicationsCache]] - code - src/server/apiHandler.mjs
- [[updateResearcherStats()]] - code - src/server/apiHandler.mjs
- [[verifyPassword()]] - code - src/server/authHelper.mjs
- [[verifySessionToken()]] - code - src/server/authHelper.mjs

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/render-classmjs
SORT file.name ASC
```

## Connections to other communities
- 19 edges to [[_COMMUNITY_commandDeliver]]
- 16 edges to [[_COMMUNITY_visual-check.mjs]]
- 11 edges to [[_COMMUNITY_YAYTP6L5.js]]
- 9 edges to [[_COMMUNITY_archify.mjs]]
- 9 edges to [[_COMMUNITY_createRouter]]
- 4 edges to [[_COMMUNITY_i18n.mjs]]
- 1 edge to [[_COMMUNITY_Community 32]]

## Top bridge nodes
- [[apiHandler.mjs]] - degree 71, connects to 7 communities
- [[handleApiRequest()]] - degree 46, connects to 5 communities
- [[runInTransaction()]] - degree 6, connects to 2 communities
- [[authHelper.mjs]] - degree 17, connects to 1 community
- [[matchesResearcher()_1]] - degree 10, connects to 1 community