# Graph Report - ResPub  (2026-11-11)

## Corpus Check
- 118 files · ~135,330 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .css 5, .db 1)

## Summary
- 881 nodes · 2791 edges · 38 communities (29 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `af588a01`
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
- sheet.tsx
- input-otp.tsx
- render-timeline.mjs
- extract-audio-data.py
- breadcrumb.tsx
- createRouter
- i18n.mjs
- CampusAIChatHistory.tsx
- utils.ts
- L4LY553T.js
- popover.tsx
- vite.config.ts
- scroll-area.tsx

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
- `SelectLabel()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/select.tsx → src/app/components/ui/utils.ts
- `SelectSeparator()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/select.tsx → src/app/components/ui/utils.ts
- `CommandShortcut()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/command.tsx → src/app/components/ui/utils.ts
- `Menubar()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts
- `MenubarCheckboxItem()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/menubar.tsx → src/app/components/ui/utils.ts

## Import Cycles
- None detected.

## Communities (38 total, 9 thin omitted)

### Community 0 - "Button"
Cohesion: 0.07
Nodes (97): ApifyTokenManager(), ApifyTokenManagerProps, AskCampusAI(), SUGGESTED_QUESTIONS, CampusAIChatHistory(), CoAuthorshipGraph(), EmptyState(), EmptyStateProps (+89 more)

### Community 1 - "AdminPage.tsx"
Cohesion: 0.07
Nodes (50): AdminPage(), DEPARTMENTS, emptyForm, CommandPalette(), CommandPaletteProps, ALL_SDG_OPTIONS, parseAuthorsList(), PublicationDetail() (+42 more)

### Community 2 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 3 - "geometry.mjs"
Cohesion: 0.06
Nodes (3): Publication, Researcher, ApiService

### Community 4 - "dataflow-compiler.mjs"
Cohesion: 0.07
Nodes (33): Separator(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter(), SidebarGroup(), SidebarGroupAction(), SidebarGroupContent() (+25 more)

### Community 5 - "generated-validators.mjs"
Cohesion: 0.07
Nodes (28): AccordionContent(), AccordionItem(), AccordionTrigger(), CardAction(), CardFooter(), DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem() (+20 more)

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
Cohesion: 0.09
Nodes (23): App(), Dashboard(), OutputMetric, TopResearchTab, DepartmentLegend(), DepartmentLegendProps, RoleAwareDashboard(), router (+15 more)

### Community 11 - "ref_node_path"
Cohesion: 0.10
Nodes (30): buildResearcherWorkbook(), buildZipArchive(), citingHeaderStyle, crc32(), CRC_TABLE, createHyperlinkCell(), createTextCell(), deriveKeywords() (+22 more)

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

### Community 16 - "AdminSearchStore"
Cohesion: 0.17
Nodes (6): ApifyTokenUsage, ScholarSearchResult, AdminSearchState, AdminSearchStore, adminSearchStore, initialDefaultState

### Community 17 - "render-waterfall.mjs"
Cohesion: 0.17
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 18 - "YAYTP6L5.js"
Cohesion: 0.18
Nodes (8): __dirname, DIST_DIR, __filename, MIME_TYPES, PORT, server, applySecurityHeaders(), SECURITY_HEADERS

### Community 19 - "ProfilePage.tsx"
Cohesion: 0.19
Nodes (10): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+2 more)

### Community 20 - "sheet.tsx"
Cohesion: 0.26
Nodes (9): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetPortal(), SheetTitle() (+1 more)

### Community 21 - "input-otp.tsx"
Cohesion: 0.33
Nodes (3): InputOTP(), InputOTPGroup(), InputOTPSlot()

### Community 22 - "render-timeline.mjs"
Cohesion: 0.20
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle()

### Community 23 - "extract-audio-data.py"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 24 - "breadcrumb.tsx"
Cohesion: 0.22
Nodes (6): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator()

### Community 25 - "createRouter"
Cohesion: 0.33
Nodes (9): buildHtmlEmail(), dispatchEmail(), getAppBaseUrl(), isSmtpConfigured, logEmail(), sendAdminInvitationEmail(), sendRegistrationApprovedEmail(), sendSelfRegisterVerificationEmail() (+1 more)

### Community 26 - "i18n.mjs"
Cohesion: 0.25
Nodes (3): LoginAttemptTracker, loginAttemptTracker, rateLimiter

### Community 27 - "CampusAIChatHistory.tsx"
Cohesion: 0.06
Nodes (50): ChatMessage, FormattedChatMessage(), FormattedChatMessageProps, parseInline(), adminNavigationCategories, bottomUtilityNavigation, DashboardLayout(), instructorNavigationCategories (+42 more)

### Community 28 - "utils.ts"
Cohesion: 0.08
Nodes (8): HoverCardContent(), Progress(), RadioGroup(), RadioGroupItem(), ResizableHandle(), ResizablePanelGroup(), Slider(), Switch()

## Knowledge Gaps
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `generated-validators.mjs` to `Button`, `AdminPage.tsx`, `chart.tsx`, `dataflow-compiler.mjs`, `ApiService`, `toggle-group.tsx`, `render-lifecycle.mjs`, `cn`, `render-waterfall.mjs`, `ProfilePage.tsx`, `sheet.tsx`, `input-otp.tsx`, `render-timeline.mjs`, `extract-audio-data.py`, `breadcrumb.tsx`, `CampusAIChatHistory.tsx`, `utils.ts`, `popover.tsx`, `scroll-area.tsx`?**
  _High betweenness centrality (0.228) - this node is a cross-community bridge._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.07155813531652458 - nodes in this community are weakly interconnected._
- **Why does `ApiService` connect `geometry.mjs` to `Button`, `AdminPage.tsx`, `render-sequence.mjs`, `AdminSearchStore`, `CampusAIChatHistory.tsx`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Should `AdminPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07372229760289462 - nodes in this community are weakly interconnected._
- **Why does `Button()` connect `Button` to `AdminPage.tsx`, `dataflow-compiler.mjs`, `generated-validators.mjs`, `ApiService`, `render-sequence.mjs`, `render-waterfall.mjs`, `CampusAIChatHistory.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `geometry.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06101190476190476 - nodes in this community are weakly interconnected._
- **Should `dataflow-compiler.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07435897435897436 - nodes in this community are weakly interconnected._