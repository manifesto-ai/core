import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Lab App Component
 *
 * Main Ink application for Lab projection UI.
 * Orchestrates all UI components based on projection mode.
 */
import { useEffect } from "react";
import { Box, Text, useApp, useInput } from "ink";
import { useLab } from "../hooks/useLab.js";
import { Header } from "./Header.js";
import { Progress } from "./Progress.js";
import { Proposals } from "./Proposals.js";
import { HITLPanel } from "./HITLPanel.js";
import { SnapshotView } from "./SnapshotView.js";
import { StatusBar } from "./StatusBar.js";
export const App = ({ labWorld, mode, snapshot = null, onAbort, }) => {
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
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Header, { runId: state.meta.runId, necessityLevel: state.meta.necessityLevel, startedAt: state.meta.startedAt }), _jsx(Progress, { proposalCount: state.proposalCount, approvedCount: state.approvedCount, rejectedCount: state.rejectedCount, eventCount: state.eventCount, elapsed: state.elapsed, isRunning: state.isRunning }), _jsx(Proposals, { events: events }), _jsx(StatusBar, { status: state.status, isSpinning: state.isRunning || state.isWaitingHITL })] }));
    }
    // Interactive mode: progress + HITL + snapshot
    if (mode === "interactive") {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Header, { runId: state.meta.runId, necessityLevel: state.meta.necessityLevel, startedAt: state.meta.startedAt }), _jsx(Progress, { proposalCount: state.proposalCount, approvedCount: state.approvedCount, rejectedCount: state.rejectedCount, eventCount: state.eventCount, elapsed: state.elapsed, isRunning: state.isRunning }), _jsx(SnapshotView, { snapshot: snapshot, enabled: snapshot !== null }), _jsx(Proposals, { events: events }), _jsx(HITLPanel, { pending: state.pendingProposals, onApprove: approve, onReject: reject, enabled: state.isWaitingHITL }), _jsx(StatusBar, { status: state.status, isSpinning: state.isRunning }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", children: "[Q] Quit" }) })] }));
    }
    // Debug mode: full detail including snapshots
    if (mode === "debug") {
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Header, { runId: state.meta.runId, necessityLevel: state.meta.necessityLevel, startedAt: state.meta.startedAt }), _jsx(Progress, { proposalCount: state.proposalCount, approvedCount: state.approvedCount, rejectedCount: state.rejectedCount, eventCount: state.eventCount, elapsed: state.elapsed, isRunning: state.isRunning }), _jsx(Proposals, { events: events }), _jsx(HITLPanel, { pending: state.pendingProposals, onApprove: approve, onReject: reject, enabled: state.isWaitingHITL }), _jsx(SnapshotView, { snapshot: snapshot, enabled: true }), _jsx(StatusBar, { status: state.status, isSpinning: state.isRunning }), _jsxs(Box, { marginTop: 1, gap: 2, children: [_jsx(Text, { color: "gray", children: "[Q] Quit" }), _jsx(Text, { color: "gray", children: "[D] Toggle Debug" })] })] }));
    }
    // Fallback
    return (_jsx(Box, { children: _jsxs(Text, { color: "red", children: ["Unknown projection mode: ", mode] }) }));
};
export default App;
//# sourceMappingURL=App.js.map