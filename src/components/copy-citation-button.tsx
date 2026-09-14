"use client";

import { CopyActionButton } from "./copy-embed-button";

type CopyCitationButtonProps = {
  assetSlug: string;
  citationText: string;
  disabled?: boolean;
  compact?: boolean;
};

export function CopyCitationButton({
  assetSlug,
  citationText,
  disabled = false,
  compact = false,
}: CopyCitationButtonProps) {
  return (
    <CopyActionButton
      action="citation"
      assetSlug={assetSlug}
      compact={compact}
      copyText={citationText}
      disabled={disabled}
    />
  );
}
