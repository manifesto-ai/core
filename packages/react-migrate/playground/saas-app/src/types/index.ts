// Core Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  organizationId: string;
  createdAt: Date;
  lastLoginAt?: Date;
  preferences: UserPreferences;
}

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  slack: boolean;
  digest: 'daily' | 'weekly' | 'never';
}

// Organization
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  plan: BillingPlan;
  ownerId: string;
  settings: OrganizationSettings;
  createdAt: Date;
}

export interface OrganizationSettings {
  allowPublicProjects: boolean;
  requireTwoFactor: boolean;
  ssoEnabled: boolean;
  ssoProvider?: string;
}

// Billing
export type BillingPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export interface Subscription {
  id: string;
  organizationId: string;
  plan: BillingPlan;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  seats: number;
  usedSeats: number;
}

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';

export interface Invoice {
  id: string;
  organizationId: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  dueDate: Date;
  paidAt?: Date;
  items: InvoiceItem[];
}

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

// Projects
export interface Project {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  status: ProjectStatus;
  visibility: 'public' | 'private';
  ownerId: string;
  members: ProjectMember[];
  settings: ProjectSettings;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectStatus = 'active' | 'archived' | 'deleted';

export interface ProjectMember {
  userId: string;
  role: ProjectRole;
  joinedAt: Date;
}

export type ProjectRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface ProjectSettings {
  defaultBranch: string;
  requireReview: boolean;
  autoMerge: boolean;
  protectedBranches: string[];
}

// Tasks
export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  reporterId: string;
  labels: string[];
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  parentTaskId?: string;
  subtasks: string[];
  comments: Comment[];
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'canceled';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Comment {
  id: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  reactions: Reaction[];
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
}

// Team
export interface TeamMember {
  id: string;
  userId: string;
  user: User;
  organizationId: string;
  role: UserRole;
  departmentId?: string;
  invitedBy: string;
  invitedAt: Date;
  joinedAt?: Date;
  status: TeamMemberStatus;
}

export type TeamMemberStatus = 'pending' | 'active' | 'suspended' | 'removed';

export interface Department {
  id: string;
  name: string;
  organizationId: string;
  managerId?: string;
  parentDepartmentId?: string;
}

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  role: UserRole;
  invitedBy: string;
  expiresAt: Date;
  status: InvitationStatus;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

// Notifications
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  createdAt: Date;
}

export type NotificationType =
  | 'task_assigned'
  | 'task_updated'
  | 'task_completed'
  | 'comment_added'
  | 'mention'
  | 'project_invited'
  | 'team_joined'
  | 'billing_alert'
  | 'system';

// Analytics
export interface AnalyticsEvent {
  id: string;
  userId: string;
  organizationId: string;
  eventType: string;
  properties: Record<string, unknown>;
  timestamp: Date;
}

export interface DashboardMetrics {
  activeProjects: number;
  completedTasks: number;
  pendingTasks: number;
  teamMembers: number;
  storageUsed: number;
  storageLimit: number;
  apiCallsUsed: number;
  apiCallsLimit: number;
}

export interface ProjectMetrics {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  avgCompletionTime: number;
  velocityTrend: number[];
  burndownData: BurndownPoint[];
}

export interface BurndownPoint {
  date: Date;
  remaining: number;
  ideal: number;
}

// API Types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
