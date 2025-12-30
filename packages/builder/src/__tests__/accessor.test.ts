import { describe, it, expect } from "vitest";
import { z } from "zod";
import { buildAccessor } from "../accessor/accessor-builder.js";
import { isFieldRef } from "../refs/field-ref.js";

describe("buildAccessor", () => {
  it("creates accessor for simple flat schema", () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      active: z.boolean(),
    });

    const accessor = buildAccessor(schema);

    expect(isFieldRef(accessor.name)).toBe(true);
    expect(accessor.name.path).toBe("name");
    expect(accessor.age.path).toBe("age");
    expect(accessor.active.path).toBe("active");
  });

  it("creates accessor for nested objects", () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          displayName: z.string(),
          avatar: z.string().nullable(),
        }),
        settings: z.object({
          theme: z.enum(["light", "dark"]),
        }),
      }),
    });

    const accessor = buildAccessor(schema);

    expect(accessor.user.profile.displayName.path).toBe("user.profile.displayName");
    expect(accessor.user.profile.avatar.path).toBe("user.profile.avatar");
    expect(accessor.user.settings.theme.path).toBe("user.settings.theme");
  });

  it("creates RecordAccessor for z.record types", () => {
    const schema = z.object({
      items: z.record(
        z.string(),
        z.object({
          name: z.string(),
          quantity: z.number(),
        })
      ),
    });

    const accessor = buildAccessor(schema);

    expect(accessor.items.path).toBe("items");
    expect(typeof accessor.items.byId).toBe("function");

    const itemRef = accessor.items.byId("abc123");
    expect(itemRef.path).toBe("items.abc123");
  });

  it("creates ArrayAccessor for z.array types", () => {
    const schema = z.object({
      tags: z.array(z.string()),
    });

    const accessor = buildAccessor(schema);

    expect(accessor.tags.path).toBe("tags");
    // Arrays are atomic, no index access
  });

  it("handles optional fields", () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });

    const accessor = buildAccessor(schema);

    expect(accessor.required.path).toBe("required");
    expect(accessor.optional.path).toBe("optional");
  });

  it("handles nullable fields", () => {
    const schema = z.object({
      nullable: z.string().nullable(),
    });

    const accessor = buildAccessor(schema);

    expect(accessor.nullable.path).toBe("nullable");
  });

  it("handles default fields", () => {
    const schema = z.object({
      withDefault: z.string().default("hello"),
    });

    const accessor = buildAccessor(schema);

    expect(accessor.withDefault.path).toBe("withDefault");
  });

  it("handles enum fields", () => {
    const schema = z.object({
      status: z.enum(["pending", "active", "completed"]),
    });

    const accessor = buildAccessor(schema);

    expect(accessor.status.path).toBe("status");
  });

  it("handles deeply nested records", () => {
    const schema = z.object({
      users: z.record(
        z.string(),
        z.object({
          orders: z.record(
            z.string(),
            z.object({
              total: z.number(),
            })
          ),
        })
      ),
    });

    const accessor = buildAccessor(schema);

    expect(accessor.users.path).toBe("users");
    const userRef = accessor.users.byId("user1");
    expect(userRef.path).toBe("users.user1");
  });

  describe("ObjectAccessor intersection type", () => {
    it("nested objects are FieldRef AND have children", () => {
      const schema = z.object({
        subscription: z.object({
          plan: z.enum(["free", "pro"]),
          seatsUsed: z.number(),
        }),
      });

      const accessor = buildAccessor(schema);

      // subscription is a FieldRef (can use in patch)
      expect(isFieldRef(accessor.subscription)).toBe(true);
      expect(accessor.subscription.__brand).toBe("FieldRef");
      expect(accessor.subscription.path).toBe("subscription");

      // subscription also has children (can dot access)
      expect(accessor.subscription.plan.path).toBe("subscription.plan");
      expect(accessor.subscription.seatsUsed.path).toBe("subscription.seatsUsed");
    });

    it("deeply nested objects all have FieldRef properties", () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            settings: z.object({
              theme: z.string(),
            }),
          }),
        }),
      });

      const accessor = buildAccessor(schema);

      // All levels are FieldRef AND have children
      expect(accessor.user.__brand).toBe("FieldRef");
      expect(accessor.user.path).toBe("user");

      expect(accessor.user.profile.__brand).toBe("FieldRef");
      expect(accessor.user.profile.path).toBe("user.profile");

      expect(accessor.user.profile.settings.__brand).toBe("FieldRef");
      expect(accessor.user.profile.settings.path).toBe("user.profile.settings");

      // Leaf field
      expect(accessor.user.profile.settings.theme.path).toBe("user.profile.settings.theme");
    });

    it("root accessor has FieldRef properties with empty path", () => {
      const schema = z.object({
        name: z.string(),
      });

      const accessor = buildAccessor(schema);

      // Root accessor is also a FieldRef (for patching entire state)
      expect(accessor.__brand).toBe("FieldRef");
      expect(accessor.path).toBe("");
    });
  });
});
