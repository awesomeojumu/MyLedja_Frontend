import { Banner } from "@/design";

/**
 * The one line a live screen shows when its data is not fresh. Offline keeps the last copy on screen and says so;
 * an error says what failed and offers a retry. Neither ever turns into an empty list or ₦0.
 */
export function LiveNotice({
  offline,
  error,
  hasData,
  onRetry,
}: {
  offline: boolean;
  error: string | null;
  hasData: boolean;
  onRetry?: () => void;
}) {
  if (offline) {
    return (
      <Banner tone="warning" icon="wifi-off" title="You're offline" action={onRetry ? { label: "Try again", onPress: onRetry } : undefined}>
        {hasData ? "Showing what was saved on this phone. New changes sync when you're back online." : "Nothing is saved on this phone yet. Connect to load your records."}
      </Banner>
    );
  }
  if (error) {
    return (
      <Banner tone="danger" title="Couldn't load this" action={onRetry ? { label: "Try again", onPress: onRetry } : undefined}>
        {error}
      </Banner>
    );
  }
  return null;
}
