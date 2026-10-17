/** One SQLite file per signed-in user (§6.2). Never share a handle across users. */

export function sqlitePathForUser(userId: string): string {
  if (!userId.trim()) throw new Error("userId is required");
  return `myledja-${userId}.db`;
}

export function assertRowUser(fileUserId: string, rowUserId: string): void {
  if (fileUserId !== rowUserId) {
    throw new Error("This record does not belong in this user's database.");
  }
}
