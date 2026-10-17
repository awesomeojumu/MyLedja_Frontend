import type { ComponentProps } from "react";
import { ScreenShell } from "@/lib";

export function TxScreen(props: ComponentProps<typeof ScreenShell>) {
  return <ScreenShell homeHref="/(tabs)/transactions" {...props} />;
}
