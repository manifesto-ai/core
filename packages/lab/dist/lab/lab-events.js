/**
 * Lab Events
 *
 * Lab-specific event handling and emission.
 */
/**
 * Create a lab event emitter.
 */
export function createLabEventEmitter() {
    const handlers = new Set();
    return {
        subscribe(handler) {
            handlers.add(handler);
            return () => {
                handlers.delete(handler);
            };
        },
        emit(event) {
            for (const handler of handlers) {
                try {
                    handler(event);
                }
                catch (error) {
                    console.error("[LabEventEmitter] Handler error:", error);
                }
            }
        },
        clear() {
            handlers.clear();
        },
    };
}
//# sourceMappingURL=lab-events.js.map