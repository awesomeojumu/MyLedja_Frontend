import { useCallback, useRef } from "react";
import type { ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";

/**
 * Every time a screen comes back into view it starts at the top, instead of wherever it was left scrolled.
 * Attach the returned ref to the screen's main ScrollView.
 */
export function useScrollTopOnFocus() {
  const ref = useRef<ScrollView>(null);
  useFocusEffect(
    useCallback(() => {
      ref.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );
  return ref;
}
