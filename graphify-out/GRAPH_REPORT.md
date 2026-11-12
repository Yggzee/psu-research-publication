# Graph Report - ResPub  (2026-11-12)

## Corpus Check
- 118 files · ~137,318 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 5, .css 5, .db 1)

## Summary
- 886 nodes · 2805 edges · 37 communities (29 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `32b025dd`
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
- chartUtils.ts
- ref_node_path
- archify.mjs
- dropdown-menu.tsx
- commandDeliver
- cn
- adminSearchStore.ts
- render-waterfall.mjs
- YAYTP6L5.js
- ProfilePage.tsx
- sheet.tsx
- PublicationInspectorDrawer.tsx
- render-timeline.mjs
- extract-audio-data.py
- App.tsx
- createRouter
- i18n.mjs
- CampusAIChatHistory.tsx
- utils.ts
- L4LY553T.js
- Notice.tsx
- vite.config.ts

## God Nodes (most connected - your core abstractions)
1. `cn()` - 223 edges
2. `ApiService` - 87 edges
3. `Button()` - 66 edges
4. `handleApiRequest()` - 50 edges
5. `Badge()` - 50 edges
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

## Communities (37 total, 8 thin omitted)

### Community 0 - "Button"
Cohesion: 0.06
Nodes (110): ApifyTokenManager(), ApifyTokenManagerProps, AskCampusAI(), SUGGESTED_QUESTIONS, CoAuthorshipGraph(), EmptyState(), EmptyStateProps, PageHeader() (+102 more)

### Community 1 - "AdminPage.tsx"
Cohesion: 0.06
Nodes (62): AdminPage(), DEPARTMENTS, emptyForm, CommandPalette(), CommandPaletteProps, ConfirmModal(), ConfirmModalProps, adminNavigationCategories (+54 more)

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
Nodes (34): AccordionContent(), AccordionItem(), AccordionTrigger(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+26 more)

### Community 6 - "render-class.mjs"
Cohesion: 0.16
Nodes (29): activeCitationSyncJobs, attachTokenUsage(), cleanupOrphanedPublications(), computePublicationCitationYears(), deleteResearcherPublications(), enqueuePublicationCitationSync(), fetchApifyTokenUsage(), getActiveApifyTokenRow() (+21 more)

### Community 7 - "visual-check.mjs"
Cohesion: 0.13
Nodes (21): isGenericBoilerplate(), hashPassword(), deduplicateDatabase(), normalizeTitle(), auditAndSyncResearcherCitations(), autoBackfillMissingSDGs(), db, dbPath (+13 more)

### Community 8 - "ApiService"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogPortal() (+10 more)

### Community 9 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (9): Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle() (+1 more)

### Community 10 - "chartUtils.ts"
Cohesion: 0.24
Nodes (8): DepartmentLegendProps, Department, departmentLegendData, DepartmentLegendProps, DEPARTMENTS, getCurrentYear(), getYearRange(), shiftYearRangeForward()

### Community 11 - "ref_node_path"
Cohesion: 0.16
Nodes (20): buildResearcherWorkbook(), buildZipArchive(), citingHeaderStyle, crc32(), CRC_TABLE, createHyperlinkCell(), createTextCell(), deriveKeywords() (+12 more)

### Community 12 - "archify.mjs"
Cohesion: 0.16
Nodes (21): askCampusIntelligence(), auditJournalReputation(), buildDynamicSDGRationale(), calculateSynergy(), callGemini(), callLLM(), callOpenAICompat(), classifyPublicationSDG() (+13 more)

### Community 13 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 14 - "commandDeliver"
Cohesion: 0.25
Nodes (18): cleanText(), enrichBatchWithCrossRef(), enrichPaperWithCrossRef(), extractKeywordsFromText(), fetchCitingPapersFromOpenAlex(), fetchOpenAlexAbstractAndSDGs(), getQuarterFromMonth(), hashString() (+10 more)

### Community 15 - "cn"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 16 - "adminSearchStore.ts"
Cohesion: 0.16
Nodes (7): ApifyTokenUsage, ScholarSearchResult, AdminSearchState, AdminSearchStore, adminSearchStore, initialDefaultState, useAdminSearchStore()

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
Cohesion: 0.26
Nodes (9): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetPortal(), SheetTitle() (+1 more)

### Community 21 - "PublicationInspectorDrawer.tsx"
Cohesion: 0.44
Nodes (6): PublicationInspectorDrawer(), PublicationInspectorDrawerProps, Tabs(), TabsContent(), TabsList(), TabsTrigger()

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
Cohesion: 0.08
Nodes (39): ChatMessage, CampusAIChatHistory(), FormattedChatMessage(), FormattedChatMessageProps, parseInline(), FloatingAskAIBubble(), SPECIFIC_SUGGESTIONS, SpecificPrompt (+31 more)

### Community 28 - "utils.ts"
Cohesion: 0.05
Nodes (15): HoverCardContent(), InputOTP(), InputOTPGroup(), InputOTPSlot(), PopoverContent(), Progress(), RadioGroup(), RadioGroupItem() (+7 more)

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `Button`, `AdminPage.tsx`, `chart.tsx`, `dataflow-compiler.mjs`, `ApiService`, `toggle-group.tsx`, `dropdown-menu.tsx`, `cn`, `render-waterfall.mjs`, `ProfilePage.tsx`, `sheet.tsx`, `PublicationInspectorDrawer.tsx`, `render-timeline.mjs`, `extract-audio-data.py`, `utils.ts`?**
  _High betweenness centrality (0.226) - this node is a cross-community bridge._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.05887021138446 - nodes in this community are weakly interconnected._
- **Why does `ApiService` connect `geometry.mjs` to `Button`, `AdminPage.tsx`, `adminSearchStore.ts`, `PublicationInspectorDrawer.tsx`, `CampusAIChatHistory.tsx`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Should `AdminPage.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05789009697325889 - nodes in this community are weakly interconnected._
- **Why does `Button()` connect `Button` to `AdminPage.tsx`, `dataflow-compiler.mjs`, `cn`, `ApiService`, `render-waterfall.mjs`, `PublicationInspectorDrawer.tsx`, `CampusAIChatHistory.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `geometry.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.06101190476190476 - nodes in this community are weakly interconnected._
- **Should `dataflow-compiler.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.07435897435897436 - nodes in this community are weakly interconnected._