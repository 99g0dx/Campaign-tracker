import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

// Mock wouter useParams to provide slug
vi.mock('wouter', () => ({ useParams: () => ({ slug: 'test' }) }));

// Mock UI primitives used by SharedCampaign so test can run in jsdom
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/ui/button', () => ({ Button: ({ children, ...props }: any) => <button {...props}>{children}</button> }));
vi.mock('@/components/ui/input', () => ({ Input: (props: any) => <input {...props} /> }));
vi.mock('@/components/ui/label', () => ({ Label: ({ children }: any) => <label>{children}</label> }));
vi.mock('@/components/ui/badge', () => ({ Badge: ({ children }: any) => <span>{children}</span> }));
vi.mock('@/components/ui/checkbox', () => ({ Checkbox: ({ children, checked, onCheckedChange, ...props }: any) => (
  <input role="checkbox" type="checkbox" checked={!!checked} onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)} {...props} />
) }));
vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: any) => <table>{children}</table>,
  TableBody: ({ children }: any) => <tbody>{children}</tbody>,
  TableCell: ({ children }: any) => <td>{children}</td>,
  TableHead: ({ children }: any) => <th>{children}</th>,
  TableHeader: ({ children }: any) => <thead>{children}</thead>,
  TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
}));
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children, asChild }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
  PopoverClose: ({ children }: any) => <button>{children}</button>,
}));

import SharedCampaign from '../SharedCampaign';

const now = Date.now();
const fixture = {
  campaign: { id: 999, name: 'Test Campaign', songTitle: 'Test Song', songArtist: 'Test Artist', status: 'Active', createdAt: now },
  socialLinks: [
    { id: 1, url: 'https://tiktok.com/@alice/video/1', platform: 'tiktok', creatorName: 'Alice', postStatus: 'active', views: 1200, likes: 200, comments: 10, shares: 2, lastScrapedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
    { id: 2, url: 'https://instagram.com/p/abc', platform: 'instagram', creatorName: 'Bob', postStatus: 'done', views: 3500, likes: 400, comments: 50, shares: 5, lastScrapedAt: new Date(now - 26 * 60 * 60 * 1000).toISOString() },
    { id: 3, url: 'placeholder://123', platform: null, creatorName: null, postStatus: 'pending', views: 0, likes: 0, comments: 0, shares: 0 },
    { id: 4, url: 'https://youtube.com/watch?v=xyz', platform: 'youtube', creatorName: 'Carol', postStatus: 'pending', views: 0, likes: 0, comments: 0, shares: 0 },
    { id: 5, url: 'https://tiktok.com/@alice/video/1', platform: 'tiktok', creatorName: 'Alice D', postStatus: 'active', views: 1200, likes: 200, comments: 10, shares: 2, lastScrapedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
    { id: 6, url: 'https://tiktok.com/@dave/video/2', platform: 'tiktok', creatorName: 'Dave', postStatus: 'done', views: 8000, likes: 800, comments: 80, shares: 10, lastScrapedAt: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString() },
  ],
  engagementHistory: [],
  engagementWindows: {},
};

describe('SharedCampaign status filter (integration)', () => {
  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockImplementation((url: any) => {
      return Promise.resolve({ ok: true, json: async () => fixture } as any);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('filters posts by selected statuses and supports All/Clear', async () => {
    render(<SharedCampaign />);

    // Wait for campaign name and at least one post row
    await screen.findByText('Test Campaign');
    const aliceMatches = await screen.findAllByText('Alice');
    expect(aliceMatches.length).toBeGreaterThan(0);

    const statusButton = screen.getByTestId('button-status-filter');
    expect(statusButton).toHaveTextContent('Status: All');

    // Open popover
    fireEvent.click(statusButton);

    // Ensure checkboxes present
    const findCheckboxByLabel = (text: string) => {
      const nodes = screen.getAllByText(text);
      const node = nodes.find((n) => n.closest('label') !== null);
      if (!node) throw new Error(`Label with text ${text} not found`);
      return within(node.closest('label') as HTMLElement).getByRole('checkbox');
    };

    const pendingCheckbox = findCheckboxByLabel('Pending');
    const doneCheckbox = findCheckboxByLabel('Done');

    // Deselect Done and Active to keep only Pending & Briefed
    // Click Done
    fireEvent.click(doneCheckbox);
    // Click Active
    const activeCheckbox = findCheckboxByLabel('Active');
    fireEvent.click(activeCheckbox);

    // Close popover by clicking outside (click the status button again to toggle)
    fireEvent.click(statusButton);

    // Button should now show 'Status: 2 selected'
    await waitFor(() => expect(statusButton).toHaveTextContent('Status: 2 selected'));

    // Now table should not include 'Bob' (done) nor 'Dave' (done)
    // Since Pending posts without a lastScrapedAt are considered "not scraped", the filtered table will show no posts.

    // Confirm 'Bob' and 'Dave' are not in the document
    expect(screen.queryByText('Bob')).toBeNull();
    expect(screen.queryByText('Dave')).toBeNull();

    // The table should show the empty state message
    expect(screen.getByText('No posts match your search criteria.')).toBeTruthy();

    // Re-open popover and click Clear (which should reset to All)
    fireEvent.click(statusButton);
    const clearButton = screen.getByText('Clear');
    fireEvent.click(clearButton);

    // Popover closes; button shows 'Status: All'
    await waitFor(() => expect(statusButton).toHaveTextContent('Status: All'));

    // After clearing the status filter, ensure the filter label shows 'All' and visible posts (like 'Alice') reappear within the selected time window
    expect(statusButton).toHaveTextContent('Status: All');
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
    // 'Bob' and 'Dave' are older than the 24h window and may remain excluded depending on the selected window
    expect(screen.queryByText('Bob')).toBeNull();
    expect(screen.queryByText('Dave')).toBeNull();
  });
});
