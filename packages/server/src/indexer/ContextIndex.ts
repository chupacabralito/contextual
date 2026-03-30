// =============================================================================
// Context Index
// =============================================================================
// Indexes markdown/JSON files in context folders using SQLite FTS5.
// Watches for file changes and updates the index.
// =============================================================================

import path from 'node:path';
import { promises as fs } from 'node:fs';
import matter from 'gray-matter';
import chokidar, { type FSWatcher } from 'chokidar';
import initSqlJs from 'sql.js';
import type {
  ContextMatch,
  ContextType,
  Suggestion,
} from '@contextual/shared';
import { CONTEXT_TYPES } from '@contextual/shared';

interface IndexedDocument {
  filePath: string;
  relativePath: string;
  contextType: ContextType;
  source: string;
  date?: string;
  content: string;
}

interface SearchRow {
  content: string;
  source: string;
  date?: string;
  contextType: ContextType;
  rank: number;
}

type SqlJsModule = Awaited<ReturnType<typeof initSqlJs>>;
type SqlDatabase = InstanceType<SqlJsModule['Database']>;

function isContextType(value: string): value is ContextType {
  return CONTEXT_TYPES.includes(value as ContextType);
}

function createSnippet(text: string, maxLength = 160): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

function buildMatchQuery(query: string): string {
  const tokens = query
    .toLowerCase()
    .match(/[a-z0-9]+(?:[-_][a-z0-9]+)*/g);

  if (!tokens || tokens.length === 0) {
    return '""';
  }

  return tokens.map((token) => `${token}*`).join(' AND ');
}

function normalizeDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
}

async function walkDirectory(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const results = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return walkDirectory(entryPath);
      }
      return [entryPath];
    })
  );

  return results.flat();
}

async function readDocument(
  contextRoot: string,
  filePath: string
): Promise<IndexedDocument | null> {
  const relativePath = path.relative(contextRoot, filePath);
  const segments = relativePath.split(path.sep);
  const contextType = segments[0];

  if (!contextType || !isContextType(contextType)) {
    return null;
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.md' && ext !== '.json') {
    return null;
  }

  const raw = await fs.readFile(filePath, 'utf8');
  let content = raw;
  let date: string | undefined;

  if (ext === '.md') {
    const parsed = matter(raw);
    content = parsed.content;
    date = normalizeDate(parsed.data.date);
  } else {
    const parsed = JSON.parse(raw) as unknown;
    content = JSON.stringify(parsed, null, 2);
    const record =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    date = normalizeDate(record?.date);
  }

  return {
    filePath,
    relativePath,
    contextType,
    source: relativePath,
    date,
    content: content.trim(),
  };
}

/**
 * Context indexer using SQLite FTS5 for full-text search.
 */
export class ContextIndex {
  private readonly contextRoot: string;
  private readonly readyPromise: Promise<void>;
  private sql: SqlJsModule | null = null;
  private db: SqlDatabase | null = null;
  private watcher: FSWatcher | null = null;
  private readonly documents = new Map<string, IndexedDocument>();
  private usesFts = false;
  private readonly watchFiles: boolean;

  constructor(contextRoot: string, options: { watch?: boolean } = {}) {
    this.contextRoot = path.resolve(contextRoot);
    this.watchFiles = options.watch ?? true;
    this.readyPromise = this.initialize();
  }

  async ready(): Promise<void> {
    await this.readyPromise;
  }

  async close(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async search(query: string, type: ContextType): Promise<ContextMatch[]> {
    await this.ready();

    const rows = this.usesFts
      ? this.searchWithFts(query, type)
      : this.searchWithoutFts(query, type);

    if (rows.length > 0) {
      const maxRank = Math.max(...rows.map((row) => Math.abs(row.rank)));
      return rows.map((row) => ({
        content: row.content,
        source: row.source,
        date: row.date,
        relevance: maxRank === 0 ? 1 : Math.max(0, 1 - Math.abs(row.rank) / (maxRank + 1)),
      }));
    }

    const fallback = this.getDocumentsByType(type)
      .filter((document) => document.content.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);

    return fallback.map((document, index) => ({
      content: document.content,
      source: document.source,
      date: document.date,
      relevance: Math.max(0.1, 1 - index * 0.1),
    }));
  }

  async suggest(partial: string, type?: ContextType): Promise<Suggestion[]> {
    await this.ready();

    const normalized = partial.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    const db = this.getDb();
    const suggestions = new Map<string, Suggestion>();

    const like = `%${escapeLike(normalized)}%`;
    const stmt = db.prepare(
      this.usesFts
        ? `
            SELECT DISTINCT
              source,
              content,
              contextType
            FROM context_fts
            WHERE (lower(source) LIKE $like ESCAPE '\\'
               OR lower(content) LIKE $like ESCAPE '\\')
              ${type ? 'AND contextType = $type' : ''}
            ORDER BY CASE WHEN lower(source) LIKE $prefix ESCAPE '\\' THEN 0 ELSE 1 END, source ASC
            LIMIT 12
          `
        : `
            SELECT DISTINCT
              source,
              content,
              contextType
            FROM context_documents
            WHERE (lower(source) LIKE $like ESCAPE '\\'
               OR lower(content) LIKE $like ESCAPE '\\')
              ${type ? 'AND contextType = $type' : ''}
            ORDER BY CASE WHEN lower(source) LIKE $prefix ESCAPE '\\' THEN 0 ELSE 1 END, source ASC
            LIMIT 12
          `
    );

    const bindings: Record<string, string> = {
      $like: like,
      $prefix: `${escapeLike(normalized)}%`,
    };
    if (type) {
      bindings.$type = type;
    }
    stmt.bind(bindings);

    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        source: string;
        content: string;
        contextType: ContextType;
      };

      const text = path.basename(row.source, path.extname(row.source));
      suggestions.set(`${row.contextType}:${row.source}`, {
        text,
        type: row.contextType,
        preview: createSnippet(row.content),
      });
    }
    stmt.free();

    return Array.from(suggestions.values()).slice(0, 10);
  }

  async getStats(): Promise<{
    indexedFiles: number;
    availableTypes: ContextType[];
  }> {
    await this.ready();

    const availableTypes = CONTEXT_TYPES.filter((type) =>
      this.getDocumentsByType(type).length > 0
    );

    return {
      indexedFiles: this.documents.size,
      availableTypes,
    };
  }

  async getRelatedFindings(match: ContextMatch, type: ContextType): Promise<string[]> {
    await this.ready();

    const documents = this.getDocumentsByType(type)
      .filter((document) => document.source !== match.source)
      .filter((document) =>
        document.content.toLowerCase().includes(match.content.slice(0, 32).toLowerCase()) ||
        match.content
          .toLowerCase()
          .split(/\W+/)
          .some((token) => token.length > 4 && document.content.toLowerCase().includes(token))
      )
      .slice(0, 3);

    return documents.map((document) => createSnippet(document.content, 120));
  }

  private async initialize(): Promise<void> {
    this.sql = await initSqlJs();
    this.db = new this.sql.Database();
    this.createSchema();
    await this.rebuildIndex();
    if (this.watchFiles) {
      await this.startWatcher();
    }
  }

  private createSchema(): void {
    const db = this.getDb();
    try {
      db.run(`
        CREATE VIRTUAL TABLE context_fts USING fts5(
          content,
          source,
          date UNINDEXED,
          contextType UNINDEXED,
          tokenize = 'porter unicode61'
        );
      `);
      this.usesFts = true;
    } catch {
      this.usesFts = false;
      db.run(`
        CREATE TABLE context_documents (
          source TEXT PRIMARY KEY,
          content TEXT NOT NULL,
          date TEXT,
          contextType TEXT NOT NULL
        );
      `);
    }
  }

  private async rebuildIndex(): Promise<void> {
    const db = this.getDb();
    this.documents.clear();
    db.run(this.usesFts ? 'DELETE FROM context_fts;' : 'DELETE FROM context_documents;');

    for (const type of CONTEXT_TYPES) {
      const directory = path.join(this.contextRoot, type);
      try {
        const stats = await fs.stat(directory);
        if (!stats.isDirectory()) continue;
      } catch {
        continue;
      }

      const filePaths = await walkDirectory(directory);
      for (const filePath of filePaths) {
        await this.upsertFile(filePath);
      }
    }
  }

  private async startWatcher(): Promise<void> {
    this.watcher = chokidar.watch(
      CONTEXT_TYPES.map((type) => path.join(this.contextRoot, type)),
      {
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 150,
          pollInterval: 50,
        },
      }
    );

    this.watcher.on('add', (filePath) => {
      void this.upsertFile(filePath);
    });
    this.watcher.on('change', (filePath) => {
      void this.upsertFile(filePath);
    });
    this.watcher.on('unlink', (filePath) => {
      this.removeFile(filePath);
    });
  }

  private async upsertFile(filePath: string): Promise<void> {
    try {
      const document = await readDocument(this.contextRoot, filePath);
      if (!document) return;

      this.removeFile(filePath);
      this.documents.set(document.filePath, document);

      const db = this.getDb();
      const statement = db.prepare(this.usesFts
        ? `
            INSERT INTO context_fts (content, source, date, contextType)
            VALUES ($content, $source, $date, $contextType)
          `
        : `
            INSERT INTO context_documents (content, source, date, contextType)
            VALUES ($content, $source, $date, $contextType)
          `);

      statement.run({
        $content: document.content,
        $source: document.source,
        $date: document.date ?? null,
        $contextType: document.contextType,
      });
      statement.free();
    } catch (error) {
      console.error(`Failed to index ${filePath}:`, error);
    }
  }

  private removeFile(filePath: string): void {
    const existing = this.documents.get(filePath);
    if (!existing) return;

    const db = this.getDb();
    const statement = db.prepare(this.usesFts
      ? `
          DELETE FROM context_fts
          WHERE source = $source
            AND contextType = $contextType
        `
      : `
          DELETE FROM context_documents
          WHERE source = $source
            AND contextType = $contextType
        `);
    statement.run({
      $source: existing.source,
      $contextType: existing.contextType,
    });
    statement.free();

    this.documents.delete(filePath);
  }

  private getDocumentsByType(type: ContextType): IndexedDocument[] {
    return Array.from(this.documents.values()).filter((document) => document.contextType === type);
  }

  private searchWithFts(query: string, type: ContextType): SearchRow[] {
    const db = this.getDb();
    const matchQuery = buildMatchQuery(query);
    const statement = db.prepare(
      `
        SELECT
          content,
          source,
          date,
          contextType,
          bm25(context_fts) AS rank
        FROM context_fts
        WHERE context_fts MATCH $matchQuery
          AND contextType = $type
        ORDER BY rank ASC
        LIMIT 25
      `
    );

    statement.bind({
      $matchQuery: matchQuery,
      $type: type,
    });

    const rows: SearchRow[] = [];
    while (statement.step()) {
      rows.push(statement.getAsObject() as SearchRow);
    }
    statement.free();

    return rows;
  }

  private searchWithoutFts(query: string, type: ContextType): SearchRow[] {
    const documents = this.getDocumentsByType(type);
    const tokens = query
      .toLowerCase()
      .match(/[a-z0-9]+(?:[-_][a-z0-9]+)*/g) ?? [];

    return documents
      .map((document) => {
        const haystack = `${document.source}\n${document.content}`.toLowerCase();
        const tokenHits = tokens.reduce((score, token) => {
          if (!haystack.includes(token)) return score;
          const inSource = document.source.toLowerCase().includes(token) ? 2 : 0;
          return score + 1 + inSource;
        }, 0);

        const phraseBonus = haystack.includes(query.toLowerCase()) ? 2 : 0;
        const score = tokenHits + phraseBonus;

        return {
          content: document.content,
          source: document.source,
          date: document.date,
          contextType: document.contextType,
          rank: score > 0 ? 1 / score : Number.POSITIVE_INFINITY,
        };
      })
      .filter((row) => Number.isFinite(row.rank))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 25);
  }

  private getDb(): SqlDatabase {
    if (!this.db) {
      throw new Error('Context index is not initialized');
    }
    return this.db;
  }
}
