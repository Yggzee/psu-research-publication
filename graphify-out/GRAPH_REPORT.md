# Graph Report - ResPub  (2026-11-12)

## Corpus Check
- 118 files · ~137,637 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .css 5, .db 1)

## Summary
- 887 nodes · 2806 edges · 42 communities (33 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `07aeb203`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Button
- AdminPage.tsx
- chart.tsx
- geometry.mjs
- dataflow-compiler.mjs
- cn
- render-class.mjs
- visual-check.mjs
- ApiService
- toggle-group.tsx
- ImpactAnalysisPage.tsx
- ref_node_path
- archify.mjs
- api.service.ts
- commandDeliver
- cn
- adminSearchStore.ts
- render-waterfall.mjs
- YAYTP6L5.js
- ProfilePage.tsx
- sheet.tsx
- ref_react
- render-timeline.mjs
- extract-audio-data.py
- App.tsx
- createRouter
- i18n.mjs
- CampusAIChatHistory.tsx
- utils.ts
- L4LY553T.js
- Notice.tsx
- SDGImpactMatrix.tsx
- vite.config.ts
- ProfilePage.tsx
- PublicationsPage.tsx
- menubar.tsx
- accordion.tsx
- scroll-area.tsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 223 edges
2. `ApiService` - 87 edges
3. `Button()` - 66 edges
4. `Badge()` - 50 edges
5. `handleApiRequest()` - 50 edges
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
- `ContextMenuCheckboxItem()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/context-menu.tsx → src/app/components/ui/utils.ts
- `ContextMenuContent()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/context-menu.tsx → src/app/components/ui/utils.ts

## Import Cycles
- None detected.

## Communities (42 total, 9 thin omitted)

### Community 0 - "Button"
Cohesion: 0.08
Nodes (65): AdminPage(), DEPARTMENTS, emptyForm, ApifyTokenManager(), ApifyTokenManagerProps, AskCampusAI(), SUGGESTED_QUESTIONS, CoAuthorshipGraph() (+57 more)

### Community 1 - "AdminPage.tsx"
Cohesion: 0.08
Nodes (38): CommandPalette(), CommandPaletteProps, adminNavigationCategories, bottomUtilityNavigation, DashboardLayout(), instructorNavigationCategories, NavCategory, NavItem (+30 more)

### Community 2 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 3 - "geometry.mjs"
Cohesion: 0.06
Nodes (3): Publication, Researcher, ApiService

### Community 4 - "dataflow-compiler.mjs"
Cohesion: 0.07
Nodes (33): Separator(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter(), SidebarGroup(), SidebarGroupAction(), SidebarGroupContent() (+25 more)

### Community 5 - "cn"
Cohesion: 0.07
Nodes (31): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator(), CardAction(), CardFooter() (+23 more)

### Community 6 - "render-class.mjs"
Cohesion: 0.13
Nodes (33): activeCitationSyncJobs, attachTokenUsage(), cleanupOrphanedPublications(), computePublicationCitationYears(), deleteResearcherPublications(), enqueuePublicationCitationSync(), fetchApifyTokenUsage(), getActiveApifyTokenRow() (+25 more)

### Community 7 - "visual-check.mjs"
Cohesion: 0.16
Nodes (17): isGenericBoilerplate(), hashPassword(), auditAndSyncResearcherCitations(), autoBackfillMissingSDGs(), dbPath, __dirname, __filename, initDatabase() (+9 more)

### Community 8 - "ApiService"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogPortal() (+10 more)

### Community 9 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (9): Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle() (+1 more)

### Community 10 - "ImpactAnalysisPage.tsx"
Cohesion: 0.17
Nodes (16): Dashboard(), OutputMetric, TopResearchTab, DepartmentLegend(), DepartmentLegendProps, DashboardStatsResponse, Department, DEPARTMENT_COLORS (+8 more)

### Community 11 - "ref_node_path"
Cohesion: 0.16
Nodes (20): buildResearcherWorkbook(), buildZipArchive(), citingHeaderStyle, crc32(), CRC_TABLE, createHyperlinkCell(), createTextCell(), deriveKeywords() (+12 more)

### Community 12 - "archify.mjs"
Cohesion: 0.16
Nodes (21): askCampusIntelligence(), auditJournalReputation(), buildDynamicSDGRationale(), calculateSynergy(), callGemini(), callLLM(), callOpenAICompat(), classifyPublicationSDG() (+13 more)

### Community 13 - "api.service.ts"
Cohesion: 0.09
Nodes (25): API_CONFIG, API_ENDPOINTS, ApifyToken, ApifyTokenUsage, apiService, AskCampusResponse, EmailLog, FetchScholarProfileResponse (+17 more)

### Community 14 - "commandDeliver"
Cohesion: 0.23
Nodes (19): cleanText(), enrichBatchWithCrossRef(), enrichPaperWithCrossRef(), extractKeywordsFromText(), fetchCitingPapersFromOpenAlex(), fetchOpenAlexAbstractAndSDGs(), getQuarterFromMonth(), hashString() (+11 more)

### Community 15 - "cn"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 17 - "render-waterfall.mjs"
Cohesion: 0.17
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 18 - "YAYTP6L5.js"
Cohesion: 0.10
Nodes (15): __dirname, DIST_DIR, __filename, MIME_TYPES, PORT, requestHandler(), server, applySecurityHeaders() (+7 more)

### Community 19 - "ProfilePage.tsx"
Cohesion: 0.19
Nodes (10): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+2 more)

### Community 20 - "sheet.tsx"
Cohesion: 0.23
Nodes (9): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetPortal(), SheetTitle() (+1 more)

### Community 21 - "ref_react"
Cohesion: 0.15
Nodes (18): EmptyState(), EmptyStateProps, PageHeader(), PageHeaderProps, PageTabs(), PageTabsProps, TabItem, StatusBadge() (+10 more)

### Community 22 - "render-timeline.mjs"
Cohesion: 0.20
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle()

### Community 23 - "extract-audio-data.py"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 24 - "App.tsx"
Cohesion: 0.38
Nodes (3): App(), router, ThemeProvider()

### Community 25 - "createRouter"
Cohesion: 0.33
Nodes (9): buildHtmlEmail(), dispatchEmail(), getAppBaseUrl(), isSmtpConfigured, logEmail(), sendAdminInvitationEmail(), sendRegistrationApprovedEmail(), sendSelfRegisterVerificationEmail() (+1 more)

### Community 26 - "i18n.mjs"
Cohesion: 0.25
Nodes (3): LoginAttemptTracker, loginAttemptTracker, rateLimiter

### Community 27 - "CampusAIChatHistory.tsx"
Cohesion: 0.15
Nodes (27): ChatMessage, CampusAIChatHistory(), FormattedChatMessage(), FormattedChatMessageProps, parseInline(), FloatingAskAIBubble(), SPECIFIC_SUGGESTIONS, SpecificPrompt (+19 more)

### Community 28 - "utils.ts"
Cohesion: 0.07
Nodes (8): HoverCardContent(), PopoverContent(), Progress(), RadioGroup(), RadioGroupItem(), ResizableHandle(), ResizablePanelGroup(), Slider()

### Community 31 - "SDGImpactMatrix.tsx"
Cohesion: 0.15
Nodes (6): SDG_COLORS, SDGPaperItem, SDGStatsResponse, ThemeContext, ThemeContextType, ThemeMode

### Community 35 - "ProfilePage.tsx"
Cohesion: 0.21
Nodes (19): ProfilePage(), SortOption, ReportsPage(), ReportType, ResearcherProfile(), SortOption, ResearchersPage(), Select() (+11 more)

### Community 37 - "PublicationsPage.tsx"
Cohesion: 0.16
Nodes (19): extractSdgNum(), PublicationsPage(), SortOption, TableSortColumn, TableSortDirection, ViewMode, RoleAwarePublications(), AuthorCategory (+11 more)

### Community 39 - "menubar.tsx"
Cohesion: 0.12
Nodes (12): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarPortal(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 40 - "accordion.tsx"
Cohesion: 0.33
Nodes (3): AccordionContent(), AccordionItem(), AccordionTrigger()

## Knowledge Gaps
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `Button`, `AdminPage.tsx`, `chart.tsx`, `dataflow-compiler.mjs`, `ApiService`, `toggle-group.tsx`, `cn`, `render-waterfall.mjs`, `ProfilePage.tsx`, `sheet.tsx`, `ref_react`, `render-timeline.mjs`, `extract-audio-data.py`, `CampusAIChatHistory.tsx`, `utils.ts`, `ProfilePage.tsx`, `menubar.tsx`, `accordion.tsx`, `scroll-area.tsx`?**
  _High betweenness centrality (0.226) - this node is a cross-community bridge._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.08202020202020202 - nodes in this community are weakly interconnected._
- **Why does `ApiService` connect `geometry.mjs` to `Button`, `AdminPage.tsx`, `ProfilePage.tsx`, `PublicationsPage.tsx`, `ImpactAnalysisPage.tsx`, `api.service.ts`, `ref_react`, `CampusAIChatHistory.tsx`, `SDGImpactMatrix.tsx`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Should `AdminPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07585568917668825 - nodes in this community are weakly interconnected._
- **Why does `Button()` connect `Button` to `AdminPage.tsx`, `ProfilePage.tsx`, `dataflow-compiler.mjs`, `PublicationsPage.tsx`, `cn`, `ApiService`, `ImpactAnalysisPage.tsx`, `api.service.ts`, `render-waterfall.mjs`, `ref_react`, `CampusAIChatHistory.tsx`, `SDGImpactMatrix.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `geometry.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06101190476190476 - nodes in this community are weakly interconnected._
- **Should `dataflow-compiler.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07435897435897436 - nodes in this community are weakly interconnected._