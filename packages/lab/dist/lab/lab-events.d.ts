/**
 * Lab Events
 *
 * Lab-specific event handling and emission.
 */
import type { LabEvent, LabEventHandler, Unsubscribe } from "../types.js";
/**
 * Lab event emitter.
 */
export interface LabEventEmitter {
    /** Subscribe to lab events */
    subscribe(handler: LabEventHandler): Unsubscribe;
    /** Emit a lab event */
    emit(event: LabEvent): void;
    /** Clear all handlers */
    clear(): void;
}
/**
 * Create a lab event emitter.
 */
export declare function createLabEventEmitter(): LabEventEmitter;
//# sourceMappingURL=lab-events.d.ts.map