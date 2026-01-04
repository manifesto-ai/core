import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Box, Text } from "ink";
// =============================================================================
// BabyAI Grid Renderer
// =============================================================================
// Direction arrows: 0=East, 1=South, 2=West, 3=North
const DIRECTION_ARROWS = ["→", "↓", "←", "↑"];
const COLOR_MAP = {
    red: "red",
    green: "green",
    blue: "blue",
    yellow: "yellow",
    purple: "magenta",
    grey: "gray",
    gray: "gray",
};
function isBabyAIState(data) {
    if (!data || typeof data !== "object")
        return false;
    const obj = data;
    return ("grid" in obj &&
        "agent" in obj &&
        "objects" in obj &&
        "mission" in obj &&
        typeof obj.grid === "object" &&
        obj.grid !== null &&
        "width" in obj.grid &&
        "height" in obj.grid);
}
const BabyAIGridView = ({ state }) => {
    const { grid, agent, objects, mission, steps, maxSteps } = state;
    // Build object lookup map
    const objectMap = new Map();
    for (const obj of objects) {
        objectMap.set(`${obj.x},${obj.y}`, obj);
    }
    // Render grid rows
    const rows = [];
    for (let y = 0; y < grid.height; y++) {
        const cells = [];
        for (let x = 0; x < grid.width; x++) {
            const cellType = grid.cells[y]?.[x] ?? "empty";
            const obj = objectMap.get(`${x},${y}`);
            const isAgent = agent.x === x && agent.y === y;
            let char = " ";
            let color = "gray";
            if (isAgent) {
                char = DIRECTION_ARROWS[agent.direction] ?? "?";
                color = "cyan";
            }
            else if (obj) {
                switch (obj.type) {
                    case "key":
                        char = "♦";
                        color = COLOR_MAP[obj.color] ?? "white";
                        break;
                    case "ball":
                        char = "●";
                        color = COLOR_MAP[obj.color] ?? "white";
                        break;
                    case "box":
                        char = "□";
                        color = COLOR_MAP[obj.color] ?? "white";
                        break;
                    case "door":
                        char = obj.isOpen ? "▯" : "▮";
                        color = COLOR_MAP[obj.color] ?? "white";
                        break;
                    default:
                        char = "?";
                }
            }
            else if (cellType === "wall") {
                char = "█";
                color = "gray";
            }
            else if (cellType === "floor") {
                char = "·";
                color = "blackBright";
            }
            cells.push(_jsx(Text, { color: color, children: char }, x));
        }
        rows.push(_jsx(Box, { children: cells }, y));
    }
    return (_jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, children: [_jsxs(Box, { marginBottom: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "BabyAI World" }), _jsxs(Text, { color: "gray", children: [" (Step ", steps, "/", maxSteps, ")"] })] }), _jsx(Box, { flexDirection: "column", children: rows }), _jsxs(Box, { marginTop: 1, gap: 2, children: [_jsxs(Text, { color: "cyan", children: [DIRECTION_ARROWS[agent.direction], " Agent"] }), _jsx(Text, { color: "gray", children: "\u2588 Wall" }), _jsx(Text, { color: "yellow", children: "\u2666 Key" }), _jsx(Text, { color: "green", children: "\u25AE Door" })] }), _jsxs(Box, { marginTop: 1, children: [_jsx(Text, { bold: true, children: "Mission: " }), _jsx(Text, { color: "yellow", children: mission })] }), agent.carrying && (_jsxs(Box, { children: [_jsx(Text, { color: "gray", children: "Carrying: " }), _jsxs(Text, { color: COLOR_MAP[agent.carrying.color] ?? "white", children: [agent.carrying.type, " (", agent.carrying.color, ")"] })] }))] }));
};
// =============================================================================
// Generic JSON Renderer (for debug mode)
// =============================================================================
const MAX_DISPLAY_DEPTH = 3;
const MAX_STRING_LENGTH = 50;
const MAX_ARRAY_ITEMS = 5;
function truncateString(str, maxLength) {
    if (str.length <= maxLength)
        return str;
    return str.slice(0, maxLength - 3) + "...";
}
function renderValue(value, depth = 0) {
    if (depth > MAX_DISPLAY_DEPTH) {
        return _jsx(Text, { color: "gray", children: "..." });
    }
    if (value === null)
        return _jsx(Text, { color: "magenta", children: "null" });
    if (value === undefined)
        return _jsx(Text, { color: "gray", children: "undefined" });
    if (typeof value === "string")
        return _jsxs(Text, { color: "green", children: ["\"", truncateString(value, MAX_STRING_LENGTH), "\""] });
    if (typeof value === "number")
        return _jsx(Text, { color: "yellow", children: value });
    if (typeof value === "boolean")
        return _jsx(Text, { color: "cyan", children: value.toString() });
    if (Array.isArray(value)) {
        if (value.length === 0)
            return _jsx(Text, { color: "gray", children: "[]" });
        const displayItems = value.slice(0, MAX_ARRAY_ITEMS);
        const remaining = value.length - MAX_ARRAY_ITEMS;
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "gray", children: "[" }), displayItems.map((item, index) => (_jsxs(Box, { marginLeft: 2, children: [renderValue(item, depth + 1), index < displayItems.length - 1 && _jsx(Text, { color: "gray", children: "," })] }, index))), remaining > 0 && _jsx(Box, { marginLeft: 2, children: _jsxs(Text, { color: "gray", children: ["...", remaining, " more"] }) }), _jsx(Text, { color: "gray", children: "]" })] }));
    }
    if (typeof value === "object") {
        const entries = Object.entries(value);
        if (entries.length === 0)
            return _jsx(Text, { color: "gray", children: "{}" });
        const displayEntries = entries.slice(0, MAX_ARRAY_ITEMS);
        const remaining = entries.length - MAX_ARRAY_ITEMS;
        return (_jsxs(Box, { flexDirection: "column", children: [_jsx(Text, { color: "gray", children: "{" }), displayEntries.map(([key, val], index) => (_jsxs(Box, { marginLeft: 2, children: [_jsx(Text, { color: "blue", children: key }), _jsx(Text, { color: "gray", children: ": " }), renderValue(val, depth + 1), index < displayEntries.length - 1 && _jsx(Text, { color: "gray", children: "," })] }, key))), remaining > 0 && _jsx(Box, { marginLeft: 2, children: _jsxs(Text, { color: "gray", children: ["...", remaining, " more"] }) }), _jsx(Text, { color: "gray", children: "}" })] }));
    }
    return _jsx(Text, { color: "gray", children: String(value) });
}
// =============================================================================
// Main Component
// =============================================================================
export const SnapshotView = ({ snapshot, enabled, mode = "auto", }) => {
    if (!enabled || !snapshot) {
        return null;
    }
    // Auto-detect BabyAI state and render as grid
    if (mode === "auto" || mode === "grid") {
        if (isBabyAIState(snapshot.data)) {
            return _jsx(BabyAIGridView, { state: snapshot.data });
        }
    }
    // JSON mode or non-BabyAI state
    return (_jsxs(Box, { flexDirection: "column", marginY: 1, borderStyle: "single", borderColor: "gray", paddingX: 1, children: [_jsx(Box, { marginBottom: 1, children: _jsx(Text, { bold: true, color: "gray", children: "Snapshot (Debug)" }) }), _jsx(Box, { marginLeft: 2, children: renderValue(snapshot.data, 0) })] }));
};
export default SnapshotView;
//# sourceMappingURL=SnapshotView.js.map