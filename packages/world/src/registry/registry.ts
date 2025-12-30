/**
 * Actor Registry
 *
 * Manages Actor registrations and Actor-Authority bindings.
 *
 * Invariants enforced:
 * - INV-A1: Every registered Actor has exactly one Authority binding
 * - B-1: Every registered Actor MUST have exactly one Binding
 * - B-2: Bindings MUST be established before Actor can submit Proposals
 * - B-4: Proposals from unbound Actors MUST be rejected at submission
 * - B-5: Multiple Actors MAY share the same Authority
 */
import type { ActorRef } from "../schema/actor.js";
import type { ActorAuthorityBinding, AuthorityPolicy } from "../schema/binding.js";
import type { AuthorityRef } from "../schema/authority.js";
import {
  actorNotRegistered,
  actorAlreadyRegistered,
  unboundActor,
} from "../errors.js";

/**
 * ActorRegistry - manages Actor registrations and bindings
 */
export class ActorRegistry {
  private actors: Map<string, ActorRef> = new Map();
  private bindings: Map<string, ActorAuthorityBinding> = new Map();

  /**
   * Register an actor with its authority binding (INV-A1)
   *
   * @param actor - The actor to register
   * @param authority - The authority that will judge this actor's proposals
   * @param policy - The policy used for judgment
   * @throws WorldError if actor is already registered
   */
  register(
    actor: ActorRef,
    authority: AuthorityRef,
    policy: AuthorityPolicy
  ): void {
    if (this.actors.has(actor.actorId)) {
      throw actorAlreadyRegistered(actor.actorId);
    }

    this.actors.set(actor.actorId, actor);
    this.bindings.set(actor.actorId, {
      actor,
      authority,
      policy,
    });
  }

  /**
   * Unregister an actor
   *
   * @param actorId - The ID of the actor to unregister
   * @returns true if the actor was unregistered, false if not found
   */
  unregister(actorId: string): boolean {
    if (!this.actors.has(actorId)) {
      return false;
    }

    this.actors.delete(actorId);
    this.bindings.delete(actorId);
    return true;
  }

  /**
   * Get an actor by ID
   *
   * @param actorId - The ID of the actor
   * @returns The actor or undefined if not found
   */
  getActor(actorId: string): ActorRef | undefined {
    return this.actors.get(actorId);
  }

  /**
   * Get an actor by ID, throwing if not found
   *
   * @param actorId - The ID of the actor
   * @returns The actor
   * @throws WorldError if actor is not registered
   */
  getActorOrThrow(actorId: string): ActorRef {
    const actor = this.actors.get(actorId);
    if (!actor) {
      throw actorNotRegistered(actorId);
    }
    return actor;
  }

  /**
   * Get binding for an actor
   *
   * @param actorId - The ID of the actor
   * @returns The binding or undefined if not found
   */
  getBinding(actorId: string): ActorAuthorityBinding | undefined {
    return this.bindings.get(actorId);
  }

  /**
   * Get binding for an actor, throwing if not found
   *
   * @param actorId - The ID of the actor
   * @returns The binding
   * @throws WorldError if actor is not registered or unbound
   */
  getBindingOrThrow(actorId: string): ActorAuthorityBinding {
    const binding = this.bindings.get(actorId);
    if (!binding) {
      if (!this.actors.has(actorId)) {
        throw actorNotRegistered(actorId);
      }
      throw unboundActor(actorId);
    }
    return binding;
  }

  /**
   * Check if an actor is registered
   *
   * @param actorId - The ID of the actor
   * @returns true if registered
   */
  isRegistered(actorId: string): boolean {
    return this.actors.has(actorId);
  }

  /**
   * Check if an actor has a binding
   *
   * @param actorId - The ID of the actor
   * @returns true if bound
   */
  isBound(actorId: string): boolean {
    return this.bindings.has(actorId);
  }

  /**
   * Update an actor's binding (only affects future proposals - B-3)
   *
   * @param actorId - The ID of the actor
   * @param authority - The new authority
   * @param policy - The new policy
   * @throws WorldError if actor is not registered
   */
  updateBinding(
    actorId: string,
    authority: AuthorityRef,
    policy: AuthorityPolicy
  ): void {
    const actor = this.actors.get(actorId);
    if (!actor) {
      throw actorNotRegistered(actorId);
    }

    this.bindings.set(actorId, {
      actor,
      authority,
      policy,
    });
  }

  /**
   * List all registered actors
   *
   * @returns Array of all registered actors
   */
  listActors(): ActorRef[] {
    return Array.from(this.actors.values());
  }

  /**
   * List all bindings
   *
   * @returns Array of all bindings
   */
  listBindings(): ActorAuthorityBinding[] {
    return Array.from(this.bindings.values());
  }

  /**
   * Get the number of registered actors
   */
  get size(): number {
    return this.actors.size;
  }

  /**
   * Clear all registrations
   */
  clear(): void {
    this.actors.clear();
    this.bindings.clear();
  }

  /**
   * Get actors by authority ID
   *
   * @param authorityId - The authority ID to filter by
   * @returns Actors bound to this authority
   */
  getActorsByAuthority(authorityId: string): ActorRef[] {
    const result: ActorRef[] = [];
    for (const binding of this.bindings.values()) {
      if (binding.authority.authorityId === authorityId) {
        result.push(binding.actor);
      }
    }
    return result;
  }

  /**
   * Get actors by kind
   *
   * @param kind - The actor kind to filter by
   * @returns Actors of this kind
   */
  getActorsByKind(kind: ActorRef["kind"]): ActorRef[] {
    return this.listActors().filter((actor) => actor.kind === kind);
  }
}

/**
 * Create a new ActorRegistry
 */
export function createActorRegistry(): ActorRegistry {
  return new ActorRegistry();
}
