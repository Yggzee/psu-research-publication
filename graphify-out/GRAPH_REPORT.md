# Graph Report - ResPub  (2026-11-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 815 nodes · 2545 edges · 39 communities (30 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cface6f1`
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
- render-architecture.mjs
- render-sequence.mjs
- ref_node_path
- archify.mjs
- render-lifecycle.mjs
- commandDeliver
- cn
- UKSIWDDN.js
- render-waterfall.mjs
- YAYTP6L5.js
- ProfilePage.tsx
- workflow-compiler.mjs
- preview.mjs
- render-timeline.mjs
- extract-audio-data.py
- atomic-output.mjs
- createRouter
- i18n.mjs
- tts.mjs
- Button
- L4LY553T.js
- audio.mjs
- finalize.mjs
- brand-marks.mjs

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
- `SimulatedPublicCounterGraph()` --calls--> `Badge()`  [EXTRACTED]
  src/app/components/SystemGuidePage.tsx → src/app/components/ui/badge.tsx
- `SimulatedSDGRadarGraph()` --calls--> `Badge()`  [EXTRACTED]
  src/app/components/SystemGuidePage.tsx → src/app/components/ui/badge.tsx
- `CommandShortcut()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/command.tsx → src/app/components/ui/utils.ts
- `Menubar()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts
- `MenubarCheckboxItem()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts

## Import Cycles
- None detected.

## Communities (39 total, 9 thin omitted)

### Community 0 - "compileWorkflowInternal"
Cohesion: 0.06
Nodes (95): ApifyTokenManager(), ApifyTokenManagerProps, AskCampusAI(), ChatMessage, SUGGESTED_QUESTIONS, CampusAIChatHistory(), CoAuthorshipGraph(), EmptyStateProps (+87 more)

### Community 1 - "check-update.mjs"
Cohesion: 0.06
Nodes (61): DEPARTMENTS, emptyForm, CommandPalette(), CommandPaletteProps, Notice(), NoticeProps, NoticeVariant, TabItem (+53 more)

### Community 2 - "render-erd.mjs"
Cohesion: 0.11
Nodes (53): AdminPage(), EmptyState(), PageHeader(), PageHeaderProps, PageTabs(), PageTabsProps, StatCard(), StatusBadge() (+45 more)

### Community 3 - "geometry.mjs"
Cohesion: 0.06
Nodes (3): Publication, Researcher, ApiService

### Community 4 - "dataflow-compiler.mjs"
Cohesion: 0.08
Nodes (33): Separator(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter(), SidebarGroup(), SidebarGroupAction(), SidebarGroupContent() (+25 more)

### Community 5 - "generated-validators.mjs"
Cohesion: 0.09
Nodes (28): AccordionContent(), AccordionItem(), AccordionTrigger(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+20 more)

### Community 6 - "render-class.mjs"
Cohesion: 0.16
Nodes (28): activeCitationSyncJobs, attachTokenUsage(), cleanupOrphanedPublications(), computePublicationCitationYears(), deleteResearcherPublications(), enqueuePublicationCitationSync(), fetchApifyTokenUsage(), getActiveApifyTokenRow() (+20 more)

### Community 7 - "visual-check.mjs"
Cohesion: 0.10
Nodes (25): hashPassword(), deduplicateDatabase(), normalizeTitle(), auditAndSyncResearcherCitations(), autoBackfillMissingSDGs(), db, dbPath, dbReadyPromise (+17 more)

### Community 8 - "ApiService"
Cohesion: 0.11
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogPortal() (+10 more)

### Community 9 - "render-architecture.mjs"
Cohesion: 0.09
Nodes (9): HoverCardContent(), PopoverContent(), Progress(), ResizableHandle(), ResizablePanelGroup(), ScrollArea(), ScrollBar(), Switch() (+1 more)

### Community 10 - "render-sequence.mjs"
Cohesion: 0.16
Nodes (16): Dashboard(), OutputMetric, TopResearchTab, DepartmentLegend(), DepartmentLegendProps, RoleAwareDashboard(), DashboardStatsResponse, Department (+8 more)

### Community 11 - "ref_node_path"
Cohesion: 0.17
Nodes (20): buildResearcherWorkbook(), buildZipArchive(), citingHeaderStyle, crc32(), CRC_TABLE, createHyperlinkCell(), createTextCell(), deriveKeywords() (+12 more)

### Community 12 - "archify.mjs"
Cohesion: 0.18
Nodes (19): askCampusIntelligence(), auditJournalReputation(), calculateSynergy(), callGemini(), callLLM(), callOpenAICompat(), classifyPublicationSDG(), __dirname (+11 more)

### Community 13 - "render-lifecycle.mjs"
Cohesion: 0.12
Nodes (12): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarPortal(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 14 - "commandDeliver"
Cohesion: 0.27
Nodes (16): cleanText(), enrichBatchWithCrossRef(), enrichPaperWithCrossRef(), extractKeywordsFromText(), fetchCitingPapersFromOpenAlex(), getQuarterFromMonth(), hashString(), isInitialsToken() (+8 more)

### Community 15 - "cn"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 16 - "UKSIWDDN.js"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 17 - "render-waterfall.mjs"
Cohesion: 0.19
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 18 - "YAYTP6L5.js"
Cohesion: 0.18
Nodes (8): __dirname, DIST_DIR, __filename, MIME_TYPES, PORT, server, applySecurityHeaders(), SECURITY_HEADERS

### Community 19 - "ProfilePage.tsx"
Cohesion: 0.23
Nodes (10): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+2 more)

### Community 20 - "workflow-compiler.mjs"
Cohesion: 0.26
Nodes (9): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetPortal(), SheetTitle() (+1 more)

### Community 21 - "preview.mjs"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 22 - "render-timeline.mjs"
Cohesion: 0.22
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle()

### Community 23 - "extract-audio-data.py"
Cohesion: 0.24
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 25 - "createRouter"
Cohesion: 0.42
Nodes (8): buildHtmlEmail(), dispatchEmail(), getAppBaseUrl(), isSmtpConfigured, logEmail(), sendAdminInvitationEmail(), sendRegistrationApprovedEmail(), sendSelfRegisterVerificationEmail()

### Community 26 - "i18n.mjs"
Cohesion: 0.25
Nodes (3): LoginAttemptTracker, loginAttemptTracker, rateLimiter

### Community 27 - "tts.mjs"
Cohesion: 0.54
Nodes (6): PublicationInspectorDrawer(), PublicationInspectorDrawerProps, Tabs(), TabsContent(), TabsList(), TabsTrigger()

### Community 28 - "Button"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 30 - "audio.mjs"
Cohesion: 0.47
Nodes (3): App(), router, ThemeProvider()

### Community 31 - "finalize.mjs"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

## Knowledge Gaps
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `generated-validators.mjs` to `compileWorkflowInternal`, `check-update.mjs`, `render-erd.mjs`, `dataflow-compiler.mjs`, `ApiService`, `render-architecture.mjs`, `render-lifecycle.mjs`, `cn`, `UKSIWDDN.js`, `render-waterfall.mjs`, `ProfilePage.tsx`, `workflow-compiler.mjs`, `preview.mjs`, `render-timeline.mjs`, `extract-audio-data.py`, `tts.mjs`, `Button`, `finalize.mjs`?**
  _High betweenness centrality (0.327) - this node is a cross-community bridge._
- **Should `compileWorkflowInternal` be split into smaller, more focused modules?**
  _Cohesion score 0.059589271686679386 - nodes in this community are weakly interconnected._
- **Why does `ApiService` connect `geometry.mjs` to `compileWorkflowInternal`, `check-update.mjs`, `render-erd.mjs`, `render-sequence.mjs`, `tts.mjs`?**
  _High betweenness centrality (0.111) - this node is a cross-community bridge._
- **Should `check-update.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.055855855855855854 - nodes in this community are weakly interconnected._
- **Why does `Button()` connect `compileWorkflowInternal` to `check-update.mjs`, `render-erd.mjs`, `dataflow-compiler.mjs`, `generated-validators.mjs`, `ApiService`, `render-sequence.mjs`, `render-waterfall.mjs`, `tts.mjs`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Should `render-erd.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.11018437225636524 - nodes in this community are weakly interconnected._
- **Should `geometry.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06101190476190476 - nodes in this community are weakly interconnected._