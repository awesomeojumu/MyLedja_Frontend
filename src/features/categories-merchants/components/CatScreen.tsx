import type { ComponentProps } from "react";
import { ScreenShell } from "@/lib";

export function CatScreen(props: ComponentProps<typeof ScreenShell>) {
  return <ScreenShell homeHref="/(tabs)/transactions/categories" {...props} />;
}
