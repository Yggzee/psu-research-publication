# Graph Report - ResPub  (2026-11-11)

## Corpus Check
- 118 files · ~131,015 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .css 5, .db 1)

## Summary
- 872 nodes · 2800 edges · 34 communities (28 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c250c9e8`
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
- toggle-group.tsx
- render-sequence.mjs
- ref_node_path
- archify.mjs
- render-lifecycle.mjs
- commandDeliver
- cn
- dropdown-menu.tsx
- render-waterfall.mjs
- YAYTP6L5.js
- ProfilePage.tsx
- App.tsx
- render-timeline.mjs
- extract-audio-data.py
- adminSearchStore.ts
- createRouter
- i18n.mjs
- CampusAIChatHistory.tsx
- utils.ts
- L4LY553T.js
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
- `Menubar()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts
- `MenubarCheckboxItem()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts
- `MenubarItem()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts
- `MenubarLabel()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts
- `MenubarRadioItem()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts

## Import Cycles
- None detected.

## Communities (34 total, 6 thin omitted)

### Community 0 - "compileWorkflowInternal"
Cohesion: 0.08
Nodes (66): ApifyTokenManager(), ApifyTokenManagerProps, AskCampusAI(), SUGGESTED_QUESTIONS, CoAuthorshipGraph(), EmptyStateProps, PageHeaderProps, PageTabs() (+58 more)

### Community 1 - "check-update.mjs"
Cohesion: 0.07
Nodes (54): AdminPage(), DEPARTMENTS, emptyForm, CommandPalette(), CommandPaletteProps, Notice(), NoticeProps, NoticeVariant (+46 more)

### Community 2 - "render-erd.mjs"
Cohesion: 0.11
Nodes (46): EmptyState(), PageHeader(), StatCard(), StatusBadge(), ProfilePage(), SortOption, extractSdgNum(), PublicationsPage() (+38 more)

### Community 3 - "geometry.mjs"
Cohesion: 0.06
Nodes (3): Publication, Researcher, ApiService

### Community 4 - "dataflow-compiler.mjs"
Cohesion: 0.06
Nodes (42): Separator(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetPortal() (+34 more)

### Community 5 - "generated-validators.mjs"
Cohesion: 0.08
Nodes (28): AccordionContent(), AccordionItem(), AccordionTrigger(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+20 more)

### Community 6 - "render-class.mjs"
Cohesion: 0.16
Nodes (28): activeCitationSyncJobs, attachTokenUsage(), cleanupOrphanedPublications(), computePublicationCitationYears(), deleteResearcherPublications(), enqueuePublicationCitationSync(), fetchApifyTokenUsage(), getActiveApifyTokenRow() (+20 more)

### Community 7 - "visual-check.mjs"
Cohesion: 0.10
Nodes (26): localHeuristicSDG(), hashPassword(), deduplicateDatabase(), normalizeTitle(), auditAndSyncResearcherCitations(), autoBackfillMissingSDGs(), db, dbPath (+18 more)

### Community 8 - "ApiService"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogPortal() (+10 more)

### Community 9 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (9): Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle() (+1 more)

### Community 10 - "render-sequence.mjs"
Cohesion: 0.10
Nodes (26): Dashboard(), OutputMetric, TopResearchTab, DepartmentLegend(), DepartmentLegendProps, ChartConfig, ChartContainer(), ChartContext (+18 more)

### Community 11 - "ref_node_path"
Cohesion: 0.16
Nodes (20): buildResearcherWorkbook(), buildZipArchive(), citingHeaderStyle, crc32(), CRC_TABLE, createHyperlinkCell(), createTextCell(), deriveKeywords() (+12 more)

### Community 12 - "archify.mjs"
Cohesion: 0.17
Nodes (19): askCampusIntelligence(), auditJournalReputation(), calculateSynergy(), callGemini(), callLLM(), callOpenAICompat(), classifyPublicationSDG(), __dirname (+11 more)

### Community 13 - "render-lifecycle.mjs"
Cohesion: 0.12
Nodes (12): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarPortal(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 14 - "commandDeliver"
Cohesion: 0.25
Nodes (17): cleanText(), enrichBatchWithCrossRef(), enrichPaperWithCrossRef(), extractKeywordsFromText(), fetchCitingPapersFromOpenAlex(), fetchOpenAlexAbstractAndSDGs(), getQuarterFromMonth(), hashString() (+9 more)

### Community 15 - "cn"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 16 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 17 - "render-waterfall.mjs"
Cohesion: 0.17
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 18 - "YAYTP6L5.js"
Cohesion: 0.18
Nodes (8): __dirname, DIST_DIR, __filename, MIME_TYPES, PORT, server, applySecurityHeaders(), SECURITY_HEADERS

### Community 19 - "ProfilePage.tsx"
Cohesion: 0.19
Nodes (10): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+2 more)

### Community 20 - "App.tsx"
Cohesion: 0.38
Nodes (3): App(), router, ThemeProvider()

### Community 22 - "render-timeline.mjs"
Cohesion: 0.20
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle()

### Community 23 - "extract-audio-data.py"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 24 - "adminSearchStore.ts"
Cohesion: 0.16
Nodes (7): ApifyTokenUsage, ScholarSearchResult, AdminSearchState, AdminSearchStore, adminSearchStore, initialDefaultState, useAdminSearchStore()

### Community 25 - "createRouter"
Cohesion: 0.36
Nodes (8): buildHtmlEmail(), dispatchEmail(), getAppBaseUrl(), isSmtpConfigured, logEmail(), sendAdminInvitationEmail(), sendRegistrationApprovedEmail(), sendSelfRegisterVerificationEmail()

### Community 26 - "i18n.mjs"
Cohesion: 0.25
Nodes (3): LoginAttemptTracker, loginAttemptTracker, rateLimiter

### Community 27 - "CampusAIChatHistory.tsx"
Cohesion: 0.07
Nodes (46): ChatMessage, CampusAIChatHistory(), FormattedChatMessage(), FormattedChatMessageProps, parseInline(), adminNavigationCategories, bottomUtilityNavigation, DashboardLayout() (+38 more)

### Community 28 - "utils.ts"
Cohesion: 0.07
Nodes (8): HoverCardContent(), PopoverContent(), Progress(), ResizableHandle(), ResizablePanelGroup(), ScrollArea(), ScrollBar(), Slider()

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `generated-validators.mjs` to `compileWorkflowInternal`, `check-update.mjs`, `render-erd.mjs`, `dataflow-compiler.mjs`, `ApiService`, `toggle-group.tsx`, `render-sequence.mjs`, `render-lifecycle.mjs`, `cn`, `dropdown-menu.tsx`, `render-waterfall.mjs`, `ProfilePage.tsx`, `render-timeline.mjs`, `extract-audio-data.py`, `utils.ts`?**
  _High betweenness centrality (0.231) - this node is a cross-community bridge._
- **Should `compileWorkflowInternal` be split into smaller, more focused modules?**
  _Cohesion score 0.07662835249042145 - nodes in this community are weakly interconnected._
- **Why does `ApiService` connect `geometry.mjs` to `compileWorkflowInternal`, `check-update.mjs`, `render-erd.mjs`, `render-sequence.mjs`, `adminSearchStore.ts`, `CampusAIChatHistory.tsx`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Should `check-update.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.0716297786720322 - nodes in this community are weakly interconnected._
- **Why does `Button()` connect `compileWorkflowInternal` to `check-update.mjs`, `render-erd.mjs`, `dataflow-compiler.mjs`, `generated-validators.mjs`, `ApiService`, `render-sequence.mjs`, `render-waterfall.mjs`, `CampusAIChatHistory.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `render-erd.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.11152882205513784 - nodes in this community are weakly interconnected._
- **Should `geometry.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06101190476190476 - nodes in this community are weakly interconnected._