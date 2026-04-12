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

const effects = defineEffects<EffectsDomain>(({ set, unset, merge }, MEL) => ({
  "api.fetchUser": async () => [
    set(MEL.state.loading, false),
    set(MEL.state.user, { id: "123", name: "Ada" }),
    unset(MEL.state.user),
    merge(MEL.state.profile, { name: "Ada", source: "api" }),
  ],
}));

void effects;

defineEffects<EffectsDomain>(({ set, merge }, MEL) => {
  // @ts-expect-error wrong value type for boolean field
  void set(MEL.state.loading, "oops");

  // @ts-expect-error set must derive its value type from the referenced field
  void set(MEL.state.loading, undefined);

  // @ts-expect-error merge rejects primitive fields
  void merge(MEL.state.loading, { nope: true });

  // @ts-expect-error merge rejects array fields
  void merge(MEL.state.tags, { 0: "tag" });

  // @ts-expect-error merge rejects computed refs
  void merge(MEL.computed.userCount, { nope: true });

  // @ts-expect-error set rejects action refs
  void set(MEL.actions.fetchUser, { id: "123", name: "Ada" });

  return {};
});
