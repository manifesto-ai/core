import { defineEffects } from "../../effects.ts";

type User = {
  id: string;
  name: string;
};

type EffectsDomain = {
  actions: {
    fetchUser: (id: string) => void;
  };
  state: {
    user: User | null;
    loading: boolean;
    profile: {
      name?: string;
      source?: string;
    };
    tags: string[];
  };
  computed: {
    userCount: number;
  };
};

const effects = defineEffects<EffectsDomain>(({ set, unset, merge }, refs) => ({
  "api.fetchUser": async () => [
    set(refs.state.loading, false),
    set(refs.state.user, { id: "123", name: "Ada" }),
    unset(refs.state.user),
    merge(refs.state.profile, { name: "Ada", source: "api" }),
  ],
}));

void effects;

defineEffects<EffectsDomain>(({ set, merge }, refs) => {
  // @ts-expect-error wrong value type for boolean field
  void set(refs.state.loading, "oops");

  // @ts-expect-error set must derive its value type from the referenced field
  void set(refs.state.loading, undefined);

  // @ts-expect-error merge rejects primitive fields
  void merge(refs.state.loading, { nope: true });

  // @ts-expect-error merge rejects array fields
  void merge(refs.state.tags, { 0: "tag" });

  // @ts-expect-error merge rejects computed refs
  void merge(refs.computed.userCount, { nope: true });

  // @ts-expect-error set rejects action refs
  void set(refs.actions.fetchUser, { id: "123", name: "Ada" });

  return {};
});
