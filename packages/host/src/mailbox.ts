/**
 * ExecutionMailbox for Host v2.0.1
 *
 * Provides single-writer serialization per ExecutionKey via a FIFO queue.
 *
 * @see host-SPEC-v2.0.1.md §10.1 Execution Mailbox
 *
 * Key requirements:
 * - MAIL-1: Host MUST maintain one mailbox per ExecutionKey
 * - MAIL-2: ExecutionKey MUST be opaque to Host
 * - MAIL-3: World/App layer determines ExecutionKey mapping policy
 * - MAIL-4: All state mutations MUST go through the mailbox
 */

import type { ExecutionKey } from "./types/execution.js";
import type { Job } from "./types/job.js";

/**
 * ExecutionMailbox interface
 *
 * @see SPEC §10.1.2 Type Definition
 */
export interface ExecutionMailbox {
  /**
   * The execution key this mailbox belongs to
   */
  readonly key: ExecutionKey;

  /**
   * Enqueue a job to the mailbox
   *
   * @param job - Job to enqueue
   */
  enqueue(job: Job): void;

  /**
   * Dequeue the next job from the mailbox
   *
   * @returns The next job, or undefined if empty
   */
  dequeue(): Job | undefined;

  /**
   * Check if the mailbox is empty
   */
  isEmpty(): boolean;

  /**
   * Get the current queue length (for debugging)
   */
  length(): number;

  /**
   * Peek at the next job without removing it (for debugging)
   */
  peek(): Job | undefined;
}

/**
 * Default ExecutionMailbox implementation using a simple array queue
 */
export class DefaultExecutionMailbox implements ExecutionMailbox {
  readonly key: ExecutionKey;
  private queue: Job[] = [];

  constructor(key: ExecutionKey) {
    this.key = key;
  }

  enqueue(job: Job): void {
    this.queue.push(job);
  }

  dequeue(): Job | undefined {
    return this.queue.shift();
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  length(): number {
    return this.queue.length;
  }

  peek(): Job | undefined {
    return this.queue[0];
  }
}

/**
 * Create a new ExecutionMailbox
 *
 * @param key - The execution key for this mailbox
 */
export function createMailbox(key: ExecutionKey): ExecutionMailbox {
  return new DefaultExecutionMailbox(key);
}

/**
 * MailboxManager for managing multiple mailboxes per ExecutionKey
 *
 * @see SPEC §10.1.1 MAIL-1
 */
export class MailboxManager {
  private mailboxes = new Map<ExecutionKey, ExecutionMailbox>();

  /**
   * Get or create a mailbox for an execution key
   *
   * @see MAIL-1: One mailbox per ExecutionKey
   */
  getOrCreate(key: ExecutionKey): ExecutionMailbox {
    let mailbox = this.mailboxes.get(key);
    if (!mailbox) {
      mailbox = createMailbox(key);
      this.mailboxes.set(key, mailbox);
    }
    return mailbox;
  }

  /**
   * Get an existing mailbox
   */
  get(key: ExecutionKey): ExecutionMailbox | undefined {
    return this.mailboxes.get(key);
  }

  /**
   * Check if a mailbox exists for an execution key
   */
  has(key: ExecutionKey): boolean {
    return this.mailboxes.has(key);
  }

  /**
   * Delete a mailbox
   */
  delete(key: ExecutionKey): boolean {
    return this.mailboxes.delete(key);
  }

  /**
   * Clear all mailboxes
   */
  clear(): void {
    this.mailboxes.clear();
  }

  /**
   * Get all execution keys
   */
  keys(): ExecutionKey[] {
    return Array.from(this.mailboxes.keys());
  }
}

/**
 * Create a MailboxManager instance
 */
export function createMailboxManager(): MailboxManager {
  return new MailboxManager();
}
