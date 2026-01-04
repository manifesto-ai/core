import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}.${Math.floor((ms % 1000) / 100)}s`;
}
export const Progress = ({ proposalCount, approvedCount, rejectedCount, eventCount, elapsed, isRunning, }) => {
    const pendingCount = proposalCount - approvedCount - rejectedCount;
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, children: [_jsxs(Box, { gap: 3, children: [_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Proposals: " }), _jsx(Text, { bold: true, children: proposalCount })] }), _jsxs(Box, { children: [_jsx(Text, { color: "green", children: "Approved: " }), _jsx(Text, { color: "green", children: approvedCount })] }), _jsxs(Box, { children: [_jsx(Text, { color: "red", children: "Rejected: " }), _jsx(Text, { color: "red", children: rejectedCount })] }), pendingCount > 0 && (_jsxs(Box, { children: [_jsx(Text, { color: "yellow", children: "Pending: " }), _jsx(Text, { color: "yellow", children: pendingCount })] }))] }), _jsxs(Box, { marginTop: 1, gap: 3, children: [_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Events: " }), _jsx(Text, { children: eventCount })] }), _jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Elapsed: " }), _jsx(Text, { color: isRunning ? "cyan" : "white", children: formatDuration(elapsed) })] })] })] }));
};
export default Progress;
//# sourceMappingURL=Progress.js.map