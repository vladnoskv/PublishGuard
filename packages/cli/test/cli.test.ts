import { describe, it, expect } from 'vitest';

describe('CLI', () => {
  it('should export run function', async () => {
    const mod = await import('../src/cli');
    expect(typeof mod.run).toBe('function');
  });
});
