import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Box, Text } from "ink";
const LEVEL_LABELS = {
    0: "L0: Deterministic",
    1: "L1: Partial Observation",
    2: "L2: Open-Ended Rules",
    3: "L3: Natural Language",
};
const LEVEL_COLORS = {
    0: "green",
    1: "yellow",
    2: "magenta",
    3: "red",
};
export const Header = ({ runId, necessityLevel, startedAt, }) => {
    const startTime = new Date(startedAt).toLocaleTimeString();
    return (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Box, { children: [_jsxs(Text, { bold: true, color: "cyan", children: ["manifesto-lab", " "] }), _jsx(Text, { color: "gray", children: "v1.0" })] }), _jsxs(Box, { marginTop: 1, gap: 2, children: [_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Run: " }), _jsx(Text, { bold: true, children: runId })] }), _jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Level: " }), _jsx(Text, { color: LEVEL_COLORS[necessityLevel], children: LEVEL_LABELS[necessityLevel] })] }), _jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Started: " }), _jsx(Text, { children: startTime })] })] })] }));
};
export default Header;
//# sourceMappingURL=Header.js.map