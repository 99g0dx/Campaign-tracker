import { describe, it, expect } from 'vitest';
import { getComparator } from '../sortUtils';

const posts = [
  { id: 1, platform: 'tiktok', postStatus: 'active', creatorName: 'Zed', views: 100 },
  { id: 2, platform: 'instagram', postStatus: 'done', creatorName: 'Amy', views: 200 },
  { id: 3, platform: 'youtube', postStatus: 'pending', creatorName: 'Bob', views: 50 },
];

describe('sortUtils comparator', () => {
  it('sorts by views desc', () => {
    const arr = [...posts].sort(getComparator('views'));
    expect(arr.map(p => p.id)).toEqual([2,1,3]);
  });

  it('sorts by platform A-Z', () => {
    const arr = [...posts].sort(getComparator('platform'));
    expect(arr.map(p => p.platform)).toEqual(['instagram','tiktok','youtube']);
  });

  it('sorts by status A-Z', () => {
    const arr = [...posts].sort(getComparator('status'));
    expect(arr.map(p => p.postStatus)).toEqual(['active','done','pending']);
  });

  it('sorts by creator A-Z', () => {
    const arr = [...posts].sort(getComparator('creator'));
    expect(arr.map(p => p.creatorName)).toEqual(['Amy','Bob','Zed']);
  });
});
