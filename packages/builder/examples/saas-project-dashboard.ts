/**
 * SaaS Project Dashboard Example
 *
 * This example demonstrates complex conditional logic for a SaaS web application:
 * - Subscription tiers with feature gating
 * - Usage limits and quotas
 * - Team collaboration with role-based access
 * - Multi-step workflows with state transitions
 * - Billing states affecting availability
 * - Complex nested conditions
 */

import { z } from "zod";
import { defineDomain, setupDomain } from "../src/index.js";
import { guard, onceNull } from "../src/flow/helpers.js";

// ============ 1. Define State Schema ============

const ProjectDashboardSchema = z.object({
  // --- Project Info ---
  projectId: z.string(),
  projectName: z.string(),
  createdAt: z.number(),

  // --- Subscription & Billing ---
  subscription: z.object({
    plan: z.enum(["free", "trial", "starter", "pro", "enterprise"]),
    status: z.enum(["active", "past_due", "suspended", "cancelled"]),
    trialEndsAt: z.number().nullable(),
    seatsUsed: z.number(),
    seatsLimit: z.number(),
  }),

  // --- Usage & Quotas ---
  usage: z.object({
    apiCallsThisMonth: z.number(),
    apiCallsLimit: z.number(),
    storageUsedMB: z.number(),
    storageLimitMB: z.number(),
    buildsThisMonth: z.number(),
    buildsLimit: z.number(),
  }),

  // --- Current User Context ---
  currentUser: z.object({
    id: z.string(),
    role: z.enum(["viewer", "member", "admin", "owner"]),
    joinedAt: z.number(),
    lastActiveAt: z.number(),
  }),

  // --- Project State ---
  projectStatus: z.enum(["setup", "active", "paused", "archived"]),
  deploymentStatus: z.enum(["idle", "building", "deploying", "live", "failed"]),
  lastDeployedAt: z.number().nullable(),
  lastBuildError: z.string().nullable(),

  // --- Feature Flags (plan-based) ---
  features: z.object({
    customDomains: z.boolean(),
    analytics: z.boolean(),
    teamCollaboration: z.boolean(),
    apiAccess: z.boolean(),
    prioritySupport: z.boolean(),
    ssoEnabled: z.boolean(),
    auditLogs: z.boolean(),
  }),

  // --- Pending Invitations ---
  pendingInvitations: z.number(),

  // --- Notifications ---
  unreadNotifications: z.number(),
  hasUnacknowledgedAlerts: z.boolean(),
});

type ProjectDashboardState = z.infer<typeof ProjectDashboardSchema>;

// ============ 2. Define Domain ============

export const ProjectDashboardDomain = defineDomain(
  ProjectDashboardSchema,
  ({ state, computed, actions, expr, flow }) => {
    // ======== Subscription & Billing Computed ========

    const {
      isFreePlan,
      isTrialPlan,
      isPaidPlan,
      isEnterprise,
      isTrialExpired,
      isSubscriptionActive,
      isSubscriptionPastDue,
      isSubscriptionSuspended,
      canUpgrade,
    } = computed.define({
      isFreePlan: expr.eq(state.subscription.plan, "free"),
      isTrialPlan: expr.eq(state.subscription.plan, "trial"),
      isPaidPlan: expr.or(
        expr.eq(state.subscription.plan, "starter"),
        expr.eq(state.subscription.plan, "pro"),
        expr.eq(state.subscription.plan, "enterprise")
      ),
      isEnterprise: expr.eq(state.subscription.plan, "enterprise"),
      isTrialExpired: expr.and(
        expr.eq(state.subscription.plan, "trial"),
        expr.isNotNull(state.subscription.trialEndsAt),
        expr.lt(state.subscription.trialEndsAt, expr.lit(Date.now()))
      ),
      isSubscriptionActive: expr.eq(state.subscription.status, "active"),
      isSubscriptionPastDue: expr.eq(state.subscription.status, "past_due"),
      isSubscriptionSuspended: expr.eq(state.subscription.status, "suspended"),
      canUpgrade: {
        expr: expr.and(
          expr.not(expr.eq(state.subscription.plan, "enterprise")),
          expr.neq(state.subscription.status, "suspended")
        ),
        description: "User can upgrade if not on enterprise and not suspended",
      },
    });

    // ======== Usage & Quota Computed ========

    const {
      apiUsagePercent,
      storageUsagePercent,
      buildsUsagePercent,
      isApiLimitReached,
      isStorageLimitReached,
      isBuildsLimitReached,
      isAnyLimitReached,
      isApproachingLimits,
      seatsAvailable,
      canAddTeamMember,
    } = computed.define({
      apiUsagePercent: expr.cond(
        expr.gt(state.usage.apiCallsLimit, 0),
        expr.mul(
          expr.div(state.usage.apiCallsThisMonth, state.usage.apiCallsLimit),
          100
        ),
        expr.lit(0)
      ),
      storageUsagePercent: expr.cond(
        expr.gt(state.usage.storageLimitMB, 0),
        expr.mul(
          expr.div(state.usage.storageUsedMB, state.usage.storageLimitMB),
          100
        ),
        expr.lit(0)
      ),
      buildsUsagePercent: expr.cond(
        expr.gt(state.usage.buildsLimit, 0),
        expr.mul(
          expr.div(state.usage.buildsThisMonth, state.usage.buildsLimit),
          100
        ),
        expr.lit(0)
      ),
      isApiLimitReached: expr.gte(
        state.usage.apiCallsThisMonth,
        state.usage.apiCallsLimit
      ),
      isStorageLimitReached: expr.gte(
        state.usage.storageUsedMB,
        state.usage.storageLimitMB
      ),
      isBuildsLimitReached: expr.gte(
        state.usage.buildsThisMonth,
        state.usage.buildsLimit
      ),
      isAnyLimitReached: {
        expr: expr.or(
          expr.gte(state.usage.apiCallsThisMonth, state.usage.apiCallsLimit),
          expr.gte(state.usage.storageUsedMB, state.usage.storageLimitMB),
          expr.gte(state.usage.buildsThisMonth, state.usage.buildsLimit)
        ),
        description: "Any usage limit has been reached",
      },
      isApproachingLimits: {
        expr: expr.or(
          expr.gt(
            expr.mul(
              expr.div(state.usage.apiCallsThisMonth, state.usage.apiCallsLimit),
              100
            ),
            80
          ),
          expr.gt(
            expr.mul(
              expr.div(state.usage.storageUsedMB, state.usage.storageLimitMB),
              100
            ),
            80
          ),
          expr.gt(
            expr.mul(
              expr.div(state.usage.buildsThisMonth, state.usage.buildsLimit),
              100
            ),
            80
          )
        ),
        description: "Any usage is above 80% threshold",
      },
      seatsAvailable: expr.sub(
        state.subscription.seatsLimit,
        state.subscription.seatsUsed
      ),
      canAddTeamMember: {
        expr: expr.and(
          expr.lt(state.subscription.seatsUsed, state.subscription.seatsLimit),
          expr.or(
            expr.eq(state.currentUser.role, "admin"),
            expr.eq(state.currentUser.role, "owner")
          ),
          expr.eq(state.subscription.status, "active")
        ),
        description: "Can add team member if seats available and user is admin/owner",
      },
    });

    // ======== Role-Based Access Computed ========

    const { isViewer, isMember, isAdmin, isOwner, canEdit, canManageTeam, canManageBilling, canDeleteProject } =
      computed.define({
        isViewer: expr.eq(state.currentUser.role, "viewer"),
        isMember: expr.eq(state.currentUser.role, "member"),
        isAdmin: expr.eq(state.currentUser.role, "admin"),
        isOwner: expr.eq(state.currentUser.role, "owner"),
        canEdit: {
          expr: expr.and(
            expr.or(
              expr.eq(state.currentUser.role, "member"),
              expr.eq(state.currentUser.role, "admin"),
              expr.eq(state.currentUser.role, "owner")
            ),
            expr.neq(state.projectStatus, "archived")
          ),
          description: "User can edit if member+ and project not archived",
        },
        canManageTeam: {
          expr: expr.or(
            expr.eq(state.currentUser.role, "admin"),
            expr.eq(state.currentUser.role, "owner")
          ),
          description: "Only admins and owners can manage team",
        },
        canManageBilling: {
          expr: expr.eq(state.currentUser.role, "owner"),
          description: "Only owner can manage billing",
        },
        canDeleteProject: {
          expr: expr.and(
            expr.eq(state.currentUser.role, "owner"),
            expr.neq(state.projectStatus, "archived")
          ),
          description: "Only owner can delete, and project must not be archived",
        },
      });

    // ======== Project & Deployment Status Computed ========

    const {
      isProjectSetup,
      isProjectActive,
      isProjectPaused,
      isProjectArchived,
      isDeploying,
      isDeploymentFailed,
      isLive,
      canDeploy,
      canPauseProject,
      canResumeProject,
      canArchiveProject,
      needsAttention,
    } = computed.define({
      isProjectSetup: expr.eq(state.projectStatus, "setup"),
      isProjectActive: expr.eq(state.projectStatus, "active"),
      isProjectPaused: expr.eq(state.projectStatus, "paused"),
      isProjectArchived: expr.eq(state.projectStatus, "archived"),
      isDeploying: expr.or(
        expr.eq(state.deploymentStatus, "building"),
        expr.eq(state.deploymentStatus, "deploying")
      ),
      isDeploymentFailed: expr.eq(state.deploymentStatus, "failed"),
      isLive: expr.eq(state.deploymentStatus, "live"),
      canDeploy: {
        expr: expr.and(
          // Must have edit permission
          expr.or(
            expr.eq(state.currentUser.role, "member"),
            expr.eq(state.currentUser.role, "admin"),
            expr.eq(state.currentUser.role, "owner")
          ),
          // Project must be active
          expr.eq(state.projectStatus, "active"),
          // Not currently deploying
          expr.not(
            expr.or(
              expr.eq(state.deploymentStatus, "building"),
              expr.eq(state.deploymentStatus, "deploying")
            )
          ),
          // Subscription must be active
          expr.eq(state.subscription.status, "active"),
          // Build limit not reached
          expr.lt(state.usage.buildsThisMonth, state.usage.buildsLimit)
        ),
        description: "Complex deployment eligibility check",
      },
      canPauseProject: {
        expr: expr.and(
          expr.or(
            expr.eq(state.currentUser.role, "admin"),
            expr.eq(state.currentUser.role, "owner")
          ),
          expr.eq(state.projectStatus, "active")
        ),
        description: "Admin/owner can pause active projects",
      },
      canResumeProject: {
        expr: expr.and(
          expr.or(
            expr.eq(state.currentUser.role, "admin"),
            expr.eq(state.currentUser.role, "owner")
          ),
          expr.eq(state.projectStatus, "paused"),
          expr.eq(state.subscription.status, "active")
        ),
        description: "Admin/owner can resume paused projects if subscription active",
      },
      canArchiveProject: {
        expr: expr.and(
          expr.eq(state.currentUser.role, "owner"),
          expr.neq(state.projectStatus, "archived"),
          expr.not(
            expr.or(
              expr.eq(state.deploymentStatus, "building"),
              expr.eq(state.deploymentStatus, "deploying")
            )
          )
        ),
        description: "Owner can archive if not deploying",
      },
      needsAttention: {
        expr: expr.or(
          // Deployment failed
          expr.eq(state.deploymentStatus, "failed"),
          // Subscription issues
          expr.eq(state.subscription.status, "past_due"),
          expr.eq(state.subscription.status, "suspended"),
          // Trial expiring soon (within 3 days)
          expr.and(
            expr.eq(state.subscription.plan, "trial"),
            expr.isNotNull(state.subscription.trialEndsAt),
            expr.lt(
              state.subscription.trialEndsAt,
              expr.add(expr.lit(Date.now()), expr.lit(3 * 24 * 60 * 60 * 1000))
            )
          ),
          // Has unacknowledged alerts
          state.hasUnacknowledgedAlerts
        ),
        description: "Dashboard needs user attention",
      },
    });

    // ======== Feature Access Computed (plan-based gating) ========

    const {
      canUseCustomDomains,
      canUseAnalytics,
      canUseTeamFeatures,
      canUseApiAccess,
      canUseSso,
      showUpgradePrompt,
    } = computed.define({
      canUseCustomDomains: {
        expr: expr.and(state.features.customDomains, isSubscriptionActive),
        description: "Custom domains enabled and subscription active",
      },
      canUseAnalytics: {
        expr: expr.and(state.features.analytics, isSubscriptionActive),
        description: "Analytics enabled and subscription active",
      },
      canUseTeamFeatures: {
        expr: expr.and(state.features.teamCollaboration, isSubscriptionActive),
        description: "Team collaboration enabled and subscription active",
      },
      canUseApiAccess: {
        expr: expr.and(
          state.features.apiAccess,
          isSubscriptionActive,
          expr.not(isApiLimitReached)
        ),
        description: "API access enabled, active, and under limit",
      },
      canUseSso: {
        expr: expr.and(state.features.ssoEnabled, isEnterprise, isSubscriptionActive),
        description: "SSO only for enterprise with active subscription",
      },
      showUpgradePrompt: {
        expr: expr.or(
          // Free users
          isFreePlan,
          // Trial expired or expiring
          isTrialExpired,
          // Approaching limits
          isApproachingLimits,
          // Trying to use features not in plan
          expr.and(
            expr.not(state.features.customDomains),
            expr.eq(state.projectStatus, "active")
          )
        ),
        description: "Should show upgrade prompt to user",
      },
    });

    // ======== Actions ========

    const {
      deploy,
      cancelDeployment,
      pauseProject,
      resumeProject,
      archiveProject,
      inviteTeamMember,
      removeTeamMember,
      changeUserRole,
      upgradePlan,
      acknowledgeAlerts,
      markNotificationsRead,
      retryFailedDeployment,
    } = actions.define({
      /**
       * Deploy the project
       */
      deploy: {
        description: "Deploy the project to production",
        available: canDeploy,
        flow: flow.seq(
          flow.patch(state.deploymentStatus).set(expr.lit("building")),
          flow.patch(state.usage.buildsThisMonth).set(
            expr.add(state.usage.buildsThisMonth, 1)
          ),
          flow.patch(state.lastBuildError).set(expr.lit<string | null>(null))
        ),
      },

      /**
       * Cancel ongoing deployment
       */
      cancelDeployment: {
        description: "Cancel the current deployment",
        available: expr.and(
          canEdit,
          expr.or(
            expr.eq(state.deploymentStatus, "building"),
            expr.eq(state.deploymentStatus, "deploying")
          )
        ),
        flow: flow.patch(state.deploymentStatus).set(expr.lit("idle")),
      },

      /**
       * Pause the project
       */
      pauseProject: {
        description: "Pause the project",
        available: canPauseProject,
        flow: flow.patch(state.projectStatus).set(expr.lit("paused")),
      },

      /**
       * Resume a paused project
       */
      resumeProject: {
        description: "Resume the paused project",
        available: canResumeProject,
        flow: flow.patch(state.projectStatus).set(expr.lit("active")),
      },

      /**
       * Archive the project
       */
      archiveProject: {
        description: "Archive the project (irreversible)",
        available: canArchiveProject,
        input: z.object({
          confirmationText: z.string(),
        }),
        flow: guard(
          expr.eq(expr.input<string>("confirmationText"), state.projectName),
          ({ patch }) => {
            patch(state.projectStatus).set(expr.lit("archived"));
            patch(state.deploymentStatus).set(expr.lit("idle"));
          }
        ),
      },

      /**
       * Invite a team member
       */
      inviteTeamMember: {
        description: "Invite a new team member",
        available: canAddTeamMember,
        input: z.object({
          email: z.string().email(),
          role: z.enum(["viewer", "member", "admin"]),
        }),
        flow: flow.seq(
          flow.patch(state.pendingInvitations).set(
            expr.add(state.pendingInvitations, 1)
          ),
          flow.effect("sendInvitationEmail", {
            email: expr.input<string>("email"),
            role: expr.input<string>("role"),
            projectName: state.projectName,
          })
        ),
      },

      /**
       * Remove a team member
       */
      removeTeamMember: {
        description: "Remove a team member from the project",
        available: canManageTeam,
        input: z.object({
          userId: z.string(),
        }),
        // Cannot remove yourself or owner
        flow: guard(
          expr.neq(expr.input<string>("userId"), state.currentUser.id),
          ({ patch }) => {
            patch(state.subscription.seatsUsed).set(
              expr.sub(state.subscription.seatsUsed, 1)
            );
          }
        ),
      },

      /**
       * Change a user's role
       */
      changeUserRole: {
        description: "Change a team member's role",
        available: expr.and(canManageTeam, expr.not(isViewer)),
        input: z.object({
          userId: z.string(),
          newRole: z.enum(["viewer", "member", "admin"]),
        }),
        // Only owner can promote to admin
        flow: guard(
          expr.or(
            isOwner,
            expr.neq(expr.input<string>("newRole"), "admin")
          ),
          ({ patch }) => {
            // Role change would be persisted via effect in real app
            patch(state.currentUser.lastActiveAt).set(expr.lit(Date.now()));
          }
        ),
      },

      /**
       * Upgrade subscription plan
       */
      upgradePlan: {
        description: "Upgrade to a higher tier plan",
        available: expr.and(canUpgrade, canManageBilling),
        input: z.object({
          targetPlan: z.enum(["starter", "pro", "enterprise"]),
        }),
        flow: flow.seq(
          flow.patch(state.subscription.plan).set(expr.input("targetPlan")),
          flow.patch(state.subscription.status).set(expr.lit("active")),
          flow.effect("processUpgrade", {
            targetPlan: expr.input<string>("targetPlan"),
            projectId: state.projectId,
          })
        ),
      },

      /**
       * Acknowledge alerts
       */
      acknowledgeAlerts: {
        description: "Mark all alerts as acknowledged",
        available: state.hasUnacknowledgedAlerts,
        flow: flow.patch(state.hasUnacknowledgedAlerts).set(expr.lit(false)),
      },

      /**
       * Mark notifications as read
       */
      markNotificationsRead: {
        description: "Mark all notifications as read",
        available: expr.gt(state.unreadNotifications, 0),
        flow: flow.patch(state.unreadNotifications).set(expr.lit(0)),
      },

      /**
       * Retry failed deployment
       */
      retryFailedDeployment: {
        description: "Retry the last failed deployment",
        available: expr.and(
          canEdit,
          isDeploymentFailed,
          isSubscriptionActive,
          expr.not(isBuildsLimitReached)
        ),
        flow: flow.seq(
          flow.patch(state.deploymentStatus).set(expr.lit("building")),
          flow.patch(state.usage.buildsThisMonth).set(
            expr.add(state.usage.buildsThisMonth, 1)
          ),
          flow.patch(state.lastBuildError).set(expr.lit<string | null>(null))
        ),
      },
    });

    // Return the domain output
    return {
      computed: {
        // Subscription
        isFreePlan,
        isTrialPlan,
        isPaidPlan,
        isEnterprise,
        isTrialExpired,
        isSubscriptionActive,
        isSubscriptionPastDue,
        isSubscriptionSuspended,
        canUpgrade,
        // Usage
        apiUsagePercent,
        storageUsagePercent,
        buildsUsagePercent,
        isApiLimitReached,
        isStorageLimitReached,
        isBuildsLimitReached,
        isAnyLimitReached,
        isApproachingLimits,
        seatsAvailable,
        canAddTeamMember,
        // Roles
        isViewer,
        isMember,
        isAdmin,
        isOwner,
        canEdit,
        canManageTeam,
        canManageBilling,
        canDeleteProject,
        // Project status
        isProjectSetup,
        isProjectActive,
        isProjectPaused,
        isProjectArchived,
        isDeploying,
        isDeploymentFailed,
        isLive,
        canDeploy,
        canPauseProject,
        canResumeProject,
        canArchiveProject,
        needsAttention,
        // Features
        canUseCustomDomains,
        canUseAnalytics,
        canUseTeamFeatures,
        canUseApiAccess,
        canUseSso,
        showUpgradePrompt,
      },
      actions: {
        deploy,
        cancelDeployment,
        pauseProject,
        resumeProject,
        archiveProject,
        inviteTeamMember,
        removeTeamMember,
        changeUserRole,
        upgradePlan,
        acknowledgeAlerts,
        markNotificationsRead,
        retryFailedDeployment,
      },
    };
  },
  {
    id: "project-dashboard:v1",
    version: "1.0.0",
    meta: {
      name: "SaaS Project Dashboard",
      description: "Complex SaaS project management dashboard with subscription, usage, and role-based access",
    },
  }
);

// ============ 3. Setup & Validate Domain ============

const { schema, schemaHash, diagnostics } = setupDomain(ProjectDashboardDomain);

if (!diagnostics.valid) {
  console.error("Domain validation failed:");
  diagnostics.errors.forEach((e) => {
    console.error(`  [${e.code}] ${e.message}${e.path ? ` at ${e.path}` : ""}`);
  });
  process.exit(1);
}

console.log("=".repeat(60));
console.log("SaaS Project Dashboard Domain");
console.log("=".repeat(60));
console.log(`  ID: ${schema.id}`);
console.log(`  Version: ${schema.version}`);
console.log(`  Hash: ${schemaHash}`);
console.log(`  Computed fields: ${Object.keys(schema.computed.fields).length}`);
console.log(`  Actions: ${Object.keys(schema.actions).length}`);

// ============ 4. Demonstrate Computed Categories ============

console.log("\n--- Computed Fields by Category ---\n");

const computedByCategory = {
  "Subscription Status": [
    "isFreePlan", "isTrialPlan", "isPaidPlan", "isEnterprise",
    "isTrialExpired", "isSubscriptionActive", "isSubscriptionPastDue",
    "isSubscriptionSuspended", "canUpgrade"
  ],
  "Usage & Quotas": [
    "apiUsagePercent", "storageUsagePercent", "buildsUsagePercent",
    "isApiLimitReached", "isStorageLimitReached", "isBuildsLimitReached",
    "isAnyLimitReached", "isApproachingLimits", "seatsAvailable", "canAddTeamMember"
  ],
  "Role-Based Access": [
    "isViewer", "isMember", "isAdmin", "isOwner",
    "canEdit", "canManageTeam", "canManageBilling", "canDeleteProject"
  ],
  "Project & Deployment": [
    "isProjectSetup", "isProjectActive", "isProjectPaused", "isProjectArchived",
    "isDeploying", "isDeploymentFailed", "isLive",
    "canDeploy", "canPauseProject", "canResumeProject", "canArchiveProject", "needsAttention"
  ],
  "Feature Access": [
    "canUseCustomDomains", "canUseAnalytics", "canUseTeamFeatures",
    "canUseApiAccess", "canUseSso", "showUpgradePrompt"
  ],
};

for (const [category, fields] of Object.entries(computedByCategory)) {
  console.log(`${category}:`);
  fields.forEach((field) => {
    const spec = schema.computed.fields[field];
    if (spec) {
      const desc = spec.description ? ` - ${spec.description}` : "";
      console.log(`  - ${field}${desc}`);
    }
  });
  console.log();
}

// ============ 5. Demonstrate Actions ============

console.log("--- Actions ---\n");

Object.entries(schema.actions).forEach(([name, spec]) => {
  const hasInput = spec.inputSchema ? " (requires input)" : "";
  console.log(`${name}${hasInput}`);
  console.log(`  Description: ${spec.description ?? "(none)"}`);
});

// ============ 6. Intent Examples ============

console.log("\n--- Intent Examples ---\n");

// Deploy intent
const deployIntent = ProjectDashboardDomain.actions.deploy.intent();
console.log("Deploy intent:", JSON.stringify(deployIntent, null, 2));

// Invite team member intent
const inviteIntent = ProjectDashboardDomain.actions.inviteTeamMember.intent({
  email: "newuser@example.com",
  role: "member",
});
console.log("\nInvite team member intent:", JSON.stringify(inviteIntent, null, 2));

// Archive project intent
const archiveIntent = ProjectDashboardDomain.actions.archiveProject.intent({
  confirmationText: "My Project Name",
});
console.log("\nArchive project intent:", JSON.stringify(archiveIntent, null, 2));

// Upgrade plan intent
const upgradeIntent = ProjectDashboardDomain.actions.upgradePlan.intent({
  targetPlan: "pro",
});
console.log("\nUpgrade plan intent:", JSON.stringify(upgradeIntent, null, 2));

// ============ 7. Complex Condition Analysis ============

console.log("\n--- Complex Condition Analysis ---\n");

// Show the IR for canDeploy (one of the most complex conditions)
console.log("canDeploy condition structure:");
const canDeploySpec = schema.computed.fields["computed.canDeploy"];
console.log(`  Dependencies: ${canDeploySpec.deps.join(", ")}`);
console.log(`  Description: ${canDeploySpec.description}`);

// Show the IR for needsAttention
console.log("\nneedsAttention condition structure:");
const needsAttentionSpec = schema.computed.fields["computed.needsAttention"];
console.log(`  Dependencies: ${needsAttentionSpec.deps.join(", ")}`);
console.log(`  Description: ${needsAttentionSpec.description}`);

console.log("\n" + "=".repeat(60));
console.log("Domain validation complete!");
console.log("=".repeat(60));
