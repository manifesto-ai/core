/**
 * Lab App Component
 *
 * Main Ink application for Lab projection UI.
 * Orchestrates all UI components based on projection mode.
 */

import React, { useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { LabWorld, ProjectionMode, LabStatus } from "../../types.js";
import type { Snapshot } from "@manifesto-ai/world";
import { useLab } from "../hooks/useLab.js";
import { Header } from "./Header.js";
import { Progress } from "./Progress.js";
import { Proposals } from "./Proposals.js";
import { HITLPanel } from "./HITLPanel.js";
import { SnapshotView } from "./SnapshotView.js";
import { StatusBar } from "./StatusBar.js";

export interface AppProps {
  labWorld: LabWorld;
  mode: ProjectionMode;
  snapshot?: Snapshot | null;
  onAbort?: () => void;
}

export const App: React.FC<AppProps> = ({
  labWorld,
  mode,
  snapshot = null,
  onAbort,
}) => {
  const { exit } = useApp();
  const { state, events, approve, reject } = useLab(labWorld);

  // Handle keyboard shortcuts
  useInput((input, key) => {
    // Q to abort
    if (input === "q" || input === "Q") {
      if (onAbort) {
        onAbort();
      }
      exit();
    }

    // D to toggle debug (only in interactive mode)
    // This would require mode state management in the controller
  });

  // Exit on terminal state
  useEffect(() => {
    if (state.status === "completed" || state.status === "aborted") {
      // Delay to allow final render
      const timeout = setTimeout(() => {
        exit();
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [state.status, exit]);

  // Silent mode: no output
  if (mode === "silent") {
    return null;
  }

  // Watch mode: read-only progress view
  if (mode === "watch") {
    return (
      <Box flexDirection="column">
        <Header
          runId={state.meta.runId}
          necessityLevel={state.meta.necessityLevel}
          startedAt={state.meta.startedAt}
        />
        <Progress
          proposalCount={state.proposalCount}
          approvedCount={state.approvedCount}
          rejectedCount={state.rejectedCount}
          eventCount={state.eventCount}
          elapsed={state.elapsed}
          isRunning={state.isRunning}
        />
        <Proposals events={events} />
        <StatusBar
          status={state.status}
          isSpinning={state.isRunning || state.isWaitingHITL}
        />
      </Box>
    );
  }

  // Interactive mode: progress + HITL + snapshot
  if (mode === "interactive") {
    return (
      <Box flexDirection="column">
        <Header
          runId={state.meta.runId}
          necessityLevel={state.meta.necessityLevel}
          startedAt={state.meta.startedAt}
        />
        <Progress
          proposalCount={state.proposalCount}
          approvedCount={state.approvedCount}
          rejectedCount={state.rejectedCount}
          eventCount={state.eventCount}
          elapsed={state.elapsed}
          isRunning={state.isRunning}
        />
        <SnapshotView
          snapshot={snapshot}
          enabled={snapshot !== null}
        />
        <Proposals events={events} />
        <HITLPanel
          pending={state.pendingProposals}
          onApprove={approve}
          onReject={reject}
          enabled={state.isWaitingHITL}
        />
        <StatusBar
          status={state.status}
          isSpinning={state.isRunning}
        />
        <Box marginTop={1}>
          <Text color="gray">[Q] Quit</Text>
        </Box>
      </Box>
    );
  }

  // Debug mode: full detail including snapshots
  if (mode === "debug") {
    return (
      <Box flexDirection="column">
        <Header
          runId={state.meta.runId}
          necessityLevel={state.meta.necessityLevel}
          startedAt={state.meta.startedAt}
        />
        <Progress
          proposalCount={state.proposalCount}
          approvedCount={state.approvedCount}
          rejectedCount={state.rejectedCount}
          eventCount={state.eventCount}
          elapsed={state.elapsed}
          isRunning={state.isRunning}
        />
        <Proposals events={events} />
        <HITLPanel
          pending={state.pendingProposals}
          onApprove={approve}
          onReject={reject}
          enabled={state.isWaitingHITL}
        />
        <SnapshotView
          snapshot={snapshot}
          enabled={true}
        />
        <StatusBar
          status={state.status}
          isSpinning={state.isRunning}
        />
        <Box marginTop={1} gap={2}>
          <Text color="gray">[Q] Quit</Text>
          <Text color="gray">[D] Toggle Debug</Text>
        </Box>
      </Box>
    );
  }

  // Fallback
  return (
    <Box>
      <Text color="red">Unknown projection mode: {mode}</Text>
    </Box>
  );
};

export default App;
