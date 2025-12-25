"use client";

import { StudioRuntimeProvider } from "@/runtime";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return <StudioRuntimeProvider>{children}</StudioRuntimeProvider>;
}
