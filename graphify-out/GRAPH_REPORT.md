# Graph Report - ResPub  (2026-11-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 865 nodes · 2781 edges · 37 communities (28 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `297b8b75`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- compileWorkflowInternal
- check-update.mjs
- render-erd.mjs
- geometry.mjs
- dataflow-compiler.mjs
- generated-validators.mjs
- render-class.mjs
- visual-check.mjs
- ApiService
- utils.ts
- render-sequence.mjs
- ref_node_path
- archify.mjs
- render-lifecycle.mjs
- commandDeliver
- cn
- accordion.tsx
- render-waterfall.mjs
- YAYTP6L5.js
- ProfilePage.tsx
- workflow-compiler.mjs
- preview.mjs
- render-timeline.mjs
- extract-audio-data.py
- api.service.ts
- createRouter
- i18n.mjs
- CampusAIChatHistory.tsx
- popover.tsx
- L4LY553T.js
- resizable.tsx
- scroll-area.tsx
- vite.config.ts

## God Nodes (most connected - your core abstractions)
1. `cn()` - 223 edges
2. `ApiService` - 87 edges
3. `Button()` - 66 edges
4. `Badge()` - 50 edges
5. `Card()` - 49 edges
6. `handleApiRequest()` - 46 edges
7. `CardContent()` - 45 edges
8. `Input()` - 40 edges
9. `CardHeader()` - 34 edges
10. `AdminPage()` - 34 edges

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

## Communities (37 total, 9 thin omitted)

### Community 0 - "compileWorkflowInternal"
Cohesion: 0.10
Nodes (55): App(), ApifyTokenManager(), ApifyTokenManagerProps, AskCampusAI(), SUGGESTED_QUESTIONS, CoAuthorshipGraph(), PageTabs(), SectionCard() (+47 more)

### Community 1 - "check-update.mjs"
Cohesion: 0.07
Nodes (50): AdminPage(), DEPARTMENTS, emptyForm, CommandPalette(), CommandPaletteProps, Notice(), NoticeProps, NoticeVariant (+42 more)

### Community 2 - "render-erd.mjs"
Cohesion: 0.09
Nodes (54): EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, PageTabsProps, StatCard(), StatusBadge(), StatusBadgeProps (+46 more)

### Community 3 - "geometry.mjs"
Cohesion: 0.06
Nodes (3): Publication, Researcher, ApiService

### Community 4 - "dataflow-compiler.mjs"
Cohesion: 0.07
Nodes (33): Separator(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter(), SidebarGroup(), SidebarGroupAction(), SidebarGroupContent() (+25 more)

### Community 5 - "generated-validators.mjs"
Cohesion: 0.07
Nodes (28): CardAction(), CardFooter(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator() (+20 more)

### Community 6 - "render-class.mjs"
Cohesion: 0.16
Nodes (29): activeCitationSyncJobs, attachTokenUsage(), cleanupOrphanedPublications(), computePublicationCitationYears(), deleteResearcherPublications(), enqueuePublicationCitationSync(), fetchApifyTokenUsage(), getActiveApifyTokenRow() (+21 more)

### Community 7 - "visual-check.mjs"
Cohesion: 0.14
Nodes (19): localHeuristicSDG(), deduplicateDatabase(), normalizeTitle(), auditAndSyncResearcherCitations(), autoBackfillMissingSDGs(), db, dbPath, dbReadyPromise (+11 more)

### Community 8 - "ApiService"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogPortal() (+10 more)

### Community 9 - "utils.ts"
Cohesion: 0.08
Nodes (13): Alert(), AlertDescription(), AlertTitle(), alertVariants, HoverCardContent(), Progress(), Slider(), Switch() (+5 more)

### Community 10 - "render-sequence.mjs"
Cohesion: 0.17
Nodes (15): Dashboard(), OutputMetric, TopResearchTab, DepartmentLegend(), DepartmentLegendProps, RoleAwareDashboard(), Department, DEPARTMENT_COLORS (+7 more)

### Community 11 - "ref_node_path"
Cohesion: 0.16
Nodes (20): buildResearcherWorkbook(), buildZipArchive(), citingHeaderStyle, crc32(), CRC_TABLE, createHyperlinkCell(), createTextCell(), deriveKeywords() (+12 more)

### Community 12 - "archify.mjs"
Cohesion: 0.18
Nodes (18): askCampusIntelligence(), auditJournalReputation(), calculateSynergy(), callGemini(), callLLM(), callOpenAICompat(), classifyPublicationSDG(), __dirname (+10 more)

### Community 13 - "render-lifecycle.mjs"
Cohesion: 0.12
Nodes (12): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarPortal(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 14 - "commandDeliver"
Cohesion: 0.27
Nodes (16): cleanText(), enrichBatchWithCrossRef(), enrichPaperWithCrossRef(), extractKeywordsFromText(), fetchCitingPapersFromOpenAlex(), getQuarterFromMonth(), hashString(), isInitialsToken() (+8 more)

### Community 15 - "cn"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 16 - "accordion.tsx"
Cohesion: 0.33
Nodes (3): AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 17 - "render-waterfall.mjs"
Cohesion: 0.17
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 18 - "YAYTP6L5.js"
Cohesion: 0.11
Nodes (14): __dirname, DIST_DIR, __filename, MIME_TYPES, PORT, server, applySecurityHeaders(), SECURITY_HEADERS (+6 more)

### Community 19 - "ProfilePage.tsx"
Cohesion: 0.10
Nodes (16): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator(), FormControl(), FormDescription() (+8 more)

### Community 20 - "workflow-compiler.mjs"
Cohesion: 0.26
Nodes (9): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetPortal(), SheetTitle() (+1 more)

### Community 21 - "preview.mjs"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 22 - "render-timeline.mjs"
Cohesion: 0.20
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle()

### Community 23 - "extract-audio-data.py"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 24 - "api.service.ts"
Cohesion: 0.06
Nodes (27): API_CONFIG, API_ENDPOINTS, ApifyToken, ApifyTokenUsage, AskCampusResponse, DashboardStatsResponse, EmailLog, FetchScholarProfileResponse (+19 more)

### Community 25 - "createRouter"
Cohesion: 0.36
Nodes (8): buildHtmlEmail(), dispatchEmail(), getAppBaseUrl(), isSmtpConfigured, logEmail(), sendAdminInvitationEmail(), sendRegistrationApprovedEmail(), sendSelfRegisterVerificationEmail()

### Community 26 - "i18n.mjs"
Cohesion: 0.25
Nodes (3): LoginAttemptTracker, loginAttemptTracker, rateLimiter

### Community 27 - "CampusAIChatHistory.tsx"
Cohesion: 0.12
Nodes (34): ChatMessage, CampusAIChatHistory(), FormattedChatMessage(), FormattedChatMessageProps, parseInline(), ConfirmModal(), adminNavigationCategories, bottomUtilityNavigation (+26 more)

## Knowledge Gaps
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `generated-validators.mjs` to `compileWorkflowInternal`, `check-update.mjs`, `render-erd.mjs`, `dataflow-compiler.mjs`, `ApiService`, `utils.ts`, `render-lifecycle.mjs`, `cn`, `accordion.tsx`, `render-waterfall.mjs`, `ProfilePage.tsx`, `workflow-compiler.mjs`, `preview.mjs`, `render-timeline.mjs`, `extract-audio-data.py`, `CampusAIChatHistory.tsx`, `popover.tsx`, `resizable.tsx`, `scroll-area.tsx`?**
  _High betweenness centrality (0.233) - this node is a cross-community bridge._
- **Should `compileWorkflowInternal` be split into smaller, more focused modules?**
  _Cohesion score 0.09536082474226804 - nodes in this community are weakly interconnected._
- **Why does `ApiService` connect `geometry.mjs` to `compileWorkflowInternal`, `check-update.mjs`, `render-erd.mjs`, `render-sequence.mjs`, `api.service.ts`, `CampusAIChatHistory.tsx`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Should `check-update.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07019230769230769 - nodes in this community are weakly interconnected._
- **Why does `Button()` connect `compileWorkflowInternal` to `check-update.mjs`, `render-erd.mjs`, `dataflow-compiler.mjs`, `generated-validators.mjs`, `ApiService`, `render-sequence.mjs`, `render-waterfall.mjs`, `CampusAIChatHistory.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `render-erd.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.09208523592085235 - nodes in this community are weakly interconnected._
- **Should `geometry.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06101190476190476 - nodes in this community are weakly interconnected._