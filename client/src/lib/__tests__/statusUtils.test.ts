import { describe, it, expect } from 'vitest';
import { canonicalStatus } from '../postUtils';

describe('canonicalStatus', () => {
  it('normalizes various inputs', () => {
    expect(canonicalStatus('pending')).toBe('Pending');
    expect(canonicalStatus('PENDING')).toBe('Pending');
    expect(canonicalStatus('  active ')).toBe('Active');
    expect(canonicalStatus(null)).toBe('Pending');
    expect(canonicalStatus('weird')).toBe('Pending');
  });
});
