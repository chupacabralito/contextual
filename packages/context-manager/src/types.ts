// =============================================================================
// Context Manager Types
// =============================================================================
// Re-exports all context-manager-relevant types from @contextual/shared.
// The UI layer imports from this file, never directly from shared.
// =============================================================================

export type {
  ContextType,
  ContextPriority,
  CompiledFileMeta,
  CompiledFileResponse,
  CorpusResponse,
  CorpusTypeEntry,
  CreateOutcomeRequest,
  CreateOutcomeResponse,
  ProjectBrief,
  ProjectSummary,
  ProjectListResponse,
  ProjectDetailResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  SectionMeta,
  SectionResponse,
  SourceFile,
  SourceListResponse,
  SourceContentResponse,
  AddSourceRequest,
  AddSourceResponse,
  UpdateCompiledRequest,
  ImportRequest,
  ImportResponse,
  ContextFilePreview,
  ContextTypeGroup,
  ContextRootResponse,
  PreviousProjectSummary,
  PreviousProjectsResponse,
  PastedEntry,
  ImportSelection,
  HandoffPayload,
  SubmitResponse,
  PairingStatusResponse,
  TerminalPairing,
  ConfiguredTool,
  OutcomeListResponse,
  OutcomeStatus,
  OutcomeSummary,
  OutcomeWriteback,
  PassOutcome,
  RepositoryFile,
  RepositoryResponse,
} from '@contextual/shared';

export {
  CONTEXT_TYPES,
  DEFAULT_LEARNED_FOLDERS,
  DEFAULT_PRIORITIES,
} from '@contextual/shared';
