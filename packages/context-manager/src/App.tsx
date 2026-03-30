import { useMemo, useState } from 'react';
import { submitHandoff } from './api/handoff.js';
import { DefaultContextView } from './components/DefaultContextView.js';
import { ImportView } from './components/ImportView.js';
import { PasteZone } from './components/PasteZone.js';
import { RepositoryView } from './components/RepositoryView.js';
import { SummaryView } from './components/SummaryView.js';
import { ToolConfigView } from './components/ToolConfigView.js';
import { useContextRoot } from './hooks/useContextRoot.js';
import { usePreviousProjects } from './hooks/usePreviousProjects.js';
import { useRepository } from './hooks/useRepository.js';
import { useTools } from './hooks/useTools.js';
import type {
  ContextType,
  ImportSelection,
  PastedEntry,
  PreviousProjectSummary,
  SubmitResponse,
} from './types.js';

const STEPS = ['Defaults', 'Paste', 'Import', 'Submit', 'Tools', 'Repository'] as const;

function createEntry(): PastedEntry {
  return {
    id: crypto.randomUUID(),
    label: '',
    suggestedType: '',
    content: '',
  };
}

export function App() {
  const contextRoot = useContextRoot();
  const previousProjects = usePreviousProjects();
  const toolsState = useTools();
  const repository = useRepository();
  const [currentStep, setCurrentStep] = useState(0);
  const [expanded, setExpanded] = useState<ContextType | null>(null);
  const [included, setIncluded] = useState<ContextType[]>([]);
  const [pastedEntries, setPastedEntries] = useState<PastedEntry[]>([]);
  const [importSelection, setImportSelection] = useState<ImportSelection | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const data = contextRoot.data;
  const groups = data?.groups ?? [];

  useMemo(() => {
    if (data && included.length === 0) {
      setIncluded(data.groups.map((group) => group.type));
    }
  }, [data, included.length]);

  const excluded = groups
    .map((group) => group.type)
    .filter((type) => !included.includes(type));

  const toggleInclude = (type: ContextType) => {
    setIncluded((current) =>
      current.includes(type) ? current.filter((value) => value !== type) : [...current, type]
    );
  };

  const addEntry = () => {
    setPastedEntries((current) => [...current, createEntry()]);
  };

  const updateEntry = (id: string, field: keyof PastedEntry, value: string) => {
    setPastedEntries((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, [field]: value } : entry))
    );
  };

  const removeEntry = (id: string) => {
    setPastedEntries((current) => current.filter((entry) => entry.id !== id));
  };

  const selectProject = (project: PreviousProjectSummary) => {
    setImportSelection({
      projectName: project.name,
      projectPath: project.path,
      importedTypes: [],
      files: [],
    });
  };

  const toggleImportType = (type: ContextType) => {
    setImportSelection((current) => {
      if (!current) return current;
      const project = previousProjects.data?.projects.find(
        (item) => item.path === current.projectPath
      );
      if (!project) return current;

      const nextTypes = current.importedTypes.includes(type)
        ? current.importedTypes.filter((value) => value !== type)
        : [...current.importedTypes, type];

      const files = project.groups
        .filter((group) => nextTypes.includes(group.type))
        .flatMap((group) => group.files.map((file) => `${group.type}/${file}`));

      return {
        ...current,
        importedTypes: nextTypes,
        files,
      };
    });
  };

  const handleSubmit = async () => {
    if (!data) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitResult(null);

    try {
      const result = await submitHandoff({
        timestamp: new Date().toISOString(),
        defaultContext: {
          included,
          excluded,
        },
        pastedContent: pastedEntries
          .filter((entry) => entry.content.trim())
          .map((entry) => ({
            label: entry.label.trim() || 'Untitled',
            suggestedType: entry.suggestedType || undefined,
            content: entry.content,
          })),
        importedFrom: importSelection
          ? {
              projectName: importSelection.projectName,
              importedTypes: importSelection.importedTypes,
              files: importSelection.files,
            }
          : undefined,
      });

      setSubmitResult(result);
      setCurrentStep(3);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to write handoff');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (contextRoot.isLoading || previousProjects.isLoading) {
    return <main className="shell"><div className="loading">Loading context manager...</div></main>;
  }

  if (!data) {
    return (
      <main className="shell">
        <div className="error-panel">
          <h1>Context manager could not load</h1>
          <p>{contextRoot.error ?? previousProjects.error ?? 'Unknown error'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Workflow 1</p>
          <h1>Context Manager</h1>
          <p className="hero-copy">
            Review defaults, add raw source material, import reusable context, and write a handoff
            file for the LLM session to structure into project context.
          </p>
        </div>
        <div className="hero-meta">
          <div><span>Project</span><strong>{data.projectPath}</strong></div>
          <div><span>Previous Projects</span><strong>{data.previousProjectsPath}</strong></div>
        </div>
      </header>

      <nav className="step-nav" aria-label="Context manager steps">
        {STEPS.map((step, index) => (
          <button
            key={step}
            className={`step-pill ${currentStep === index ? 'active' : ''}`}
            onClick={() => setCurrentStep(index)}
            type="button"
          >
            {step}
          </button>
        ))}
      </nav>

      <div className="stack-xl">
        {currentStep === 0 && (
          <DefaultContextView
            data={data}
            included={included}
            expanded={expanded}
            onToggleInclude={toggleInclude}
            onToggleExpanded={(type) => setExpanded(expanded === type ? null : type)}
          />
        )}

        {currentStep === 1 && (
          <PasteZone
            entries={pastedEntries}
            onAdd={addEntry}
            onChange={updateEntry}
            onRemove={removeEntry}
          />
        )}

        {currentStep === 2 && (
          <ImportView
            projects={previousProjects.data?.projects ?? []}
            selection={importSelection}
            onSelectProject={selectProject}
            onToggleType={toggleImportType}
          />
        )}

        {currentStep === 3 && (
          <SummaryView
            data={data}
            included={included}
            excluded={excluded}
            pastedEntries={pastedEntries}
            importSelection={importSelection}
            isSubmitting={isSubmitting}
            submitResult={submitResult}
            error={submitError}
            onSubmit={handleSubmit}
          />
        )}

        {currentStep === 4 && (
          <ToolConfigView
            tools={toolsState.tools}
            isLoading={toolsState.isLoading}
            isSaving={toolsState.isSaving}
            error={toolsState.error}
            onToggle={toolsState.toggleTool}
            onAdd={toolsState.addTool}
            onRemove={toolsState.removeTool}
          />
        )}

        {currentStep === 5 && (
          <RepositoryView
            data={repository.data}
            isLoading={repository.isLoading}
            error={repository.error}
          />
        )}
      </div>
    </main>
  );
}
