import { afterEach, describe, expect, it } from 'vitest';
import { getFrontendUrl } from './frontend-url';

describe('getFrontendUrl', () => {
  const saved = process.env.FRONTEND_URL;
  afterEach(() => {
    if (saved === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = saved;
  });

  it('takes the first of several origins', () => {
    process.env.FRONTEND_URL = 'https://app.kiddooschool.com, https://preview.example';
    expect(getFrontendUrl()).toBe('https://app.kiddooschool.com');
  });

  it('drops a trailing slash', () => {
    process.env.FRONTEND_URL = 'https://app.kiddooschool.com/';
    expect(getFrontendUrl()).toBe('https://app.kiddooschool.com');
  });

  it('falls back to the local app', () => {
    delete process.env.FRONTEND_URL;
    expect(getFrontendUrl()).toBe('http://localhost:5173');
  });
});
