/**
 * Event Domain Example
 *
 * This example demonstrates the @manifesto-ai/builder package features:
 * - Defining a domain with Zod schema
 * - Type-safe state accessor (no string paths)
 * - Named computed values for explainability
 * - Actions with availability conditions
 * - Re-entry safe flow patterns (onceNull, guard)
 * - Intent creation for Bridge integration
 */

import { z } from "zod";
import { defineDomain, setupDomain } from "../src/index.js";
import { guard, onceNull } from "../src/flow/helpers.js";

// ============ 1. Define State Schema ============

const EventSchema = z.object({
  /** Unique event identifier */
  id: z.string(),

  /** Event title */
  title: z.string(),

  /** Current status */
  status: z.enum(["draft", "pending", "received", "processing", "completed", "cancelled"]),

  /** When the event was received (null if not yet received) */
  receivedAt: z.number().nullable(),

  /** When processing started (null if not yet started) */
  processingStartedAt: z.number().nullable(),

  /** When the event was completed (null if not yet completed) */
  completedAt: z.number().nullable(),

  /** Assigned processor ID (null if not assigned) */
  assignedTo: z.string().nullable(),

  /** Processing notes */
  notes: z.string(),

  /** Priority level */
  priority: z.enum(["low", "medium", "high", "urgent"]),

  /** Retry count for failed processing */
  retryCount: z.number(),
});

// Infer the TypeScript type from the schema
type EventState = z.infer<typeof EventSchema>;

// ============ 2. Define Domain ============

export const EventDomain = defineDomain(
  EventSchema,
  ({ state, computed, actions, expr, flow }) => {
    // -------- Computed Values (Named Facts) --------
    // Per FDR-B002: Computed values are named for explainability

    const { isDraft, isPending, isReceived, isProcessing, isCompleted, isCancelled } =
      computed.define({
        isDraft: expr.eq(state.status, "draft"),
        isPending: expr.eq(state.status, "pending"),
        isReceived: expr.eq(state.status, "received"),
        isProcessing: expr.eq(state.status, "processing"),
        isCompleted: expr.eq(state.status, "completed"),
        isCancelled: expr.eq(state.status, "cancelled"),
      });

    const { canSubmit, canReceive, canStartProcessing, canComplete, canCancel, canRetry } =
      computed.define({
        // Can submit: only if draft
        canSubmit: isDraft,

        // Can receive: pending and not yet received
        canReceive: expr.and(isPending, expr.isNull(state.receivedAt)),

        // Can start processing: received, not processing, and has assignee
        canStartProcessing: expr.and(
          isReceived,
          expr.isNotNull(state.assignedTo),
          expr.isNull(state.processingStartedAt)
        ),

        // Can complete: currently processing
        canComplete: isProcessing,

        // Can cancel: not completed and not already cancelled
        canCancel: expr.and(expr.not(isCompleted), expr.not(isCancelled)),

        // Can retry: failed (cancelled) with retry count < 3
        canRetry: expr.and(isCancelled, expr.lt(state.retryCount, 3)),
      });

    const { isHighPriority, requiresUrgentAttention } = computed.define({
      isHighPriority: expr.or(
        expr.eq(state.priority, "high"),
        expr.eq(state.priority, "urgent")
      ),
      requiresUrgentAttention: {
        expr: expr.and(
          expr.eq(state.priority, "urgent"),
          expr.not(isProcessing),
          expr.not(isCompleted)
        ),
        description: "Event is urgent and not yet being processed",
      },
    });

    // -------- Actions --------

    const { submit, receive, assign, startProcessing, complete, cancel, retry, updateNotes } =
      actions.define({
        /**
         * Submit the draft event for processing
         */
        submit: {
          description: "Submit the draft event for processing",
          available: canSubmit,
          flow: flow.patch(state.status).set(expr.lit("pending")),
        },

        /**
         * Receive the event (mark as received)
         */
        receive: {
          description: "Mark the event as received",
          input: z.object({
            timestamp: z.number(),
          }),
          available: canReceive,
          // Per FDR-B004: Use onceNull for re-entry safety
          flow: onceNull(state.receivedAt, ({ patch }) => {
            patch(state.receivedAt).set(expr.input<number>("timestamp"));
            patch(state.status).set(expr.lit("received"));
          }),
        },

        /**
         * Assign the event to a processor
         */
        assign: {
          description: "Assign the event to a processor",
          input: z.object({
            processorId: z.string(),
          }),
          available: expr.and(
            expr.or(isPending, isReceived),
            expr.not(isProcessing)
          ),
          flow: flow.patch(state.assignedTo).set(expr.input<string>("processorId")),
        },

        /**
         * Start processing the event
         */
        startProcessing: {
          description: "Begin processing the event",
          input: z.object({
            timestamp: z.number(),
          }),
          available: canStartProcessing,
          flow: onceNull(state.processingStartedAt, ({ patch }) => {
            patch(state.processingStartedAt).set(expr.input<number>("timestamp"));
            patch(state.status).set(expr.lit("processing"));
          }),
        },

        /**
         * Complete the event processing
         */
        complete: {
          description: "Mark the event as completed",
          input: z.object({
            timestamp: z.number(),
            notes: z.string().optional(),
          }),
          available: canComplete,
          flow: onceNull(state.completedAt, ({ patch }) => {
            patch(state.completedAt).set(expr.input<number>("timestamp"));
            patch(state.status).set(expr.lit("completed"));
          }),
        },

        /**
         * Cancel the event
         */
        cancel: {
          description: "Cancel the event",
          input: z.object({
            reason: z.string(),
          }),
          available: canCancel,
          // Per FDR-B004: Use guard for re-entry safety
          flow: guard(expr.neq(state.status, "cancelled"), ({ patch }) => {
            patch(state.status).set(expr.lit("cancelled"));
            patch(state.notes).set(
              expr.concat(state.notes, expr.lit("\n[Cancelled] "), expr.input<string>("reason"))
            );
          }),
        },

        /**
         * Retry a cancelled event
         */
        retry: {
          description: "Retry a cancelled event",
          available: canRetry,
          flow: flow.seq(
            flow.patch(state.status).set(expr.lit("pending")),
            flow.patch(state.retryCount).set(expr.add(state.retryCount, 1)),
            // Simply pass null directly - set() accepts raw values
            flow.patch(state.receivedAt).set(null),
            flow.patch(state.processingStartedAt).set(null),
            flow.patch(state.completedAt).set(null)
          ),
        },

        /**
         * Update processing notes
         */
        updateNotes: {
          description: "Update the processing notes",
          input: z.object({
            notes: z.string(),
          }),
          // Always available unless completed or cancelled
          available: expr.and(expr.not(isCompleted), expr.not(isCancelled)),
          flow: flow.patch(state.notes).set(expr.input<string>("notes")),
        },
      });

    // Return the domain output
    return {
      computed: {
        isDraft,
        isPending,
        isReceived,
        isProcessing,
        isCompleted,
        isCancelled,
        canSubmit,
        canReceive,
        canStartProcessing,
        canComplete,
        canCancel,
        canRetry,
        isHighPriority,
        requiresUrgentAttention,
      },
      actions: {
        submit,
        receive,
        assign,
        startProcessing,
        complete,
        cancel,
        retry,
        updateNotes,
      },
    };
  },
  {
    id: "event:v1",
    version: "1.0.0",
    meta: {
      name: "Event Domain",
      description: "Domain for managing event lifecycle",
    },
  }
);

// ============ 3. Setup & Validate Domain ============

const { schema, schemaHash, diagnostics } = setupDomain(EventDomain);

if (!diagnostics.valid) {
  console.error("Domain validation failed:");
  diagnostics.errors.forEach((e) => {
    console.error(`  [${e.code}] ${e.message}${e.path ? ` at ${e.path}` : ""}`);
  });
  process.exit(1);
}

console.log("Event Domain validated successfully!");
console.log(`  ID: ${schema.id}`);
console.log(`  Version: ${schema.version}`);
console.log(`  Hash: ${schemaHash}`);
console.log(`  Computed fields: ${Object.keys(schema.computed.fields).length}`);
console.log(`  Actions: ${Object.keys(schema.actions).length}`);

// ============ 4. Usage Examples ============

// 4.1 Access state fields (type-safe, no string paths)
console.log("\n--- State Accessor ---");
console.log(`state.status path: ${EventDomain.state.status.path}`);
console.log(`state.receivedAt path: ${EventDomain.state.receivedAt.path}`);
console.log(`state.priority path: ${EventDomain.state.priority.path}`);

// 4.2 Access computed refs
console.log("\n--- Computed Refs ---");
console.log(`canSubmit path: ${EventDomain.computed.canSubmit.path}`);
console.log(`isHighPriority path: ${EventDomain.computed.isHighPriority.path}`);

// 4.3 Create intents (for Bridge integration)
console.log("\n--- Intent Creation ---");

// Submit intent (no input required)
const submitIntent = EventDomain.actions.submit.intent();
console.log("Submit intent:", JSON.stringify(submitIntent, null, 2));

// Receive intent (with timestamp input)
const receiveIntent = EventDomain.actions.receive.intent({
  timestamp: Date.now(),
});
console.log("Receive intent:", JSON.stringify(receiveIntent, null, 2));

// Assign intent
const assignIntent = EventDomain.actions.assign.intent({
  processorId: "processor-123",
});
console.log("Assign intent:", JSON.stringify(assignIntent, null, 2));

// Cancel intent
const cancelIntent = EventDomain.actions.cancel.intent({
  reason: "No longer needed",
});
console.log("Cancel intent:", JSON.stringify(cancelIntent, null, 2));

// ============ 5. Schema IR Output ============

console.log("\n--- Schema IR (partial) ---");
console.log("Actions available:");
Object.entries(schema.actions).forEach(([name, spec]) => {
  console.log(`  ${name}: ${spec.description ?? "(no description)"}`);
});

console.log("\nComputed fields:");
Object.entries(schema.computed.fields).forEach(([name, spec]) => {
  console.log(`  ${name}: deps=[${spec.deps.join(", ")}]`);
});
