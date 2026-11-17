# Graph Report - ResPub  (2026-11-17)

## Corpus Check
- 134 files · ~181,781 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .css 5, .db 1)

## Summary
- 1022 nodes · 3194 edges · 44 communities (35 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6d13895d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ProfilePage.tsx
- researchStore.ts
- chart.tsx
- geometry.mjs
- dataflow-compiler.mjs
- dropdown-menu.tsx
- backupService.mjs
- visual-check.mjs
- ApiService
- toggle-group.tsx
- verify_chapter2.py
- Card
- archify.mjs
- api.service.ts
- commandDeliver
- cn
- sheet.tsx
- render-waterfall.mjs
- testEnv.mjs
- ProfilePage.tsx
- routes.tsx
- resizable.tsx
- render-timeline.mjs
- extract-audio-data.py
- find_all_candidates.py
- createRouter
- menubar.tsx
- handleApiRequest
- api.service.ts
- ref_react
- context-menu.tsx
- AdminSearchStore
- vite.config.ts
- rateLimiter.mjs
- App.tsx
- ImpactAnalysisPage.tsx
- SlidingWindowRateLimiter
- accordion.tsx
- utils.ts
- alert.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 223 edges
2. `ApiService` - 94 edges
3. `handleApiRequest()` - 66 edges
4. `Button()` - 66 edges
5. `Badge()` - 50 edges
6. `Card()` - 49 edges
7. `CardContent()` - 45 edges
8. `Input()` - 40 edges
9. `CardHeader()` - 34 edges
10. `getCurrentUser()` - 33 edges

## Surprising Connections (you probably didn't know these)
- `SimulatedPublicCounterGraph()` --calls--> `Badge()`  [EXTRACTED]
  src/app/components/SystemGuidePage.tsx → src/app/components/ui/badge.tsx
- `SimulatedSDGRadarGraph()` --calls--> `Badge()`  [EXTRACTED]
  src/app/components/SystemGuidePage.tsx → src/app/components/ui/badge.tsx
- `CommandShortcut()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/command.tsx → src/app/components/ui/utils.ts
- `AccordionContent()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/accordion.tsx → src/app/components/ui/utils.ts
- `AccordionItem()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/accordion.tsx → src/app/components/ui/utils.ts

## Import Cycles
- None detected.

## Communities (44 total, 9 thin omitted)

### Community 0 - "ProfilePage.tsx"
Cohesion: 0.07
Nodes (67): EmptyState(), emptyForm, ProfilePage(), SortOption, extractSdgNum(), PublicationsPage(), SortOption, TableSortColumn (+59 more)

### Community 1 - "researchStore.ts"
Cohesion: 0.07
Nodes (50): AdminPage(), DEPARTMENTS, emptyForm, CommandPalette(), CommandPaletteProps, NoticeProps, NoticeVariant, ALL_SDG_OPTIONS (+42 more)

### Community 2 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 3 - "geometry.mjs"
Cohesion: 0.05
Nodes (3): Publication, Researcher, ApiService

### Community 4 - "dataflow-compiler.mjs"
Cohesion: 0.07
Nodes (33): Separator(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter(), SidebarGroup(), SidebarGroupAction(), SidebarGroupContent() (+25 more)

### Community 5 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 6 - "backupService.mjs"
Cohesion: 0.25
Nodes (15): BACKUP_SCHEDULE_INFO, BACKUP_TABLES, createDatabaseBackup(), __dirname, __filename, formatBackupMetadata(), getBackupsDir(), getDatabaseBackupById() (+7 more)

### Community 7 - "visual-check.mjs"
Cohesion: 0.10
Nodes (28): deduplicateDatabase(), normalizeTitle(), auditAndSyncResearcherCitations(), autoBackfillMissingSDGs(), backfillPublicationResearchers(), dataDir, db, dbPath (+20 more)

### Community 8 - "ApiService"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogPortal() (+10 more)

### Community 9 - "toggle-group.tsx"
Cohesion: 0.31
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 10 - "verify_chapter2.py"
Cohesion: 0.09
Nodes (15): add_styled_run(), convert_md_to_docx(), main(), parse_inline_formatting(), set_cell_borders(), add_apa_reference(), add_heading(), add_styled_run() (+7 more)

### Community 11 - "Card"
Cohesion: 0.23
Nodes (18): CoAuthorshipGraph(), SectionCard(), SectionCardProps, StatCard(), StatCardProps, LoginScreen(), SDGImpactMatrix(), SettingsPage() (+10 more)

### Community 12 - "archify.mjs"
Cohesion: 0.15
Nodes (22): askCampusIntelligence(), auditJournalReputation(), buildDynamicSDGRationale(), calculateSynergy(), callGemini(), callLLM(), callOpenAICompat(), classifyPublicationSDG() (+14 more)

### Community 13 - "api.service.ts"
Cohesion: 0.14
Nodes (25): CampusAIChatHistory(), FormattedChatMessage(), FormattedChatMessageProps, parseInline(), FloatingAskAIBubble(), FloatingAskAIBubbleProps, PUBLIC_SUGGESTIONS, SPECIFIC_SUGGESTIONS (+17 more)

### Community 14 - "commandDeliver"
Cohesion: 0.22
Nodes (24): cleanText(), enrichBatchWithCrossRef(), enrichPaperWithCrossRef(), extractKeywordsFromText(), extractSurnamesFromAuthors(), fetchCitingPapersFromOpenAlex(), fetchLiveGoogleScholarCitationCount(), fetchOpenAlexAbstractAndSDGs() (+16 more)

### Community 15 - "cn"
Cohesion: 0.09
Nodes (25): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator(), CardAction(), CardFooter() (+17 more)

### Community 16 - "sheet.tsx"
Cohesion: 0.26
Nodes (9): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetPortal(), SheetTitle() (+1 more)

### Community 17 - "render-waterfall.mjs"
Cohesion: 0.17
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 18 - "testEnv.mjs"
Cohesion: 0.09
Nodes (26): __dirname, DIST_DIR, __filename, MIME_TYPES, PORT, server, SECURITY_HEADERS, buildMockResponse() (+18 more)

### Community 19 - "ProfilePage.tsx"
Cohesion: 0.19
Nodes (10): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+2 more)

### Community 20 - "routes.tsx"
Cohesion: 0.10
Nodes (24): adminNavigationCategories, bottomUtilityNavigation, DashboardLayout(), instructorNavigationCategories, NavCategory, NavItem, InstructorPublicationsPage(), SplashScreen() (+16 more)

### Community 22 - "render-timeline.mjs"
Cohesion: 0.20
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle()

### Community 23 - "extract-audio-data.py"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 25 - "createRouter"
Cohesion: 0.33
Nodes (9): buildHtmlEmail(), dispatchEmail(), getAppBaseUrl(), isSmtpConfigured, logEmail(), sendAdminInvitationEmail(), sendRegistrationApprovedEmail(), sendSelfRegisterVerificationEmail() (+1 more)

### Community 26 - "menubar.tsx"
Cohesion: 0.12
Nodes (12): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarPortal(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 27 - "handleApiRequest"
Cohesion: 0.12
Nodes (41): activeCitationSyncJobs, attachTokenUsage(), buildApifyScraperHelpers(), cleanupOrphanedPublications(), computePublicationCitationYears(), deleteResearcherPublications(), enqueuePublicationCitationSync(), fetchApifyTokenUsage() (+33 more)

### Community 28 - "api.service.ts"
Cohesion: 0.08
Nodes (27): SDG_COLORS, API_CONFIG, API_ENDPOINTS, ApifyToken, ApifyTokenUsage, apiService, AskCampusResponse, EmailLog (+19 more)

### Community 29 - "ref_react"
Cohesion: 0.11
Nodes (26): ApifyTokenManager(), ApifyTokenManagerProps, AskCampusAI(), ChatMessage, SUGGESTED_QUESTIONS, EmptyStateProps, PageHeader(), PageHeaderProps (+18 more)

### Community 30 - "context-menu.tsx"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 35 - "rateLimiter.mjs"
Cohesion: 0.25
Nodes (3): LoginAttemptTracker, loginAttemptTracker, rateLimiter

### Community 37 - "App.tsx"
Cohesion: 0.38
Nodes (3): App(), router, ThemeProvider()

### Community 39 - "ImpactAnalysisPage.tsx"
Cohesion: 0.14
Nodes (21): Dashboard(), OutputMetric, TopResearchTab, DepartmentLegend(), DepartmentLegendProps, ImpactAnalysisPage(), DashboardStatsResponse, Department (+13 more)

### Community 41 - "accordion.tsx"
Cohesion: 0.33
Nodes (3): AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 42 - "utils.ts"
Cohesion: 0.08
Nodes (7): HoverCardContent(), PopoverContent(), Progress(), ScrollArea(), ScrollBar(), Slider(), Switch()

### Community 43 - "alert.tsx"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

## Knowledge Gaps
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `ProfilePage.tsx`, `researchStore.ts`, `chart.tsx`, `dataflow-compiler.mjs`, `dropdown-menu.tsx`, `ApiService`, `toggle-group.tsx`, `Card`, `api.service.ts`, `sheet.tsx`, `render-waterfall.mjs`, `ProfilePage.tsx`, `resizable.tsx`, `render-timeline.mjs`, `extract-audio-data.py`, `menubar.tsx`, `ref_react`, `context-menu.tsx`, `accordion.tsx`, `utils.ts`, `alert.tsx`?**
  _High betweenness centrality (0.193) - this node is a cross-community bridge._
- **Should `ProfilePage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06765935214211076 - nodes in this community are weakly interconnected._
- **Why does `ApiService` connect `geometry.mjs` to `ProfilePage.tsx`, `researchStore.ts`, `ImpactAnalysisPage.tsx`, `Card`, `api.service.ts`, `routes.tsx`, `api.service.ts`, `ref_react`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Should `researchStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0733099209833187 - nodes in this community are weakly interconnected._
- **Why does `Button()` connect `ref_react` to `ProfilePage.tsx`, `researchStore.ts`, `dataflow-compiler.mjs`, `ImpactAnalysisPage.tsx`, `ApiService`, `Card`, `api.service.ts`, `cn`, `render-waterfall.mjs`, `routes.tsx`, `api.service.ts`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Should `geometry.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.05472837022132797 - nodes in this community are weakly interconnected._
- **Should `dataflow-compiler.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07435897435897436 - nodes in this community are weakly interconnected._