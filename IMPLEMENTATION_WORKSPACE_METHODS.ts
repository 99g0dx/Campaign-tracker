// Add these methods to the DatabaseStorage class in server/storage.ts
// Insert these methods at the end of the DatabaseStorage class, before the closing brace

  // ============================================================================
  // DUPLICATE DETECTION
  // ============================================================================
  async findDuplicatePosts(campaignId: number): Promise<{ postKey: string; count: number; linkIds: number[] }[]> {
    const result = await db
      .select({
        postKey: socialLinks.postKey,
      })
      .from(socialLinks)
      .where(
        and(
          eq(socialLinks.campaignId, campaignId),
          isNotNull(socialLinks.postKey)
        )
      )
      .groupBy(socialLinks.postKey);

    // For each postKey with duplicates, get all link IDs
    const duplicates: { postKey: string; count: number; linkIds: number[] }[] = [];

    for (const row of result) {
      if (!row.postKey) continue;

      const links = await db
        .select({ id: socialLinks.id })
        .from(socialLinks)
        .where(
          and(
            eq(socialLinks.campaignId, campaignId),
            eq(socialLinks.postKey, row.postKey)
          )
        );

      if (links.length > 1) {
        duplicates.push({
          postKey: row.postKey,
          count: links.length,
          linkIds: links.map(l => l.id),
        });
      }
    }

    return duplicates;
  }

  // ============================================================================
  // WORKSPACE OPERATIONS
  // ============================================================================
  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return workspace;
  }

  async getWorkspaceByOwnerId(ownerId: string): Promise<Workspace | undefined> {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.ownerId, ownerId));
    return workspace;
  }

  async createWorkspace(data: InsertWorkspace): Promise<Workspace> {
    const [workspace] = await db.insert(workspaces).values(data).returning();
    return workspace;
  }

  // ============================================================================
  // WORKSPACE MEMBERS
  // ============================================================================
  async getWorkspaceMember(workspaceId: number, userId: string): Promise<WorkspaceMember | undefined> {
    const [member] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, userId)
        )
      );
    return member;
  }

  async getWorkspaceMembers(workspaceId: number): Promise<WorkspaceMember[]> {
    return await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .orderBy(desc(workspaceMembers.createdAt));
  }

  async createWorkspaceMember(data: InsertWorkspaceMember): Promise<WorkspaceMember> {
    const [member] = await db.insert(workspaceMembers).values(data).returning();
    return member;
  }

  async removeWorkspaceMember(id: number): Promise<boolean> {
    const deleted = await db.delete(workspaceMembers).where(eq(workspaceMembers.id, id)).returning();
    return deleted.length > 0;
  }

  // ============================================================================
  // WORKSPACE INVITES
  // ============================================================================
  async getInviteByTokenHash(tokenHash: string): Promise<WorkspaceInvite | undefined> {
    const [invite] = await db
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.tokenHash, tokenHash));
    return invite;
  }

  async getWorkspaceInvites(workspaceId: number): Promise<WorkspaceInvite[]> {
    return await db
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, workspaceId),
          sql`${workspaceInvites.acceptedAt} IS NULL`
        )
      )
      .orderBy(desc(workspaceInvites.createdAt));
  }

  async createWorkspaceInvite(data: InsertWorkspaceInvite): Promise<WorkspaceInvite> {
    const [invite] = await db.insert(workspaceInvites).values(data).returning();
    return invite;
  }

  async markInviteAccepted(id: number): Promise<void> {
    await db
      .update(workspaceInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(workspaceInvites.id, id));
  }

  async deleteInvite(id: number): Promise<boolean> {
    const deleted = await db.delete(workspaceInvites).where(eq(workspaceInvites.id, id)).returning();
    return deleted.length > 0;
  }
