import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
const STATUS_LABELS = {
    running: "Running experiment...",
    waiting_hitl: "Waiting for human decision...",
    completed: "Experiment completed",
    aborted: "Experiment aborted",
};
const STATUS_COLORS = {
    running: "cyan",
    waiting_hitl: "yellow",
    completed: "green",
    aborted: "red",
};
export const StatusBar = ({ status, isSpinning, message, }) => {
    const label = message || STATUS_LABELS[status];
    const color = STATUS_COLORS[status];
    const isTerminal = status === "completed" || status === "aborted";
    const isSuccess = status === "completed";
    return (_jsxs(Box, { marginTop: 1, children: [isSpinning && !isTerminal && (_jsxs(Text, { color: color, children: [_jsx(Spinner, { type: "dots" }), " "] })), isTerminal && (_jsx(Text, { color: color, children: isSuccess ? "✓ " : "✗ " })), _jsx(Text, { color: color, children: label })] }));
};
export default StatusBar;
//# sourceMappingURL=StatusBar.js.map