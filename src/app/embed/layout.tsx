import type { ReactNode } from "react";

export default function EmbedLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="marketplace-embed-shell">{children}</div>;
}
