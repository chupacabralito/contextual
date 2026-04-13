// =============================================================================
// Contextual - Shared Types & API Contract
// =============================================================================
// This file defines the contract between the React annotation component
// and the local context server. Both packages depend on these types.
//
// Session 4: Added Pass, Instruction, ParsedAction, PreAttachedSnippet types
// for queue-based Instruct mode and pass persistence. Widened source/type
// fields from ContextType to string for protocol/UX separation.
// =============================================================================

// -----------------------------------------------------------------------------
// Context Types
// -----------------------------------------------------------------------------

/** The seven local context repository types */
export type ContextType =
  | 'research'
  | 'taste'
  | 'strategy'
  | 'design-system'
  | 'stakeholders'
  | 'technical'
  | 'business';

/** All valid local context types */
export const CONTEXT_TYPES: ContextType[] = [
  'research',
  'taste',
  'strategy',
  'design-system',
  'stakeholders',
  'technical',
  'business',
];

/** How much context depth to return. Lighter = fewer tokens = cheaper. */
export type ResolutionDepth = 'light' | 'standard' | 'detailed' | 'full';

/** Annotation mode: Instruct writes refinement instructions, Inspect shows decision trail */
export type AnnotationMode = 'instruct' | 'inspect';

// -----------------------------------------------------------------------------
// Corpus Types (Context Manager)
// -----------------------------------------------------------------------------
// Types for the organizational context corpus. Each ContextType has a compiled
// markdown file with YAML frontmatter and a _sources/ directory of raw inputs.
// -----------------------------------------------------------------------------

/** Metadata for a single section within a compiled context file */
export interface SectionMeta {
  /** Section title (matches the ## heading in the markdown) */
  title: string;
  /** Line number where this section starts (1-indexed) */
  startLine: number;
  /** Line number where this section ends (inclusive) */
  endLine: number;
  /** Approximate token count for this section (word count * 1.3) */
  tokenEstimate: number;
}

/** Frontmatter metadata for a compiled.md file */
export interface CompiledFileMeta {
  /** The context type this file belongs to */
  type: ContextType;
  /** Human-readable title (e.g., "Research Context") */
  title: string;
  /** ISO timestamp of last compilation */
  lastCompiled: string;
  /** Number of raw source files that were compiled */
  sourceCount: number;
  /** Section-level table of contents */
  sections: SectionMeta[];
  /** Total approximate token count across all sections */
  totalTokenEstimate: number;
  /** Priority tier for agent loading (defaults based on type if omitted) */
  priority?: ContextPriority;
}

/** Priority tier for agent context loading */
export type ContextPriority = 'system' | 'project' | 'reference';

/** Default priority for each context type */
export const DEFAULT_PRIORITIES: Record<ContextType, ContextPriority> = {
  'design-system': 'system',
  technical: 'system',
  research: 'project',
  strategy: 'project',
  stakeholders: 'project',
  taste: 'reference',
  business: 'reference',
};

/** Summary of one context type in the corpus */
export interface CorpusTypeEntry {
  /** The context type */
  type: ContextType;
  /** Whether a compiled.md exists for this type */
  exists: boolean;
  /** Parsed frontmatter from compiled.md (null if file doesn't exist or is invalid) */
  meta: CompiledFileMeta | null;
  /** Number of files in _sources/ */
  sourceCount: number;
  /** Effective priority (from frontmatter or DEFAULT_PRIORITIES fallback) */
  priority: ContextPriority;
}

/** Response for GET /api/corpus */
export interface CorpusResponse {
  /** Path to the context root directory */
  contextRoot: string;
  /** Project name from server config (--project flag) */
  project?: string;
  /** Status for each of the 7 context types */
  types: CorpusTypeEntry[];
  /** Sum of all token estimates across all types */
  totalTokenEstimate: number;
}

/** Response for GET /api/corpus/:type */
export interface CompiledFileResponse {
  /** Parsed frontmatter */
  meta: CompiledFileMeta;
  /** Full markdown body (everything after the frontmatter) */
  content: string;
}

/** Response for GET /api/corpus/:type/sections/:index */
export interface SectionResponse {
  /** The section metadata */
  section: SectionMeta;
  /** The section content (markdown text) */
  content: string;
}

/** A raw source file in _sources/ */
export interface SourceFile {
  /** Filename (e.g., "article-1.md") */
  filename: string;
  /** File size in bytes */
  size: number;
  /** Content preview (first 400 characters) */
  preview: string;
  /** ISO timestamp when the file was added (from file stat) */
  addedAt: string;
}

/** Response for GET /api/corpus/:type/sources */
export interface SourceListResponse {
  /** The context type */
  type: ContextType;
  /** List of raw source files */
  sources: SourceFile[];
}

/** Response for GET /api/corpus/:type/sources/:filename */
export interface SourceContentResponse {
  /** The filename */
  filename: string;
  /** Full file content */
  content: string;
}

/** Request body for POST /api/corpus/:type/sources */
export interface AddSourceRequest {
  /** Filename (auto-generated as paste-{timestamp}.md if omitted) */
  filename?: string;
  /** The content to write */
  content: string;
  /** Optional label (written as a comment at the top of the file) */
  label?: string;
}

/** Response for POST /api/corpus/:type/sources */
export interface AddSourceResponse {
  /** The final filename used */
  filename: string;
  /** Full path to the written file */
  path: string;
}

/** Request body for PUT /api/corpus/:type/compiled */
export interface UpdateCompiledRequest {
  /** Full markdown content including YAML frontmatter */
  content: string;
}

/** Request body for POST /api/corpus/import */
export interface ImportRequest {
  /** Path to the source context root to import from */
  sourcePath: string;
  /** Which context types to import */
  types: ContextType[];
}

/** Response for POST /api/corpus/import */
export interface ImportResponse {
  /** What was imported, grouped by type */
  imported: Array<{
    type: ContextType;
    files: string[];
  }>;
}

// -----------------------------------------------------------------------------
// Project Types
// -----------------------------------------------------------------------------

/** A project brief stored in _projects/{name}/brief.md */
export interface ProjectBrief {
  /** Project name (directory name) */
  name: string;
  /** Human-readable title from frontmatter */
  title: string;
  /** Brief description/goal (may be empty if not provided at creation) */
  description?: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last activity */
  lastActivityAt: string;
  /** Context types this project primarily uses */
  activeTypes: ContextType[];
  /** Full markdown body content from brief.md (after frontmatter) */
  body?: string;
}

/** Summary for project list views */
export interface ProjectSummary {
  name: string;
  title: string;
  lastActivityAt: string;
  passCount: number;
  outcomeCount?: number;
  activeTypes: ContextType[];
}

/** Response for GET /api/projects */
export interface ProjectListResponse {
  projects: ProjectSummary[];
}

/** Response for GET /api/projects/:name */
export interface ProjectDetailResponse {
  brief: ProjectBrief;
  passCount: number;
  outcomeCount?: number;
  passes: Array<{
    id: string;
    timestamp: string;
    instructionCount: number;
  }>;
  outcomes?: Array<{
    id: string;
    passId: string;
    timestamp: string;
    status: OutcomeStatus;
  }>;
}

/** Request for POST /api/projects */
export interface CreateProjectRequest {
  name: string;
  title: string;
  description?: string;
  activeTypes?: ContextType[];
}

/** Response for POST /api/projects */
export interface CreateProjectResponse {
  project: ProjectBrief;
  path: string;
}

// -----------------------------------------------------------------------------
// Legacy Context Manager Wizard Types (temporary compatibility)
// -----------------------------------------------------------------------------

/** @deprecated Legacy preview model from the pre-corpus context manager UI */
export interface ContextFilePreview {
  relativePath: string;
  fileName: string;
  summary: string;
  preview: string;
}

/** @deprecated Legacy grouped context-root response model */
export interface ContextTypeGroup {
  type: ContextType;
  fileCount: number;
  summary: string;
  files: ContextFilePreview[];
}

/** @deprecated Legacy default-context overview response */
export interface ContextRootResponse {
  contextRoot: string;
  projectPath: string;
  previousProjectsPath: string;
  groups: ContextTypeGroup[];
}

/** @deprecated Legacy import preview type */
export interface PreviousProjectSummary {
  name: string;
  path: string;
  groups: Array<{
    type: ContextType;
    fileCount: number;
    files: string[];
  }>;
}

/** @deprecated Legacy import preview response */
export interface PreviousProjectsResponse {
  projects: PreviousProjectSummary[];
}

/** @deprecated Legacy pasted-entry model */
export interface PastedEntry {
  id: string;
  label: string;
  suggestedType: ContextType | '';
  content: string;
}

/** @deprecated Legacy import-selection model */
export interface ImportSelection {
  projectName: string;
  projectPath: string;
  importedTypes: ContextType[];
  files: string[];
}

/** @deprecated Legacy handoff payload */
export interface HandoffPayload {
  timestamp: string;
  defaultContext: {
    included: ContextType[];
    excluded: ContextType[];
  };
  pastedContent: Array<{
    label: string;
    suggestedType?: ContextType;
    content: string;
  }>;
  importedFrom?: {
    projectName: string;
    importedTypes: ContextType[];
    files: string[];
  };
}

/** @deprecated Legacy submit response */
export interface SubmitResponse {
  handoffPath: string;
  copiedFiles: string[];
}

/** @deprecated Legacy repository-browser file entry */
export interface RepositoryFile {
  relativePath: string;
  fileName: string;
  type: ContextType;
  size: number;
  preview: string;
}

/** @deprecated Legacy repository-browser response */
export interface RepositoryResponse {
  contextRoot: string;
  files: RepositoryFile[];
  totalFiles: number;
}

// -----------------------------------------------------------------------------
// @Mention Types (legacy - preserved for backward compatibility)
// -----------------------------------------------------------------------------

/**
 * A parsed @mention from an annotation string.
 * @deprecated Use ParsedAction for new code. ParsedMention restricts type to ContextType.
 */
export interface ParsedMention {
  /** The context type (e.g., "research", "taste") */
  type: ContextType;
  /** The search query within brackets (e.g., "user save button") */
  query: string;
  /** Start index in the original annotation string */
  startIndex: number;
  /** End index in the original annotation string */
  endIndex: number;
}

// -----------------------------------------------------------------------------
// Parsed Actions (Session 4 - open namespace)
// -----------------------------------------------------------------------------

/**
 * A parsed @source[instruction] directive from annotation text.
 * Unlike ParsedMention, source is a string -- accepts any @source, not just
 * the 7 local ContextType values. This is the protocol/UX separation:
 * the parser accepts anything, autocomplete suggests configured tools.
 */
export interface ParsedAction {
  /** The @mention source (any string: "research", "posthog", "figma", etc.) */
  source: string;
  /** The directive inside brackets (e.g., "find proof that trust indicators boost CTA conversion") */
  instruction: string;
  /** Start index in the original annotation string */
  startIndex: number;
  /** End index in the original annotation string */
  endIndex: number;
}

// -----------------------------------------------------------------------------
// Element Targeting
// -----------------------------------------------------------------------------

/** How the user selected the element */
export type SelectionMode = 'click' | 'highlight' | 'drag-select';

/** A bounding box for spatial context */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Information about the targeted UI element */
export interface TargetedElement {
  /** CSS selector that identifies this element */
  selector: string;
  /** Human-readable label (button text, alt text, tag + class) */
  label: string;
  /** How the element was selected */
  selectionMode: SelectionMode;
  /** Bounding box in viewport coordinates */
  boundingBox: BoundingBox;
  /** If text was highlighted, the exact selected text */
  selectedText?: string;
  /** The element's tag name */
  tagName: string;
  /** CSS selectors for ancestor elements (parent -> root), used for inherited pass matching */
  ancestorSelectors?: string[];
}

// -----------------------------------------------------------------------------
// Annotation (legacy - preserved for backward compatibility)
// -----------------------------------------------------------------------------

/**
 * A complete annotation combining element + text + parsed mentions.
 * @deprecated Use QueuedInstruction for new queue-based flow.
 */
export interface Annotation {
  /** Unique ID for this annotation */
  id: string;
  /** The targeted element */
  element: TargetedElement;
  /** The raw annotation text as typed by the designer */
  rawText: string;
  /** Parsed @mentions extracted from the annotation text */
  mentions: ParsedMention[];
  /** Desired resolution depth */
  depth: ResolutionDepth;
  /** ISO timestamp */
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Instructions & Passes (Session 4 - queue-based Instruct mode)
// -----------------------------------------------------------------------------

/**
 * A pre-attached context snippet included in the pass record at submit time.
 * Stored so later analysis can determine what context the system handed the
 * agent, not just what the user asked for.
 */
export interface PreAttachedSnippet {
  /** Context type or tool source (e.g., "research", "posthog") */
  type: string;
  /** The query that produced this snippet */
  query: string;
  /** The matched content text */
  content: string;
  /** File path or origin (e.g., "research/checkout-friction.md") */
  source: string;
}

/**
 * An instruction in a submitted pass. This is the persisted form --
 * what gets written to /passes JSON files.
 */
export interface Instruction {
  /** Stable instruction ID for review, inspect, and future writeback attribution */
  id: string;
  /** The targeted UI element */
  element: TargetedElement;
  /** The raw annotation text as typed by the designer (including @mentions) */
  rawText: string;
  /** Parsed @source[instruction] directives */
  actions: ParsedAction[];
  /** Local context snippets that were pre-attached at submit time */
  preAttachedContext: PreAttachedSnippet[];
}

/**
 * A queued instruction in the annotation queue (in-memory, pre-submission).
 * Has an ID for queue management and resolved context for preview display.
 */
export interface QueuedInstruction {
  /** Unique ID for queue management */
  id: string;
  /** The targeted UI element */
  element: TargetedElement;
  /** The raw annotation text as typed by the designer */
  rawText: string;
  /** Parsed @source[instruction] directives */
  actions: ParsedAction[];
  /** ISO timestamp when added to queue */
  createdAt: string;
}

/**
 * A submitted pass -- the entire annotation queue processed as a unit.
 * Written as a timestamped JSON file to /passes on submit.
 */
export interface Pass {
  /** Unique ID (uuid or timestamp-based) */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Optional project identifier for project-scoped workflows */
  project?: string;
  /** Resolution depth (optional, defaults to 'standard') */
  depth?: ResolutionDepth;
  /** Explicit context types this pass is intended to affect */
  affectedContextTypes?: ContextType[];
  /** Relative corpus paths loaded or considered when the pass was created */
  loadedContextPaths?: string[];
  /** All instructions in the pass */
  instructions: Instruction[];
}

// -----------------------------------------------------------------------------
// API: POST /resolve
// -----------------------------------------------------------------------------

/**
 * A single mention to resolve against the local context index.
 * Type is string (not ContextType) -- the server resolves what it can
 * and returns empty matches for unknown sources.
 */
export interface ResolveMentionRequest {
  /** Source to search (any string; server resolves known ContextTypes, returns empty for others) */
  type: string;
  /** Search query */
  query: string;
}

/** Request body for POST /resolve */
export interface ResolveRequest {
  /** Mentions to resolve */
  mentions: ResolveMentionRequest[];
  /** Desired resolution depth (optional, defaults to 'standard') */
  depth?: ResolutionDepth;
}

// -----------------------------------------------------------------------------
// API: POST /resolve - Response
// -----------------------------------------------------------------------------

/** A single matched context result */
export interface ContextMatch {
  /** The matched content text */
  content: string;
  /** Source file path (relative to project context folder) */
  source: string;
  /** Date from the source document, if available */
  date?: string;
  /** Search relevance score (0-1) */
  relevance: number;
  /** Related findings (populated at 'detailed' and 'full' depth) */
  relatedFindings?: string[];
}

/**
 * Resolution result for a single mention.
 * Type is string to match the widened ResolveMentionRequest.
 */
export interface MentionResult {
  /** The source that was searched */
  type: string;
  /** The original search query */
  query: string;
  /** Matched context entries, ranked by relevance */
  matches: ContextMatch[];
}

/** Response body for POST /resolve */
export interface ResolveResponse {
  /** Results for each requested mention */
  results: MentionResult[];
}

// -----------------------------------------------------------------------------
// API: GET /health
// -----------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok' | 'error';
  /** Number of indexed context files */
  indexedFiles: number;
  /** Current project name */
  project: string;
  /** Available context types that have files */
  availableTypes: ContextType[];
}

/** Paired Terminal session metadata for one context root */
export interface TerminalPairing {
  terminalApp: 'Terminal.app';
  tty: string;
  termProgram: string;
  pairedAt: string;
  updatedAt: string;
  workingDirectory?: string;
}

/** Response for GET /api/pairing */
export interface PairingStatusResponse {
  paired: boolean;
  path: string;
  suggestedCommand: string;
  pairing: TerminalPairing | null;
}

// -----------------------------------------------------------------------------
// API: GET /suggest
// -----------------------------------------------------------------------------

/** Request params for autocomplete suggestions */
export interface SuggestRequest {
  /** Partial context type or query */
  partial: string;
  /** If type is already known, search within that type */
  type?: string;
}

/** A single autocomplete suggestion */
export interface Suggestion {
  /** The suggested text */
  text: string;
  /** Source type (local context type or configured tool) */
  type: string;
  /** Brief preview of what this matches */
  preview: string;
}

/** Response for autocomplete suggestions */
export interface SuggestResponse {
  suggestions: Suggestion[];
}

// -----------------------------------------------------------------------------
// API: POST /scaffold
// -----------------------------------------------------------------------------

/** Request to create a new project scaffold */
export interface ScaffoldRequest {
  /** Project name (used as folder name) */
  projectName: string;
  /** Base directory to create the project in */
  basePath: string;
}

/** Response after scaffolding */
export interface ScaffoldResponse {
  /** Full path to the created project */
  projectPath: string;
  /** Context types created */
  createdFolders: ContextType[];
}

// -----------------------------------------------------------------------------
// API: POST /passes
// -----------------------------------------------------------------------------

/** Request body for POST /passes (persist a submitted pass) */
export interface CreatePassRequest {
  /** The pass to persist */
  pass: Pass;
}

/** Response after persisting a pass */
export interface CreatePassResponse {
  /** Pass ID */
  id: string;
  /** File path where the pass was written */
  path: string;
  /** ISO timestamp */
  timestamp: string;
}

// -----------------------------------------------------------------------------
// API: POST /outcomes
// -----------------------------------------------------------------------------

export type OutcomeStatus =
  | 'pending'
  | 'approved'
  | 'approved-with-feedback'
  | 'rejected';

export type InstructionReviewStatus =
  | 'pending'
  | 'looks-good'
  | 'needs-another-pass';

export type WritebackKind = 'learned' | 'brief' | 'compiled' | 'source';

export interface OutcomeWriteback {
  /** Relative path to the artifact written back into the corpus */
  path: string;
  /** What kind of artifact was updated */
  kind: WritebackKind;
  /** Human-readable summary of the writeback */
  summary: string;
  /** One or more pass IDs that informed this writeback */
  sourcePassIds: string[];
}

export interface InstructionLearningDraft {
  /** Short title for the reusable learning */
  title: string;
  /** Distilled lesson text */
  summary: string;
  /** Intended learned/ destination */
  destination: LearnedFolderName;
}

export interface InstructionReview {
  /** Instruction being reviewed */
  instructionId: string;
  /** Human-readable element label for quick scanning */
  elementLabel: string;
  /** Original instruction text for quick recall */
  rawText: string;
  /** Operator evaluation of this instruction result */
  status: InstructionReviewStatus;
  /** Optional follow-up note or rationale */
  feedback?: string;
  /** Optional draft learning attached to this instruction */
  learningDraft?: InstructionLearningDraft;
  /** ISO timestamp for the last review update */
  reviewedAt?: string;
}

export interface PassOutcome {
  /** Unique ID for the outcome record */
  id: string;
  /** Pass this outcome belongs to */
  passId: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Review/execution state of the outcome */
  status: OutcomeStatus;
  /** Optional project identifier for project-scoped workflows */
  project?: string;
  /** Explicit context types touched by the completed work */
  affectedContextTypes?: ContextType[];
  /** Relative corpus paths that were loaded during execution or review */
  loadedContextPaths?: string[];
  /** High-level summary of what changed */
  summary?: string;
  /** Human approval feedback or rejection rationale */
  feedback?: string;
  /** Per-instruction review state for the latest pass */
  instructionReviews?: InstructionReview[];
  /** Files changed by the agent while executing the pass */
  changedFiles: string[];
  /** Optional git commit SHA associated with the work */
  commitSha?: string;
  /** Optional pull request URL associated with the work */
  prUrl?: string;
  /** Corpus artifacts created or updated from this pass */
  writebacks: OutcomeWriteback[];
}

/** Request body for POST /outcomes (persist a pass outcome) */
export interface CreateOutcomeRequest {
  /** The outcome to persist */
  outcome: PassOutcome;
}

/** Response after persisting an outcome */
export interface CreateOutcomeResponse {
  /** Outcome ID */
  id: string;
  /** File path where the outcome was written */
  path: string;
  /** ISO timestamp */
  timestamp: string;
}

// -----------------------------------------------------------------------------
// API: GET /passes
// -----------------------------------------------------------------------------

/** Summary of a pass (for list views) */
export interface PassSummary {
  /** Pass ID */
  id: string;
  /** ISO timestamp */
  timestamp: string;
  /** Optional project identifier for project-scoped workflows */
  project?: string;
  /** Resolution depth (optional) */
  depth?: ResolutionDepth;
  /** Explicit context types this pass is intended to affect */
  affectedContextTypes?: ContextType[];
  /** Relative corpus paths loaded or considered when the pass was created */
  loadedContextPaths?: string[];
  /** Number of instructions in the pass */
  instructionCount: number;
  /** Element labels targeted in this pass */
  elementLabels: string[];
}

/** Response for GET /passes (list all passes) */
export interface PassListResponse {
  /** All passes, most recent first */
  passes: PassSummary[];
}

// -----------------------------------------------------------------------------
// API: GET /outcomes
// -----------------------------------------------------------------------------

export interface OutcomeSummary {
  /** Outcome ID */
  id: string;
  /** Related pass ID */
  passId: string;
  /** ISO timestamp */
  timestamp: string;
  /** Outcome state */
  status: OutcomeStatus;
  /** Optional project identifier for project-scoped workflows */
  project?: string;
  /** Explicit context types touched by the completed work */
  affectedContextTypes?: ContextType[];
  /** Number of code/content files changed */
  changedFileCount: number;
  /** Number of writeback artifacts produced */
  writebackCount: number;
}

export interface OutcomeListResponse {
  /** All outcomes, most recent first */
  outcomes: OutcomeSummary[];
}

// -----------------------------------------------------------------------------
// API: GET /inspect
// -----------------------------------------------------------------------------

/** A reference to a specific instruction within a pass (for Inspect mode) */
export interface InspectPassReference {
  /** Pass ID */
  passId: string;
  /** Pass timestamp */
  timestamp: string;
  /** The instruction that targeted this element */
  instruction: Instruction;
  /** If set, this pass was inherited from an ancestor element (the selector it matched) */
  inheritedFrom?: string;
}

/** Response for GET /inspect?selector=... (decision trail for an element) */
export interface InspectResponse {
  /** The CSS selector that was queried */
  selector: string;
  /** Passes that directly targeted this element, most recent first */
  passes: InspectPassReference[];
  /** Passes inherited from ancestor elements (parent, root, etc.), most recent first */
  inheritedPasses: InspectPassReference[];
  /** Pre-attached context that was included when this element was targeted */
  contextHistory: PreAttachedSnippet[];
}

// -----------------------------------------------------------------------------
// API: GET /tools & POST /tools
// -----------------------------------------------------------------------------

/** A configured tool available as an @mention target */
export interface ConfiguredTool {
  /** Tool name (used as @mention source, e.g., "posthog", "figma") */
  name: string;
  /** Human-readable label */
  label: string;
  /** Whether this tool is enabled for the current project */
  enabled: boolean;
}

/** Response for GET /tools */
export interface ToolsResponse {
  /** All configured tools */
  tools: ConfiguredTool[];
}

/** Request body for POST /tools (update tool configuration) */
export interface UpdateToolsRequest {
  /** Tools to set (replaces full list) */
  tools: ConfiguredTool[];
}

// -----------------------------------------------------------------------------
// Structured Output (legacy - preserved for backward compatibility)
// -----------------------------------------------------------------------------

/**
 * The structured pass submitted to the agent (single annotation with pre-attached local context).
 * @deprecated Use Pass for new multi-instruction flow.
 */
export interface StructuredOutput {
  /** The annotation that produced this output */
  annotation: Annotation;
  /** Resolved context for each mention */
  resolvedContext: MentionResult[];
  /** The depth level used */
  depth: ResolutionDepth;
}

// -----------------------------------------------------------------------------
// Server Configuration
// -----------------------------------------------------------------------------

export interface ServerConfig {
  /** Port for the local HTTP server (default: 4700) */
  port: number;
  /** Path to the project's context folder root */
  contextRoot: string;
  /** Project name */
  projectName: string;
}

export const DEFAULT_SERVER_PORT = 4700;

export const DEFAULT_CONTEXT_FOLDERS: ContextType[] = CONTEXT_TYPES;

export const DEFAULT_LEARNED_FOLDERS = [
  'operator-preferences',
  'ui-patterns',
  'tool-routing',
  'project-decisions',
] as const;

export type LearnedFolderName = typeof DEFAULT_LEARNED_FOLDERS[number];

// -----------------------------------------------------------------------------
// Context Discovery (scan project for existing .md files)
// -----------------------------------------------------------------------------

/** A markdown file found in the project directory */
export interface DiscoveredFile {
  /** Relative path from the project root */
  relativePath: string;
  /** Filename */
  filename: string;
  /** First 500 characters of the file content */
  preview: string;
  /** File size in bytes */
  size: number;
  /** Suggested context type based on path/content heuristics */
  suggestedType: ContextType | null;
}

/** Response for GET /api/discover */
export interface DiscoverResponse {
  /** The project directory that was scanned */
  projectDir: string;
  /** Markdown files found */
  files: DiscoveredFile[];
}

/** A single file to import with its assigned category */
export interface DiscoverImportFile {
  /** Relative path from the project root */
  relativePath: string;
  /** The context type to import into */
  type: ContextType;
}

/** Request body for POST /api/discover/import */
export interface DiscoverImportRequest {
  /** Files to import with their assigned categories */
  files: DiscoverImportFile[];
}

/** Response for POST /api/discover/import */
export interface DiscoverImportResponse {
  /** Number of files imported */
  imported: number;
  /** Details of each import */
  results: Array<{
    relativePath: string;
    type: ContextType;
    filename: string;
  }>;
}

// -----------------------------------------------------------------------------
// Utility: Type guard for ContextType
// -----------------------------------------------------------------------------

/** Check if a string is one of the 7 local context types */
export function isContextType(value: string): value is ContextType {
  return CONTEXT_TYPES.includes(value as ContextType);
}
