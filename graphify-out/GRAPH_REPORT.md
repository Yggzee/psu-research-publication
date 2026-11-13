# Graph Report - ResPub  (2026-11-12)

## Corpus Check
- 118 files · ~141,051 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .css 5, .db 1)

## Summary
- 894 nodes · 2837 edges · 38 communities (30 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `01a2d59c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Button
- researchStore.ts
- chart.tsx
- geometry.mjs
- dataflow-compiler.mjs
- cn
- render-class.mjs
- visual-check.mjs
- ApiService
- toggle-group.tsx
- PublicationDetail.tsx
- dropdown-menu.tsx
- archify.mjs
- api.service.ts
- commandDeliver
- cn
- adminSearchStore.ts
- render-waterfall.mjs
- YAYTP6L5.js
- ProfilePage.tsx
- CommandPalette.tsx
- resizable.tsx
- render-timeline.mjs
- extract-audio-data.py
- createRouter
- i18n.mjs
- CampusAIChatHistory.tsx
- utils.ts
- L4LY553T.js
- AdminPage.tsx
- vite.config.ts
- ProfilePage.tsx
- SearchEngine.tsx
- menubar.tsx

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
- `CommandShortcut()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/command.tsx → src/app/components/ui/utils.ts
- `ContextMenuCheckboxItem()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/context-menu.tsx → src/app/components/ui/utils.ts
- `ContextMenuContent()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/context-menu.tsx → src/app/components/ui/utils.ts
- `ContextMenuItem()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/context-menu.tsx → src/app/components/ui/utils.ts
- `ContextMenuLabel()` --calls--> `cn()`  [EXTRACTED]
  src/app/components/ui/context-menu.tsx → src/app/components/ui/utils.ts

## Import Cycles
- None detected.

## Communities (38 total, 8 thin omitted)

### Community 0 - "Button"
Cohesion: 0.06
Nodes (75): App(), ApifyTokenManager(), ApifyTokenManagerProps, AskCampusAI(), SUGGESTED_QUESTIONS, CoAuthorshipGraph(), PageHeader(), PageHeaderProps (+67 more)

### Community 1 - "researchStore.ts"
Cohesion: 0.15
Nodes (17): addResearchRecord(), AUTH_TOKEN_KEY, deleteResearchRecord(), getManagedResearchers(), getResearchRecords(), getStoredUser(), PUBLICATIONS_STORAGE_KEY, removeResearcherRecordsFromLocal() (+9 more)

### Community 2 - "chart.tsx"
Cohesion: 0.27
Nodes (10): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartStyle(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 3 - "geometry.mjs"
Cohesion: 0.06
Nodes (3): Publication, Researcher, ApiService

### Community 4 - "dataflow-compiler.mjs"
Cohesion: 0.06
Nodes (42): Separator(), Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetPortal() (+34 more)

### Community 5 - "cn"
Cohesion: 0.08
Nodes (27): AccordionContent(), AccordionItem(), AccordionTrigger(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+19 more)

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

### Community 10 - "PublicationDetail.tsx"
Cohesion: 0.27
Nodes (16): AdminPage(), ALL_SDG_OPTIONS, parseAuthorsList(), PublicationDetail(), SDG_COLORS, ScholarImportModal(), Checkbox(), Dialog() (+8 more)

### Community 11 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 12 - "archify.mjs"
Cohesion: 0.16
Nodes (21): askCampusIntelligence(), auditJournalReputation(), buildDynamicSDGRationale(), calculateSynergy(), callGemini(), callLLM(), callOpenAICompat(), classifyPublicationSDG() (+13 more)

### Community 13 - "api.service.ts"
Cohesion: 0.11
Nodes (17): API_CONFIG, API_ENDPOINTS, ApifyToken, AskCampusResponse, FetchScholarProfileResponse, NetworkGraphLink, NetworkGraphNode, NetworkGraphResponse (+9 more)

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

### Community 20 - "CommandPalette.tsx"
Cohesion: 0.31
Nodes (11): CommandPalette(), CommandPaletteProps, Command(), CommandDialog(), CommandEmpty(), CommandGroup(), CommandInput(), CommandItem() (+3 more)

### Community 22 - "render-timeline.mjs"
Cohesion: 0.20
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerPortal(), DrawerTitle()

### Community 23 - "extract-audio-data.py"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 25 - "createRouter"
Cohesion: 0.33
Nodes (9): buildHtmlEmail(), dispatchEmail(), getAppBaseUrl(), isSmtpConfigured, logEmail(), sendAdminInvitationEmail(), sendRegistrationApprovedEmail(), sendSelfRegisterVerificationEmail() (+1 more)

### Community 26 - "i18n.mjs"
Cohesion: 0.25
Nodes (3): LoginAttemptTracker, loginAttemptTracker, rateLimiter

### Community 27 - "CampusAIChatHistory.tsx"
Cohesion: 0.10
Nodes (39): ChatMessage, CampusAIChatHistory(), FormattedChatMessage(), FormattedChatMessageProps, parseInline(), ConfirmModal(), ConfirmModalProps, adminNavigationCategories (+31 more)

### Community 28 - "utils.ts"
Cohesion: 0.09
Nodes (6): HoverCardContent(), PopoverContent(), Progress(), ScrollArea(), ScrollBar(), Slider()

### Community 30 - "AdminPage.tsx"
Cohesion: 0.13
Nodes (9): DEPARTMENTS, emptyForm, NoticeProps, NoticeVariant, EmailLog, InvitationRequest, PendingRegistration, FACULTY_DATA_KEY (+1 more)

### Community 35 - "ProfilePage.tsx"
Cohesion: 0.06
Nodes (71): EmptyState(), EmptyStateProps, PageTabsProps, TabItem, StatusBadgeProps, StatusType, ProfilePage(), SortOption (+63 more)

### Community 37 - "SearchEngine.tsx"
Cohesion: 0.19
Nodes (10): ScholarImportModalProps, SearchEngine(), ApifyTokenUsage, ScholarSearchResult, AdminSearchState, adminSearchStore, initialDefaultState, useAdminSearchStore() (+2 more)

### Community 39 - "menubar.tsx"
Cohesion: 0.12
Nodes (12): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarPortal(), MenubarRadioItem(), MenubarSeparator() (+4 more)

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `Button`, `chart.tsx`, `dataflow-compiler.mjs`, `ApiService`, `toggle-group.tsx`, `PublicationDetail.tsx`, `dropdown-menu.tsx`, `cn`, `render-waterfall.mjs`, `ProfilePage.tsx`, `CommandPalette.tsx`, `resizable.tsx`, `render-timeline.mjs`, `extract-audio-data.py`, `CampusAIChatHistory.tsx`, `utils.ts`, `AdminPage.tsx`, `ProfilePage.tsx`, `menubar.tsx`?**
  _High betweenness centrality (0.224) - this node is a cross-community bridge._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.06374193548387097 - nodes in this community are weakly interconnected._
- **Why does `ApiService` connect `geometry.mjs` to `Button`, `researchStore.ts`, `ProfilePage.tsx`, `SearchEngine.tsx`, `PublicationDetail.tsx`, `api.service.ts`, `CommandPalette.tsx`, `CampusAIChatHistory.tsx`, `AdminPage.tsx`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Should `researchStore.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14736842105263157 - nodes in this community are weakly interconnected._
- **Why does `Button()` connect `Button` to `ProfilePage.tsx`, `dataflow-compiler.mjs`, `SearchEngine.tsx`, `cn`, `ApiService`, `PublicationDetail.tsx`, `render-waterfall.mjs`, `CampusAIChatHistory.tsx`, `AdminPage.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `geometry.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06101190476190476 - nodes in this community are weakly interconnected._
- **Should `dataflow-compiler.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06095791001451379 - nodes in this community are weakly interconnected._