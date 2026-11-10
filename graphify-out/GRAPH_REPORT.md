# Graph Report - ResPub  (2026-11-11)

## Corpus Check
- 118 files · ~131,794 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .css 5, .db 1)

## Summary
- 880 nodes · 2788 edges · 38 communities (26 shown, 12 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9fe85458`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Button
- AdminPage.tsx
- chart.tsx
- geometry.mjs
- dataflow-compiler.mjs
- generated-validators.mjs
- render-class.mjs
- visual-check.mjs
- ApiService
- toggle-group.tsx
- render-sequence.mjs
- ref_node_path
- archify.mjs
- render-lifecycle.mjs
- commandDeliver
- cn
- AdminSearchStore
- render-waterfall.mjs
- YAYTP6L5.js
- ProfilePage.tsx
- useResearchers.ts
- input-otp.tsx
- render-timeline.mjs
- extract-audio-data.py
- api.service.ts
- createRouter
- i18n.mjs
- CampusAIChatHistory.tsx
- utils.ts
- L4LY553T.js
- Publication
- vite.config.ts

## God Nodes (most connected - your core abstractions)
1. `cn()` - 223 edges
2. `ApiService` - 87 edges
3. `Button()` - 66 edges
4. `Badge()` - 50 edges
5. `Card()` - 49 edges
6. `handleApiRequest()` - 48 edges
7. `CardContent()` - 45 edges
8. `Input()` - 40 edges
9. `CardHeader()` - 34 edges
10. `getCurrentUser()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `CommandShortcut()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/command.tsx → src/app/components/ui/utils.ts
- `Menubar()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts
- `MenubarCheckboxItem()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts
- `MenubarItem()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts
- `MenubarLabel()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts

## Import Cycles
- None detected.

## Communities (38 total, 12 thin omitted)

### Community 0 - "Button"
Cohesion: 0.06
Nodes (104): ApifyTokenManager(), ApifyTokenManagerProps, AskCampusAI(), SUGGESTED_QUESTIONS, CoAuthorshipGraph(), EmptyState(), Notice(), NoticeProps (+96 more)

### Community 1 - "AdminPage.tsx"
Cohesion: 0.07
Nodes (50): AdminPage(), DEPARTMENTS, emptyForm, CommandPalette(), CommandPaletteProps, ALL_SDG_OPTIONS, parseAuthorsList(), PublicationDetail() (+42 more)

### Community 2 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 4 - "dataflow-compiler.mjs"
Cohesion: 0.07
Nodes (42): Separator(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetPortal() (+34 more)

### Community 5 - "generated-validators.mjs"
Cohesion: 0.07
Nodes (31): AccordionContent(), AccordionItem(), AccordionTrigger(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+23 more)

### Community 6 - "render-class.mjs"
Cohesion: 0.16
Nodes (29): activeCitationSyncJobs, attachTokenUsage(), cleanupOrphanedPublications(), computePublicationCitationYears(), deleteResearcherPublications(), enqueuePublicationCitationSync(), fetchApifyTokenUsage(), getActiveApifyTokenRow() (+21 more)

### Community 7 - "visual-check.mjs"
Cohesion: 0.10
Nodes (25): hashPassword(), deduplicateDatabase(), normalizeTitle(), auditAndSyncResearcherCitations(), autoBackfillMissingSDGs(), db, dbPath, dbReadyPromise (+17 more)

### Community 8 - "ApiService"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogPortal() (+10 more)

### Community 9 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (9): Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle() (+1 more)

### Community 10 - "render-sequence.mjs"
Cohesion: 0.10
Nodes (22): App(), Dashboard(), OutputMetric, TopResearchTab, DepartmentLegend(), DepartmentLegendProps, router, DashboardStatsResponse (+14 more)

### Community 11 - "ref_node_path"
Cohesion: 0.16
Nodes (20): buildResearcherWorkbook(), buildZipArchive(), citingHeaderStyle, crc32(), CRC_TABLE, createHyperlinkCell(), createTextCell(), deriveKeywords() (+12 more)

### Community 12 - "archify.mjs"
Cohesion: 0.16
Nodes (21): askCampusIntelligence(), auditJournalReputation(), buildDynamicSDGRationale(), calculateSynergy(), callGemini(), callLLM(), callOpenAICompat(), classifyPublicationSDG() (+13 more)

### Community 13 - "render-lifecycle.mjs"
Cohesion: 0.12
Nodes (12): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarPortal(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 14 - "commandDeliver"
Cohesion: 0.25
Nodes (17): cleanText(), enrichBatchWithCrossRef(), enrichPaperWithCrossRef(), extractKeywordsFromText(), fetchCitingPapersFromOpenAlex(), fetchOpenAlexAbstractAndSDGs(), getQuarterFromMonth(), hashString() (+9 more)

### Community 15 - "cn"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 17 - "render-waterfall.mjs"
Cohesion: 0.17
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 18 - "YAYTP6L5.js"
Cohesion: 0.22
Nodes (8): __dirname, DIST_DIR, __filename, MIME_TYPES, PORT, server, applySecurityHeaders(), SECURITY_HEADERS

### Community 19 - "ProfilePage.tsx"
Cohesion: 0.19
Nodes (10): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+2 more)

### Community 21 - "input-otp.tsx"
Cohesion: 0.33
Nodes (3): InputOTP(), InputOTPGroup(), InputOTPSlot()

### Community 22 - "render-timeline.mjs"
Cohesion: 0.20
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle()

### Community 23 - "extract-audio-data.py"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 24 - "api.service.ts"
Cohesion: 0.08
Nodes (25): API_CONFIG, API_ENDPOINTS, ApifyToken, ApifyTokenUsage, AskCampusResponse, EmailLog, FetchScholarProfileResponse, InvitationRequest (+17 more)

### Community 25 - "createRouter"
Cohesion: 0.36
Nodes (8): buildHtmlEmail(), dispatchEmail(), getAppBaseUrl(), isSmtpConfigured, logEmail(), sendAdminInvitationEmail(), sendRegistrationApprovedEmail(), sendSelfRegisterVerificationEmail()

### Community 26 - "i18n.mjs"
Cohesion: 0.25
Nodes (3): LoginAttemptTracker, loginAttemptTracker, rateLimiter

### Community 27 - "CampusAIChatHistory.tsx"
Cohesion: 0.10
Nodes (37): ChatMessage, CampusAIChatHistory(), FormattedChatMessage(), FormattedChatMessageProps, parseInline(), ConfirmModal(), ConfirmModalProps, adminNavigationCategories (+29 more)

### Community 28 - "utils.ts"
Cohesion: 0.06
Nodes (11): EmptyStateProps, HoverCardContent(), PopoverContent(), Progress(), RadioGroup(), RadioGroupItem(), ResizableHandle(), ResizablePanelGroup() (+3 more)

## Knowledge Gaps
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `generated-validators.mjs` to `Button`, `AdminPage.tsx`, `chart.tsx`, `dataflow-compiler.mjs`, `ApiService`, `toggle-group.tsx`, `render-lifecycle.mjs`, `cn`, `render-waterfall.mjs`, `ProfilePage.tsx`, `input-otp.tsx`, `render-timeline.mjs`, `extract-audio-data.py`, `CampusAIChatHistory.tsx`, `utils.ts`?**
  _High betweenness centrality (0.229) - this node is a cross-community bridge._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.06406948744410045 - nodes in this community are weakly interconnected._
- **Why does `ApiService` connect `geometry.mjs` to `Button`, `AdminPage.tsx`, `.askCampusAI`, `render-sequence.mjs`, `useResearchers.ts`, `api.service.ts`, `CampusAIChatHistory.tsx`, `Publication`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Should `AdminPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0741745816372682 - nodes in this community are weakly interconnected._
- **Why does `Button()` connect `Button` to `AdminPage.tsx`, `dataflow-compiler.mjs`, `generated-validators.mjs`, `ApiService`, `render-sequence.mjs`, `render-waterfall.mjs`, `CampusAIChatHistory.tsx`, `utils.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `geometry.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07607843137254902 - nodes in this community are weakly interconnected._
- **Should `dataflow-compiler.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.0653061224489796 - nodes in this community are weakly interconnected._