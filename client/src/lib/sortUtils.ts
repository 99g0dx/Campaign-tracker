export type SortBy = 'views' | 'likes' | 'comments' | 'shares' | 'platform' | 'status' | 'creator';

export function getComparator(sortBy: SortBy) {
  return (a: Record<string, any>, b: Record<string, any>) => {
    switch (sortBy) {
      case "views":
        return (b.views || 0) - (a.views || 0);
      case "likes":
        return (b.likes || 0) - (a.likes || 0);
      case "comments":
        return (b.comments || 0) - (a.comments || 0);
      case "shares":
        return (b.shares || 0) - (a.shares || 0);
      case "platform":
        return (a.platform || "").toString().localeCompare((b.platform || "").toString());
      case "status":
        return (a.postStatus || "").toString().localeCompare((b.postStatus || "").toString());
      case "creator":
        return (a.creatorName || "").toString().localeCompare((b.creatorName || "").toString());
      default:
        return 0;
    }
  };
}
