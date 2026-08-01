"use client";

import type { EditorialProfilePresentationResult } from "@/lib/studio/editorial-profile-presentation.ts";
import { EditorialProfileStateView } from "./EditorialProfileStateView.tsx";
import { EditorialProfileView } from "./EditorialProfileView.tsx";

type Props = {
  result: EditorialProfilePresentationResult;
};

export function EditorialProfileClient({ result }: Props) {
  if (result.state !== "active_profile_available" || !result.presentation) {
    return (
      <EditorialProfileStateView
        state={result.state}
        message={result.message}
        manuscriptTitle={result.manuscriptTitle}
        versionLabel={result.versionLabel}
      />
    );
  }

  return <EditorialProfileView presentation={result.presentation} />;
}
