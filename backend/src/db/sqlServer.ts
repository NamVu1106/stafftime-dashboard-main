import * as sql from 'mssql';

/** Ép timeout mọi kết nối Tedious (dù chuỗi ADO bị cắt do mật khẩu có `;`). */
function patchTediousRequestTimeout(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const tedious = require('tedious') as { Connection?: { prototype: { connect: (...a: unknown[]) => void } } };
    const Conn = tedious.Connection;
    if (!Conn?.prototype?.connect || (Conn.prototype as { __stRt?: boolean }).__stRt) return;
    const orig = Conn.prototype.connect;
    Conn.prototype.connect = function (this: { config?: { options?: { requestTimeout?: number } } }, listener: unknown) {
      const raw = parseInt(process.env.SQL_REQUEST_TIMEOUT_MS || '600000', 10);
      const ms = Number.isFinite(raw) && raw >= 5000 ? raw : 600000;
      if (this.config?.options) this.config.options.requestTimeout = ms;
      return orig.call(this, listener);
    };
    (Conn.prototype as { __stRt?: boolean }).__stRt = true;
  } catch {
    /* ignore */
  }
}

patchTediousRequestTimeout();

let pool: sql.ConnectionPool | undefined;

function getRequestTimeoutMs(): number {
  const raw = parseInt(process.env.SQL_REQUEST_TIMEOUT_MS || '600000', 10);
  return Number.isFinite(raw) && raw >= 5000 ? raw : 600000;
}

export function parseDatabaseUrl(url: string): sql.config {
  if (!url || !url.startsWith('sqlserver://')) {
    throw new Error('DATABASE_URL bắt buộc dạng sqlserver://...');
  }
  const rest = url.slice('sqlserver://'.length);
  const firstSemi = rest.indexOf(';');
  const serverPart = firstSemi >= 0 ? rest.slice(0, firstSemi) : rest;
  const opts: Record<string, string> = {};
  if (firstSemi >= 0) {
    rest
      .slice(firstSemi + 1)
      .split(';')
      .forEach((pair) => {
        const eq = pair.indexOf('=');
        if (eq > 0) opts[pair.slice(0, eq).trim().toLowerCase()] = pair.slice(eq + 1).trim();
      });
  }
  let server = serverPart;
  let port: number | undefined;
  if (!serverPart.includes('\\') && serverPart.includes(':')) {
    const idx = serverPart.lastIndexOf(':');
    server = serverPart.slice(0, idx);
    port = parseInt(serverPart.slice(idx + 1), 10);
  }
  const requestTimeoutMs = getRequestTimeoutMs();

  return {
    server,
    port,
    database: opts.database || 'master',
    user: opts.user,
    password: opts.password,
    options: {
      encrypt: opts.encrypt === 'true',
      trustServerCertificate: opts.trustservercertificate === 'true',
      enableArithAbort: true,
      requestTimeout: requestTimeoutMs,
    },
    pool: { max: 20, min: 0, idleTimeoutMillis: 30000 },
    requestTimeout: requestTimeoutMs,
  };
}

/** Giá trị ADO: nếu có ; = { } hoặc khoảng trắng đầu/cuối → bọc {…}, } trong chuỗi → }} */
function adoToken(v: string | undefined): string {
  if (v == null || v === '') return '';
  const s = String(v);
  const needBrace = /[;=]/.test(s) || /^\s|\s$/.test(s) || /[\x00-\x1f]/.test(s);
  if (!needBrace) return s;
  return '{' + s.replace(/\}/g, '}}') + '}';
}

/**
 * Request Timeout đặt TRƯỚC User/Password — nếu mật khẩu có `;` mà không bọc {}, phần sau Password
 * sẽ mất và driver giữ 15s. adoToken bọc mật khẩu phức tạp.
 */
export function buildAdoConnectionString(databaseUrl: string): string {
  const c = parseDatabaseUrl(databaseUrl);
  const t = c.options!.requestTimeout!;
  const server =
    c.port && !String(c.server).includes('\\') ? `${String(c.server).replace(/'/g, "''")},${c.port}` : String(c.server).replace(/'/g, "''");
  const db = (c.database ?? 'master').replace(/'/g, "''");
  const user = adoToken(c.user);
  const pass = adoToken(c.password);
  return [
    `Data Source=${server}`,
    `Initial Catalog=${db}`,
    `Request Timeout=${t}`,
    `Connect Timeout=60`,
    `Encrypt=${c.options!.encrypt ? 'true' : 'false'}`,
    `TrustServerCertificate=${c.options!.trustServerCertificate ? 'true' : 'false'}`,
    `User ID=${user}`,
    `Password=${pass}`,
    `Max Pool Size=20`,
  ].join(';');
}

async function closeGlobalMssql(): Promise<void> {
  try {
    await (sql as unknown as { close: () => Promise<void> }).close();
  } catch {
    /* ignore */
  }
}

export async function connectDb(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL trong .env');
  if (pool?.connected) return;

  if (pool) {
    try {
      await pool.close();
    } catch {
      /* ignore */
    }
    pool = undefined;
  }
  await closeGlobalMssql();

  const ado = buildAdoConnectionString(url);
  const p = new sql.ConnectionPool(ado);
  await p.connect();
  pool = p;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    try {
      await pool.close();
    } catch {
      /* ignore */
    }
    pool = undefined;
  }
  await closeGlobalMssql();
}

function bindParams(req: sql.Request, params: Record<string, unknown>): void {
  for (const [key, v] of Object.entries(params)) {
    if (v === null || v === undefined) {
      req.input(key, sql.NVarChar(sql.MAX), null);
    } else if (typeof v === 'number' && Number.isInteger(v)) {
      req.input(key, sql.Int, v);
    } else if (typeof v === 'number') {
      req.input(key, sql.Float, v);
    } else if (typeof v === 'boolean') {
      req.input(key, sql.Bit, v);
    } else if (typeof v === 'string' && v.length > 4000) {
      req.input(key, sql.NVarChar(sql.MAX), v);
    } else {
      req.input(key, sql.NVarChar(4000), String(v));
    }
  }
}

/** Mặc định `any` để hàng SQL không bị suy ra unknown (statistics, upload, …) */
export async function query<T = any>(text: string, params: Record<string, unknown> = {}): Promise<T[]> {
  if (!pool?.connected) await connectDb();
  const req = pool!.request();
  bindParams(req, params);
  const result = await req.query(text);
  return (result.recordset || []) as T[];
}

export async function queryOne<T = any>(
  text: string,
  params: Record<string, unknown> = {}
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function exec(text: string, params: Record<string, unknown> = {}): Promise<number> {
  if (!pool?.connected) await connectDb();
  const req = pool!.request();
  bindParams(req, params);
  const result = await req.query(text);
  return result.rowsAffected?.[0] ?? 0;
}

/** Chạy nhiều lệnh trong một transaction */
export async function transaction<T>(fn: (run: typeof query, runExec: typeof exec) => Promise<T>): Promise<T> {
  if (!pool?.connected) await connectDb();
  const t = new sql.Transaction(pool!);
  await t.begin();
  const run = async <R = any>(
    text: string,
    params: Record<string, unknown> = {}
  ): Promise<R[]> => {
    const req = new sql.Request(t);
    bindParams(req, params);
    const result = await req.query(text);
    return (result.recordset || []) as R[];
  };
  const runExec = async (text: string, params: Record<string, unknown> = {}): Promise<number> => {
    const req = new sql.Request(t);
    bindParams(req, params);
    const result = await req.query(text);
    return result.rowsAffected?.[0] ?? 0;
  };
  try {
    const out = await fn(run, runExec);
    await t.commit();
    return out;
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

export { sql };
