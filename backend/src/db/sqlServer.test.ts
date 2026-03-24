import { describe, it, expect } from 'vitest';
import { parseDatabaseUrl, buildAdoConnectionString } from './sqlServer';

describe('parseDatabaseUrl', () => {
  it('throws if not sqlserver://', () => {
    expect(() => parseDatabaseUrl('postgres://x')).toThrow(/sqlserver/);
    expect(() => parseDatabaseUrl('')).toThrow();
  });

  it('parses host and options', () => {
    const c = parseDatabaseUrl(
      'sqlserver://myhost;database=MyDb;user=u;password=p;encrypt=true;trustservercertificate=true'
    );
    expect(c.server).toBe('myhost');
    expect(c.database).toBe('MyDb');
    expect(c.user).toBe('u');
    expect(c.password).toBe('p');
    expect(c.options?.encrypt).toBe(true);
    expect(c.options?.trustServerCertificate).toBe(true);
  });

  it('parses host:port', () => {
    const c = parseDatabaseUrl('sqlserver://srv:1433;database=db;user=u;password=p');
    expect(c.server).toBe('srv');
    expect(c.port).toBe(1433);
    expect(c.database).toBe('db');
  });
});

describe('buildAdoConnectionString', () => {
  it('includes Data Source, Initial Catalog, User ID', () => {
    const s = buildAdoConnectionString(
      'sqlserver://localhost;database=testdb;user=sa;password=secret;encrypt=false;trustservercertificate=true'
    );
    expect(s).toContain('Data Source=localhost');
    expect(s).toContain('Initial Catalog=testdb');
    expect(s).toContain('User ID=sa');
    expect(s).toContain('Password=');
    expect(s).toContain('Request Timeout=');
  });

  it('wraps password containing = in ADO braces', () => {
    const s = buildAdoConnectionString(
      'sqlserver://localhost;database=db;user=u;password=ab=cd;encrypt=false;trustservercertificate=true'
    );
    expect(s).toContain('Password={ab=cd}');
  });
});
