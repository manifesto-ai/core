import { describe, it, expect, beforeEach } from "vitest";
import { ActorRegistry, createActorRegistry } from "./registry.js";
import {
  createHumanActor,
  createAgentActor,
  createSystemActor,
} from "../schema/actor.js";
import { createAuthorityRef } from "../schema/authority.js";
import type { AuthorityPolicy } from "../schema/binding.js";

describe("ActorRegistry", () => {
  let registry: ActorRegistry;

  const alice = createHumanActor("alice", "Alice");
  const bob = createHumanActor("bob", "Bob");
  const agent = createAgentActor("agent-1", "AI Agent");
  const system = createSystemActor("scheduler", "Task Scheduler");

  const autoAuthority = createAuthorityRef("auto-approve", "auto", "Auto Approve");
  const hitlAuthority = createAuthorityRef("human-review", "human", "Human Review");

  const autoPolicy: AuthorityPolicy = {
    mode: "auto_approve",
    reason: "Trusted human",
  };

  const hitlPolicy: AuthorityPolicy = {
    mode: "hitl",
    delegate: alice,
    timeout: 3600000,
    onTimeout: "reject",
  };

  beforeEach(() => {
    registry = createActorRegistry();
  });

  describe("register", () => {
    it("should register an actor with binding", () => {
      registry.register(alice, autoAuthority, autoPolicy);

      expect(registry.isRegistered("alice")).toBe(true);
      expect(registry.isBound("alice")).toBe(true);
      expect(registry.size).toBe(1);
    });

    it("should register multiple actors", () => {
      registry.register(alice, autoAuthority, autoPolicy);
      registry.register(bob, autoAuthority, autoPolicy);
      registry.register(agent, hitlAuthority, hitlPolicy);

      expect(registry.size).toBe(3);
      expect(registry.isRegistered("alice")).toBe(true);
      expect(registry.isRegistered("bob")).toBe(true);
      expect(registry.isRegistered("agent-1")).toBe(true);
    });

    it("should throw when registering duplicate actor", () => {
      registry.register(alice, autoAuthority, autoPolicy);

      expect(() => registry.register(alice, hitlAuthority, hitlPolicy)).toThrow(
        /already registered/
      );
    });

    it("should allow multiple actors to share same authority (B-5)", () => {
      registry.register(alice, autoAuthority, autoPolicy);
      registry.register(bob, autoAuthority, autoPolicy);

      const aliceBinding = registry.getBinding("alice");
      const bobBinding = registry.getBinding("bob");

      expect(aliceBinding?.authority.authorityId).toBe("auto-approve");
      expect(bobBinding?.authority.authorityId).toBe("auto-approve");
    });
  });

  describe("unregister", () => {
    it("should unregister an actor", () => {
      registry.register(alice, autoAuthority, autoPolicy);
      const result = registry.unregister("alice");

      expect(result).toBe(true);
      expect(registry.isRegistered("alice")).toBe(false);
      expect(registry.isBound("alice")).toBe(false);
    });

    it("should return false when unregistering non-existent actor", () => {
      const result = registry.unregister("unknown");
      expect(result).toBe(false);
    });
  });

  describe("getActor", () => {
    it("should return actor by ID", () => {
      registry.register(alice, autoAuthority, autoPolicy);

      const result = registry.getActor("alice");
      expect(result).toEqual(alice);
    });

    it("should return undefined for unknown actor", () => {
      const result = registry.getActor("unknown");
      expect(result).toBeUndefined();
    });
  });

  describe("getActorOrThrow", () => {
    it("should return actor by ID", () => {
      registry.register(alice, autoAuthority, autoPolicy);

      const result = registry.getActorOrThrow("alice");
      expect(result).toEqual(alice);
    });

    it("should throw for unknown actor", () => {
      expect(() => registry.getActorOrThrow("unknown")).toThrow(
        /not registered/
      );
    });
  });

  describe("getBinding", () => {
    it("should return binding for actor", () => {
      registry.register(alice, autoAuthority, autoPolicy);

      const binding = registry.getBinding("alice");
      expect(binding).toBeDefined();
      expect(binding?.actor).toEqual(alice);
      expect(binding?.authority).toEqual(autoAuthority);
      expect(binding?.policy).toEqual(autoPolicy);
    });

    it("should return undefined for unknown actor", () => {
      const binding = registry.getBinding("unknown");
      expect(binding).toBeUndefined();
    });
  });

  describe("getBindingOrThrow", () => {
    it("should return binding for actor", () => {
      registry.register(alice, autoAuthority, autoPolicy);

      const binding = registry.getBindingOrThrow("alice");
      expect(binding.actor).toEqual(alice);
    });

    it("should throw for unregistered actor", () => {
      expect(() => registry.getBindingOrThrow("unknown")).toThrow(
        /not registered/
      );
    });
  });

  describe("updateBinding", () => {
    it("should update binding for existing actor", () => {
      registry.register(alice, autoAuthority, autoPolicy);
      registry.updateBinding("alice", hitlAuthority, hitlPolicy);

      const binding = registry.getBinding("alice");
      expect(binding?.authority).toEqual(hitlAuthority);
      expect(binding?.policy).toEqual(hitlPolicy);
    });

    it("should throw when updating unregistered actor", () => {
      expect(() =>
        registry.updateBinding("unknown", autoAuthority, autoPolicy)
      ).toThrow(/not registered/);
    });

    it("should preserve actor reference after update", () => {
      registry.register(alice, autoAuthority, autoPolicy);
      registry.updateBinding("alice", hitlAuthority, hitlPolicy);

      const binding = registry.getBinding("alice");
      expect(binding?.actor).toEqual(alice);
    });
  });

  describe("listActors", () => {
    it("should return empty array for empty registry", () => {
      expect(registry.listActors()).toEqual([]);
    });

    it("should return all registered actors", () => {
      registry.register(alice, autoAuthority, autoPolicy);
      registry.register(bob, autoAuthority, autoPolicy);
      registry.register(agent, hitlAuthority, hitlPolicy);

      const actors = registry.listActors();
      expect(actors).toHaveLength(3);
      expect(actors).toContainEqual(alice);
      expect(actors).toContainEqual(bob);
      expect(actors).toContainEqual(agent);
    });
  });

  describe("listBindings", () => {
    it("should return empty array for empty registry", () => {
      expect(registry.listBindings()).toEqual([]);
    });

    it("should return all bindings", () => {
      registry.register(alice, autoAuthority, autoPolicy);
      registry.register(agent, hitlAuthority, hitlPolicy);

      const bindings = registry.listBindings();
      expect(bindings).toHaveLength(2);
    });
  });

  describe("clear", () => {
    it("should remove all registrations", () => {
      registry.register(alice, autoAuthority, autoPolicy);
      registry.register(bob, autoAuthority, autoPolicy);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.isRegistered("alice")).toBe(false);
      expect(registry.isRegistered("bob")).toBe(false);
    });
  });

  describe("getActorsByAuthority", () => {
    it("should return actors bound to authority", () => {
      registry.register(alice, autoAuthority, autoPolicy);
      registry.register(bob, autoAuthority, autoPolicy);
      registry.register(agent, hitlAuthority, hitlPolicy);

      const autoActors = registry.getActorsByAuthority("auto-approve");
      expect(autoActors).toHaveLength(2);
      expect(autoActors).toContainEqual(alice);
      expect(autoActors).toContainEqual(bob);

      const hitlActors = registry.getActorsByAuthority("human-review");
      expect(hitlActors).toHaveLength(1);
      expect(hitlActors).toContainEqual(agent);
    });

    it("should return empty array for unknown authority", () => {
      const actors = registry.getActorsByAuthority("unknown");
      expect(actors).toEqual([]);
    });
  });

  describe("getActorsByKind", () => {
    it("should return actors by kind", () => {
      registry.register(alice, autoAuthority, autoPolicy);
      registry.register(bob, autoAuthority, autoPolicy);
      registry.register(agent, hitlAuthority, hitlPolicy);
      registry.register(system, autoAuthority, autoPolicy);

      const humans = registry.getActorsByKind("human");
      expect(humans).toHaveLength(2);

      const agents = registry.getActorsByKind("agent");
      expect(agents).toHaveLength(1);

      const systems = registry.getActorsByKind("system");
      expect(systems).toHaveLength(1);
    });
  });

  describe("INV-A1: Actor-Authority 1:1 binding", () => {
    it("should ensure each actor has exactly one binding", () => {
      registry.register(alice, autoAuthority, autoPolicy);

      // Actor should have exactly one binding
      expect(registry.getBinding("alice")).toBeDefined();

      // Updating replaces, doesn't add
      registry.updateBinding("alice", hitlAuthority, hitlPolicy);
      const bindings = registry.listBindings();
      const aliceBindings = bindings.filter(
        (b) => b.actor.actorId === "alice"
      );
      expect(aliceBindings).toHaveLength(1);
    });
  });
});

describe("createActorRegistry", () => {
  it("should create a new empty registry", () => {
    const registry = createActorRegistry();
    expect(registry).toBeInstanceOf(ActorRegistry);
    expect(registry.size).toBe(0);
  });

  it("should create independent instances", () => {
    const registry1 = createActorRegistry();
    const registry2 = createActorRegistry();

    const alice = createHumanActor("alice", "Alice");
    const autoAuthority = createAuthorityRef("auto", "auto");
    const policy: AuthorityPolicy = { mode: "auto_approve" };

    registry1.register(alice, autoAuthority, policy);

    expect(registry1.isRegistered("alice")).toBe(true);
    expect(registry2.isRegistered("alice")).toBe(false);
  });
});
