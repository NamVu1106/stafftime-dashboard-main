import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { persistInspectionPhoto } from './securityPhotos';

const dir = path.join(process.cwd(), 'uploads', 'security-inspection');

describe('persistInspectionPhoto', () => {
  afterEach(() => {
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.jpg')) fs.unlinkSync(path.join(dir, f));
      }
    }
  });

  it('returns null for empty', () => {
    expect(persistInspectionPhoto()).toBeNull();
  });

  it('passes through existing upload path', () => {
    const url = '/uploads/security-inspection/existing.jpg';
    expect(persistInspectionPhoto(url)).toBe(url);
  });

  it('writes base64 jpeg to disk', () => {
    const tiny =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDAREAAhEBAxEB/8QAFwABAQEBAAAAAAAAAAAAAAAAAAIDBf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==';
    const url = persistInspectionPhoto(tiny);
    expect(url).toMatch(/^\/uploads\/security-inspection\/.+\.jpg$/);
    expect(fs.existsSync(path.join(process.cwd(), url!.slice(1)))).toBe(true);
  });
});
