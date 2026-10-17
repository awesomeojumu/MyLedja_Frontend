import { useCallback } from "react";
import { WorkspaceLiveList } from "@/lib/workspace-live-list";
import { useSession } from "@/state";

export function CategoryList({ selectedId: _selectedId }: { selectedId?: string }) {
  const { session } = useSession();
  const load = useCallback(
    async (workspaceId: string) => {
      const res = await session.listCategories(workspaceId);
      return (res.data ?? []).map((row) => ({ id: row.id, name: row.name }));
    },
    [session],
  );
  return <WorkspaceLiveList load={load} empty="No categories yet" />;
}
