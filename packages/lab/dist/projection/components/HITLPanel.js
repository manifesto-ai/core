import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * HITLPanel Component
 *
 * Interactive panel for Human-in-the-Loop decisions.
 * Displays pending proposals and allows approval/rejection.
 */
import { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
export const HITLPanel = ({ pending, onApprove, onReject, enabled, }) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [rejectMode, setRejectMode] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    // Reset selection when pending list changes
    useEffect(() => {
        if (selectedIndex >= pending.length) {
            setSelectedIndex(Math.max(0, pending.length - 1));
        }
    }, [pending.length, selectedIndex]);
    // Keyboard input
    useInput((input, key) => {
        if (!enabled || isProcessing || pending.length === 0)
            return;
        if (rejectMode) {
            // In reject mode, handle text input
            if (key.return) {
                // Submit rejection
                handleReject();
            }
            else if (key.escape) {
                // Cancel rejection
                setRejectMode(false);
                setRejectReason("");
            }
            else if (key.backspace || key.delete) {
                setRejectReason((prev) => prev.slice(0, -1));
            }
            else if (input && !key.ctrl && !key.meta) {
                setRejectReason((prev) => prev + input);
            }
            return;
        }
        // Navigation
        if (key.upArrow || input === "k") {
            setSelectedIndex((prev) => Math.max(0, prev - 1));
        }
        else if (key.downArrow || input === "j") {
            setSelectedIndex((prev) => Math.min(pending.length - 1, prev + 1));
        }
        // Actions
        if (input === "a" || input === "A") {
            handleApprove();
        }
        else if (input === "r" || input === "R") {
            setRejectMode(true);
        }
    }, { isActive: enabled && pending.length > 0 });
    const handleApprove = async () => {
        if (pending.length === 0)
            return;
        const proposal = pending[selectedIndex];
        if (!proposal)
            return;
        setIsProcessing(true);
        try {
            await onApprove(proposal.proposalId);
        }
        finally {
            setIsProcessing(false);
        }
    };
    const handleReject = async () => {
        if (pending.length === 0)
            return;
        const proposal = pending[selectedIndex];
        if (!proposal)
            return;
        setIsProcessing(true);
        try {
            await onReject(proposal.proposalId, rejectReason || "User rejected");
        }
        finally {
            setIsProcessing(false);
            setRejectMode(false);
            setRejectReason("");
        }
    };
    if (!enabled) {
        return null;
    }
    if (pending.length === 0) {
        return (_jsx(Box, { marginY: 1, children: _jsx(Text, { color: "gray", children: "No pending HITL decisions" }) }));
    }
    const currentProposal = pending[selectedIndex];
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, borderStyle: "round", borderColor: "yellow", paddingX: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsxs(Text, { bold: true, color: "yellow", children: ["HITL Required (", pending.length, " pending)"] }) }), _jsx(Box, { flexDirection: "column", children: pending.map((proposal, index) => (_jsxs(Box, { children: [_jsx(Text, { color: index === selectedIndex ? "yellow" : "gray", children: index === selectedIndex ? "▸ " : "  " }), _jsx(Text, { color: index === selectedIndex ? "white" : "gray", children: proposal.proposalId.slice(0, 8) }), _jsx(Text, { color: "gray", children: " - " }), _jsx(Text, { color: index === selectedIndex ? "cyan" : "gray", children: proposal.intent.body.type })] }, proposal.proposalId))) }), currentProposal && (_jsx(Box, { flexDirection: "column", marginTop: 1, children: _jsxs(Text, { color: "gray", children: ["Intent: ", JSON.stringify(currentProposal.intent.body.input, null, 2).slice(0, 100)] }) })), rejectMode ? (_jsxs(Box, { marginTop: 1, children: [_jsx(Text, { color: "red", children: "Reject reason: " }), _jsx(Text, { children: rejectReason }), _jsx(Text, { color: "gray", children: "_" })] })) : (_jsxs(Box, { marginTop: 1, gap: 2, children: [_jsx(Text, { color: "green", children: "[A] Approve" }), _jsx(Text, { color: "red", children: "[R] Reject" }), _jsx(Text, { color: "gray", children: "[\u2191\u2193] Navigate" })] })), isProcessing && (_jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "cyan", children: "Processing..." }) }))] }));
};
export default HITLPanel;
//# sourceMappingURL=HITLPanel.js.map