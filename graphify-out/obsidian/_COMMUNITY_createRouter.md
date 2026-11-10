---
type: community
cohesion: 0.42
members: 9
---

# createRouter

**Cohesion:** 0.42 - moderately connected
**Members:** 9 nodes

## Members
- [[buildHtmlEmail()]] - code - src/server/emailService.mjs
- [[dispatchEmail()]] - code - src/server/emailService.mjs
- [[emailService.mjs]] - code - src/server/emailService.mjs
- [[getAppBaseUrl()]] - code - src/server/emailService.mjs
- [[isSmtpConfigured]] - code - src/server/emailService.mjs
- [[logEmail()]] - code - src/server/emailService.mjs
- [[sendAdminInvitationEmail()]] - code - src/server/emailService.mjs
- [[sendRegistrationApprovedEmail()]] - code - src/server/emailService.mjs
- [[sendSelfRegisterVerificationEmail()]] - code - src/server/emailService.mjs

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/createRouter
SORT file.name ASC
```

## Connections to other communities
- 9 edges to [[_COMMUNITY_render-class.mjs]]
- 2 edges to [[_COMMUNITY_visual-check.mjs]]

## Top bridge nodes
- [[emailService.mjs]] - degree 11, connects to 2 communities
- [[sendAdminInvitationEmail()]] - degree 5, connects to 1 community
- [[sendRegistrationApprovedEmail()]] - degree 5, connects to 1 community
- [[sendSelfRegisterVerificationEmail()]] - degree 5, connects to 1 community
- [[getAppBaseUrl()]] - degree 3, connects to 1 community