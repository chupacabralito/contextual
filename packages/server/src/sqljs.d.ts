declare module 'sql.js' {
  interface BindParams {
    [key: string]: string | number | boolean | null | Uint8Array | undefined;
  }

  interface QueryExecResult {
    columns: string[];
    values: Array<Array<string | number | null>>;
  }

  class Statement {
    bind(values?: BindParams | Array<string | number | null>): void;
    step(): boolean;
    getAsObject(): Record<string, any>;
    run(values?: BindParams | Array<string | number | null>): void;
    free(): void;
  }

  class Database {
    run(sql: string, params?: BindParams | Array<string | number | null>): void;
    exec(sql: string, params?: BindParams | Array<string | number | null>): QueryExecResult[];
    prepare(sql: string): Statement;
    close(): void;
  }

  interface SqlJsStatic {
    Database: typeof Database;
  }

  interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export default function initSqlJs(config?: SqlJsConfig): Promise<SqlJsStatic>;
}
