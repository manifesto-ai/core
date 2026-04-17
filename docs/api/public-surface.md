# Public Surface Inventory

> Generated from package `exports` and source barrels. Do not edit by hand.
>
> Run `pnpm docs:api:inventory` to update this page.

This page is a drift guard. Use the curated API reference pages for usage guidance.

## @manifesto-ai/codegen

### @manifesto-ai/codegen

_Source: `packages/codegen/src/index.ts`_

#### Values

- `createCompilerCodegen`
- `createDomainPlugin`
- `createTsPlugin`
- `createZodPlugin`
- `generate`
- `generateHeader`
- `stableHash`
- `validatePath`

#### Types

- `CodegenContext`
- `CodegenHelpers`
- `CodegenOutput`
- `CodegenPlugin`
- `CompilerCodegenEmitter`
- `CompilerCodegenInput`
- `CompilerCodegenOptions`
- `Diagnostic`
- `DomainPluginOptions`
- `FilePatch`
- `GenerateOptions`
- `GenerateResult`
- `HeaderOptions`
- `PathValidationResult`
- `TsPluginArtifacts`
- `TsPluginOptions`
- `ZodPluginOptions`

## @manifesto-ai/compiler

### @manifesto-ai/compiler

_Source: `packages/compiler/src/index.ts`_

#### Values

- `analyzeScope`
- `applyPatchToWorkingSnapshot`
- `buildAnnotationIndex`
- `check`
- `classifyCondition`
- `compile`
- `compileMelDomain`
- `compileMelModule`
- `compileMelPatch`
- `createError`
- `createEvaluationContext`
- `createInfo`
- `createLocation`
- `createPointLocation`
- `createPosition`
- `createToken`
- `createWarning`
- `DEFAULT_ACTION_CONTEXT`
- `DEFAULT_DISPATCHABLE_CONTEXT`
- `DEFAULT_PATCH_CONTEXT`
- `DEFAULT_SCHEMA_CONTEXT`
- `DIAGNOSTIC_CODES`
- `EFFECT_ARGS_CONTEXT`
- `evaluateCondition`
- `evaluateConditionalPatchOps`
- `evaluateExpr`
- `evaluatePatches`
- `evaluatePatchExpressions`
- `evaluateRuntimePatches`
- `evaluateRuntimePatchesWithTrace`
- `extractSchemaGraph`
- `extractTypeName`
- `filterBySeverity`
- `formatDiagnostic`
- `formatDiagnosticCode`
- `formatDiagnostics`
- `generate`
- `generateCanonical`
- `getBinaryPrecedence`
- `getDiagnosticInfo`
- `getKeywordKind`
- `hasErrors`
- `invalidKindForContext`
- `invalidShape`
- `invalidSysPath`
- `isBinaryOp`
- `isError`
- `isExprNode`
- `isKeyword`
- `isReserved`
- `isRightAssociative`
- `isStmtNode`
- `isUnaryOp`
- `KEYWORDS`
- `Lexer`
- `lowerExprNode`
- `LoweringError`
- `lowerPatchFragments`
- `lowerRuntimePatch`
- `lowerRuntimePatches`
- `lowerSystemValues`
- `mergeLocations`
- `normalizeExpr`
- `normalizeFunctionCall`
- `parse`
- `Parser`
- `parseSource`
- `Precedence`
- `renderAsDomain`
- `renderExprNode`
- `renderFragment`
- `renderFragments`
- `renderFragmentsByKind`
- `renderPatchOp`
- `renderTypeExpr`
- `renderTypeField`
- `renderValue`
- `RESERVED_KEYWORDS`
- `Scope`
- `ScopeAnalyzer`
- `SemanticValidator`
- `tokenize`
- `tokenToBinaryOp`
- `unknownCallFn`
- `unknownNodeKind`
- `unsupportedBase`
- `validateSemantics`

#### Types

- `ActionNode`
- `ActionSpec`
- `AddActionAvailableOp`
- `AddComputedOp`
- `AddConstraintOp`
- `AddFieldOp`
- `AddTypeOp`
- `AllowedSysPrefix`
- `Annotation`
- `AnnotationExtractionResult`
- `AnnotationIndex`
- `AnnotationNode`
- `ArrayLiteralExprNode`
- `ArrayTypeNode`
- `ASTNode`
- `BinaryExprNode`
- `BinaryOperator`
- `CanonicalDomainSchema`
- `CompileMelDomainOptions`
- `CompileMelDomainResult`
- `CompileMelModuleOptions`
- `CompileMelModuleResult`
- `CompileMelPatchOptions`
- `CompileMelPatchResult`
- `CompileOptions`
- `CompilerActionSpec`
- `CompilerComputedFieldSpec`
- `CompileResult`
- `CompilerExprNode`
- `CompilerFlowNode`
- `CompileTrace`
- `ComputedFieldSpec`
- `ComputedNode`
- `ComputedSpec`
- `ConditionalPatchOp`
- `CoreExprNode`
- `CoreFlowNode`
- `Diagnostic`
- `DiagnosticCode`
- `DiagnosticSeverity`
- `DomainMember`
- `DomainModule`
- `DomainNode`
- `DomainSchema`
- `EffectArgNode`
- `EffectStmtNode`
- `EvaluatedPatch`
- `EvaluatedPatchOp`
- `EvaluationContext`
- `EvaluationMeta`
- `EvaluationSnapshot`
- `ExprLoweringContext`
- `ExprNode`
- `FailStmtNode`
- `FieldSpec`
- `FieldType`
- `FlowDeclNode`
- `FlowStmtNode`
- `FragmentRenderOptions`
- `FunctionCallExprNode`
- `GenerateCanonicalResult`
- `GenerateResult`
- `GuardedStmtNode`
- `IdentifierExprNode`
- `ImportNode`
- `IncludeStmtNode`
- `IndexAccessExprNode`
- `IndexSegmentNode`
- `InnerStmtNode`
- `IRPatchPath`
- `IRPathSegment`
- `IterationVarExprNode`
- `JsonLiteral`
- `LexResult`
- `LiteralExprNode`
- `LiteralTypeNode`
- `LocalTargetKey`
- `LoweredPatchOp`
- `LoweredTypeExpr`
- `LoweredTypeField`
- `LoweringErrorCode`
- `MelExprNode`
- `MelIRPatchPath`
- `MelIRPathSegment`
- `MelObjField`
- `MelPatchFragment`
- `MelPatchOp`
- `MelPathNode`
- `MelPathSegment`
- `MelPrimitive`
- `MelRuntimePatch`
- `MelRuntimePatchOp`
- `MelSystemPath`
- `MelTypeExpr`
- `MelTypeField`
- `ObjectLiteralExprNode`
- `ObjectPropertyNode`
- `ObjectTypeNode`
- `OnceIntentStmtNode`
- `OnceStmtNode`
- `ParamNode`
- `ParseResult`
- `PatchEvaluationResult`
- `PatchFragment`
- `PatchLoweringContext`
- `PatchOp`
- `PatchStmtNode`
- `PathNode`
- `PathSegmentNode`
- `Position`
- `ProgramNode`
- `PropertyAccessExprNode`
- `PropertySegmentNode`
- `RecordTypeNode`
- `RelatedDiagnostic`
- `RendererExprNode`
- `RenderOptions`
- `RuntimeConditionalPatchOp`
- `RuntimePatchEvaluationResult`
- `RuntimePatchSkipReason`
- `SchemaConditionalPatchOp`
- `SchemaGraph`
- `SchemaGraphEdge`
- `SchemaGraphEdgeRelation`
- `SchemaGraphNode`
- `SchemaGraphNodeId`
- `SchemaGraphNodeKind`
- `ScopeAnalysisResult`
- `SetDefaultValueOp`
- `SetFieldTypeOp`
- `SimpleTypeNode`
- `SkippedRuntimePatch`
- `SourceLocation`
- `SourceMapEmissionContext`
- `SourceMapEntry`
- `SourceMapIndex`
- `SourceMapPath`
- `SourcePoint`
- `SourceSpan`
- `StateFieldNode`
- `StateNode`
- `StateSpec`
- `StopStmtNode`
- `Symbol`
- `SymbolKind`
- `SystemIdentExprNode`
- `TernaryExprNode`
- `Token`
- `TokenKind`
- `TypeDeclNode`
- `TypeDefinition`
- `TypeExpr`
- `TypeExprNode`
- `TypeField`
- `TypeFieldNode`
- `TypeSpec`
- `UnaryExprNode`
- `UnionTypeNode`
- `ValidationResult`
- `WhenStmtNode`

### @manifesto-ai/compiler/esbuild

_Source: `packages/compiler/src/esbuild.ts`_

#### Values

- `melPlugin`

#### Types

- `MelCodegenArtifact`
- `MelCodegenEmitter`
- `MelCodegenOptions`
- `MelPluginOptions`

### @manifesto-ai/compiler/loader

_Source: `packages/compiler/src/node-loader.ts`_

#### Values

- `load`
- `resolve`

#### Types

_No named exports detected._

### @manifesto-ai/compiler/node-loader

_Source: `packages/compiler/src/node-loader.ts`_

#### Values

- `load`
- `resolve`

#### Types

_No named exports detected._

### @manifesto-ai/compiler/rollup

_Source: `packages/compiler/src/rollup.ts`_

#### Values

- `melPlugin`

#### Types

- `MelCodegenArtifact`
- `MelCodegenEmitter`
- `MelCodegenOptions`
- `MelPluginOptions`

### @manifesto-ai/compiler/rspack

_Source: `packages/compiler/src/rspack.ts`_

#### Values

- `melPlugin`

#### Types

- `MelCodegenArtifact`
- `MelCodegenEmitter`
- `MelCodegenOptions`
- `MelPluginOptions`

### @manifesto-ai/compiler/vite

_Source: `packages/compiler/src/vite.ts`_

#### Values

- `melPlugin`

#### Types

- `MelCodegenArtifact`
- `MelCodegenEmitter`
- `MelCodegenOptions`
- `MelPluginOptions`

### @manifesto-ai/compiler/webpack

_Source: `packages/compiler/src/webpack.ts`_

#### Values

- `melPlugin`

#### Types

- `MelCodegenArtifact`
- `MelCodegenEmitter`
- `MelCodegenOptions`
- `MelPluginOptions`

## @manifesto-ai/core

### @manifesto-ai/core

_Source: `packages/core/src/index.ts`_

#### Values

- `AbsExpr`
- `ActionSpec`
- `AddExpr`
- `AndExpr`
- `AppendExpr`
- `apply`
- `applySystemDelta`
- `AtExpr`
- `buildDependencyGraph`
- `CallFlow`
- `canonicalEqual`
- `CeilExpr`
- `CoalesceExpr`
- `compareUnicodeCodePoints`
- `compute`
- `ComputedFieldSpec`
- `ComputedSpec`
- `ComputeResult`
- `ComputeStatus`
- `computeSync`
- `ConcatExpr`
- `CoreErrorCode`
- `createContext`
- `createCore`
- `createError`
- `createFlowState`
- `createInitialSystemState`
- `createIntent`
- `createSnapshot`
- `createTraceContext`
- `createTraceNode`
- `detectCycles`
- `DivExpr`
- `DomainSchema`
- `EffectFlow`
- `EndsWithExpr`
- `EntriesExpr`
- `EnumFieldType`
- `EqExpr`
- `err`
- `ErrorValue`
- `evaluateComputed`
- `evaluateExpr`
- `evaluateFlow`
- `evaluateFlowSync`
- `evaluateSingleComputed`
- `EveryExpr`
- `explain`
- `ExplainResult`
- `ExprKind`
- `ExprNodeSchema`
- `extractDefaults`
- `FailFlow`
- `FieldExpr`
- `FieldSpec`
- `FieldType`
- `FilterExpr`
- `FindExpr`
- `FirstExpr`
- `FlatExpr`
- `FloorExpr`
- `FlowKind`
- `FlowNodeSchema`
- `FlowPosition`
- `fromCanonical`
- `FromEntriesExpr`
- `generateRequirementId`
- `generateRequirementIdSync`
- `generateTraceId`
- `getAvailableActions`
- `getByPatchPath`
- `getByPath`
- `GetExpr`
- `getTransitiveDeps`
- `GteExpr`
- `GtExpr`
- `HaltFlow`
- `hashSchema`
- `hashSchemaEffective`
- `hashSchemaEffectiveSync`
- `hashSchemaSync`
- `HasKeyExpr`
- `hasPath`
- `HostContext`
- `IfExpr`
- `IfFlow`
- `IncludesExpr`
- `IndexOfExpr`
- `indexSegment`
- `Intent`
- `invalidResult`
- `isActionAvailable`
- `isErr`
- `isErrorValue`
- `isIntentDispatchable`
- `IsNullExpr`
- `isOk`
- `isSafePatchPath`
- `joinPath`
- `KeysExpr`
- `LastExpr`
- `lastSegment`
- `LenExpr`
- `LitExpr`
- `LteExpr`
- `LtExpr`
- `MapExpr`
- `MaxArrayExpr`
- `MaxExpr`
- `mergeAtPatchPath`
- `mergeAtPath`
- `MergeExpr`
- `mergePatch`
- `MinArrayExpr`
- `MinExpr`
- `ModExpr`
- `MulExpr`
- `NegExpr`
- `NeqExpr`
- `NotExpr`
- `ObjectExpr`
- `ok`
- `OmitExpr`
- `OrExpr`
- `parentPath`
- `parsePath`
- `Patch`
- `PatchFlow`
- `PatchOp`
- `PatchPath`
- `patchPathToDisplayString`
- `PatchSegment`
- `PickExpr`
- `PowExpr`
- `PrimitiveFieldType`
- `propSegment`
- `ReplaceExpr`
- `Requirement`
- `Result`
- `ReverseExpr`
- `RoundExpr`
- `SchemaMeta`
- `SemanticPath`
- `semanticPathToPatchPath`
- `SeqFlow`
- `setByPatchPath`
- `setByPath`
- `setPatch`
- `sha256`
- `sha256Sync`
- `SliceExpr`
- `Snapshot`
- `SnapshotMeta`
- `SomeExpr`
- `sortKeys`
- `SplitExpr`
- `SqrtExpr`
- `StartsWithExpr`
- `StateSpec`
- `StrIncludesExpr`
- `StrLenExpr`
- `SubExpr`
- `SubstringExpr`
- `SumArrayExpr`
- `SystemDelta`
- `SystemState`
- `ToBooleanExpr`
- `toCanonical`
- `toJcs`
- `ToLowerCaseExpr`
- `ToNumberExpr`
- `topologicalSort`
- `ToStringExpr`
- `ToUpperCaseExpr`
- `TraceGraph`
- `TraceNode`
- `TraceNodeKind`
- `TraceTermination`
- `TrimExpr`
- `TypeDefinition`
- `TypeofExpr`
- `TypeSpec`
- `UniqueExpr`
- `unsetByPatchPath`
- `unsetByPath`
- `unsetPatch`
- `validate`
- `validateIntentInput`
- `ValidationError`
- `ValidationResult`
- `validResult`
- `ValuesExpr`
- `withCollectionContext`
- `withNodePath`
- `withSnapshot`

#### Types

- `AbsExpr`
- `ActionSpec`
- `AddExpr`
- `AndExpr`
- `AppendExpr`
- `AtExpr`
- `CallFlow`
- `CeilExpr`
- `CoalesceExpr`
- `ComputedFieldSpec`
- `ComputedSpec`
- `ComputeResult`
- `ComputeStatus`
- `ConcatExpr`
- `CoreErrorCode`
- `DependencyGraph`
- `DivExpr`
- `DomainSchema`
- `EffectFlow`
- `EndsWithExpr`
- `EntriesExpr`
- `EnumFieldType`
- `EqExpr`
- `ErrorValue`
- `EvalContext`
- `EveryExpr`
- `ExplainResult`
- `ExprKind`
- `ExprNode`
- `ExprResult`
- `FailFlow`
- `FieldExpr`
- `FieldSpec`
- `FieldType`
- `FilterExpr`
- `FindExpr`
- `FirstExpr`
- `FlatExpr`
- `FloorExpr`
- `FlowKind`
- `FlowNode`
- `FlowPosition`
- `FlowResult`
- `FlowState`
- `FlowStatus`
- `FromEntriesExpr`
- `GetExpr`
- `GteExpr`
- `GtExpr`
- `HaltFlow`
- `HasKeyExpr`
- `HostContext`
- `IfExpr`
- `IfFlow`
- `IncludesExpr`
- `IndexOfExpr`
- `Intent`
- `IsNullExpr`
- `KeysExpr`
- `LastExpr`
- `LenExpr`
- `LitExpr`
- `LteExpr`
- `LtExpr`
- `ManifestoCore`
- `MapExpr`
- `MaxArrayExpr`
- `MaxExpr`
- `MergeExpr`
- `MergePatch`
- `MinArrayExpr`
- `MinExpr`
- `ModExpr`
- `MulExpr`
- `NegExpr`
- `NeqExpr`
- `NotExpr`
- `ObjectExpr`
- `OmitExpr`
- `OrExpr`
- `Patch`
- `PatchFlow`
- `PatchOp`
- `PatchPath`
- `PatchSegment`
- `PickExpr`
- `PowExpr`
- `PrimitiveFieldType`
- `ReplaceExpr`
- `Requirement`
- `Result`
- `ReverseExpr`
- `RoundExpr`
- `SchemaHashInput`
- `SchemaHashMode`
- `SchemaMeta`
- `SemanticPath`
- `SeqFlow`
- `SetPatch`
- `SliceExpr`
- `Snapshot`
- `SnapshotMeta`
- `SomeExpr`
- `SplitExpr`
- `SqrtExpr`
- `StartsWithExpr`
- `StateSpec`
- `StrIncludesExpr`
- `StrLenExpr`
- `SubExpr`
- `SubstringExpr`
- `SumArrayExpr`
- `SystemDelta`
- `SystemState`
- `ToBooleanExpr`
- `ToLowerCaseExpr`
- `ToNumberExpr`
- `ToStringExpr`
- `ToUpperCaseExpr`
- `TraceContext`
- `TraceGraph`
- `TraceNode`
- `TraceNodeKind`
- `TraceTermination`
- `TrimExpr`
- `TypeDefinition`
- `TypeofExpr`
- `TypeSpec`
- `UniqueExpr`
- `UnsetPatch`
- `ValidationError`
- `ValidationResult`
- `ValuesExpr`

## @manifesto-ai/governance

### @manifesto-ai/governance

_Source: `packages/governance/src/index.ts`_

#### Values

- `createInMemoryGovernanceStore`
- `createNoopGovernanceEventSink`
- `waitForProposal`
- `waitForProposalWithReport`
- `withGovernance`

#### Types

- `ActorAuthorityBinding`
- `ActorId`
- `ActorKind`
- `ActorRef`
- `AuthorityId`
- `AuthorityKind`
- `AuthorityPolicy`
- `AuthorityRef`
- `DecisionId`
- `DecisionRecord`
- `ErrorInfo`
- `FinalDecision`
- `GovernanceComposableManifesto`
- `GovernanceConfig`
- `GovernanceEvent`
- `GovernanceEventSink`
- `GovernanceEventType`
- `GovernanceExecutionConfig`
- `GovernanceInstance`
- `IntentScope`
- `PolicyCondition`
- `PolicyRule`
- `Proposal`
- `ProposalId`
- `ProposalSettlement`
- `ProposalSettlementReport`
- `ProposalStatus`
- `QuorumRule`
- `SourceKind`
- `SourceRef`
- `SupersedeReason`
- `Vote`
- `WaitForProposalOptions`
- `WaitingFor`

### @manifesto-ai/governance/provider

_Source: `packages/governance/src/provider.ts`_

#### Values

- `AuthorityEvaluator`
- `AutoApproveHandler`
- `computeIntentKey`
- `createAuthorityEvaluator`
- `createAutoApproveHandler`
- `createDecisionId`
- `createExecutionKey`
- `createGovernanceEventDispatcher`
- `createGovernanceService`
- `createHITLHandler`
- `createInMemoryGovernanceStore`
- `createIntentInstance`
- `createIntentInstanceSync`
- `createNoopGovernanceEventSink`
- `createPolicyRulesHandler`
- `createProposalId`
- `createTribunalHandler`
- `DECISION_TRANSITION_TARGETS`
- `defaultExecutionKeyPolicy`
- `DefaultGovernanceService`
- `EXECUTION_STAGE_STATUSES`
- `getValidTransitions`
- `HITLHandler`
- `INGRESS_STATUSES`
- `InMemoryGovernanceStore`
- `isExecutionStageStatus`
- `isIngressStatus`
- `isTerminalStatus`
- `isValidTransition`
- `PolicyRulesHandler`
- `TERMINAL_STATUSES`
- `toHostIntent`
- `transitionCreatesDecisionRecord`
- `TribunalHandler`

#### Types

- `ActorAuthorityBinding`
- `ActorId`
- `ActorKind`
- `ActorRef`
- `AuthorityHandler`
- `AuthorityId`
- `AuthorityKind`
- `AuthorityPolicy`
- `AuthorityRef`
- `CreateGovernanceEventDispatcherOptions`
- `CreateIntentInstanceOptions`
- `CustomConditionEvaluator`
- `DecisionId`
- `DecisionRecord`
- `ErrorInfo`
- `ExecutionKey`
- `ExecutionKeyContext`
- `ExecutionKeyPolicy`
- `FinalDecision`
- `GovernanceEvent`
- `GovernanceEventDispatcher`
- `GovernanceEventSink`
- `GovernanceEventType`
- `GovernanceService`
- `GovernanceStore`
- `HITLDecisionCallback`
- `HITLNotificationCallback`
- `HITLPendingState`
- `Intent`
- `IntentBody`
- `IntentInstance`
- `IntentOrigin`
- `IntentScope`
- `PolicyCondition`
- `PolicyRule`
- `PreparedGovernanceCommit`
- `Proposal`
- `ProposalId`
- `ProposalStatus`
- `QuorumRule`
- `SourceKind`
- `SourceRef`
- `SupersedeReason`
- `TribunalNotificationCallback`
- `Vote`
- `WaitingFor`

## @manifesto-ai/host

### @manifesto-ai/host

_Source: `packages/host/src/index.ts`_

#### Values

- `createApplyPatchesJob`
- `createContinueComputeJob`
- `createEffectExecutor`
- `createEffectRegistry`
- `createExecutionContext`
- `createFulfillEffectJob`
- `createHost`
- `createHostContextProvider`
- `createHostError`
- `createIntent`
- `createMailbox`
- `createMailboxManager`
- `createRunnerState`
- `createSnapshot`
- `createStartIntentJob`
- `createTestHostContextProvider`
- `DefaultExecutionMailbox`
- `DefaultHostContextProvider`
- `defaultRuntime`
- `EffectExecutor`
- `EffectHandlerRegistry`
- `enqueueAndKick`
- `ExecutionContextImpl`
- `generateJobId`
- `getHostState`
- `getIntentSlot`
- `handleApplyPatches`
- `handleContinueCompute`
- `handleFulfillEffect`
- `handleStartIntent`
- `HostError`
- `isHostError`
- `isKickPending`
- `isRunnerActive`
- `kickRunner`
- `MailboxManager`
- `ManifestoHost`
- `processMailbox`
- `runJob`

#### Types

- `ApplyPatchesJob`
- `ComputeResult`
- `ContinueComputeJob`
- `DomainSchema`
- `EffectContext`
- `EffectErrorInfo`
- `EffectHandler`
- `EffectHandlerOptions`
- `EffectResult`
- `ExecutionContext`
- `ExecutionContextImplOptions`
- `ExecutionContextOptions`
- `ExecutionKey`
- `ExecutionMailbox`
- `FulfillEffectJob`
- `HostContextProvider`
- `HostContextProviderOptions`
- `HostErrorCode`
- `HostOptions`
- `HostOwnedState`
- `HostResult`
- `Intent`
- `IntentSlot`
- `Job`
- `JobType`
- `Patch`
- `RegisteredHandler`
- `Requirement`
- `RunnerState`
- `Runtime`
- `Snapshot`
- `StartIntentJob`
- `TraceEvent`
- `TraceGraph`

## @manifesto-ai/lineage

### @manifesto-ai/lineage

_Source: `packages/lineage/src/index.ts`_

#### Values

- `createInMemoryLineageStore`
- `InMemoryLineageStore`
- `withLineage`

#### Types

- `ArtifactRef`
- `BranchId`
- `BranchInfo`
- `BranchSwitchResult`
- `CommitReport`
- `LineageConfig`
- `LineageInstance`
- `World`
- `WorldHead`
- `WorldId`
- `WorldLineage`

### @manifesto-ai/lineage/provider

_Source: `packages/lineage/src/provider.ts`_

#### Values

- `attachLineageDecoration`
- `createInMemoryLineageStore`
- `createLineageRuntimeController`
- `createLineageService`
- `DefaultLineageService`
- `getLineageDecoration`
- `InMemoryLineageStore`

#### Types

- `AttemptId`
- `BranchId`
- `BranchInfo`
- `BranchSwitchResult`
- `LineageDecoration`
- `LineageRuntimeController`
- `LineageService`
- `LineageStore`
- `PersistedPatchDeltaV2`
- `PreparedBranchBootstrap`
- `PreparedBranchChange`
- `PreparedBranchMutation`
- `PreparedGenesisCommit`
- `PreparedLineageCommit`
- `PreparedLineageRecords`
- `PreparedNextCommit`
- `ProvenanceRef`
- `ResolvedLineageConfig`
- `SealAttempt`
- `SealedIntentResult`
- `SealGenesisInput`
- `SealIntentOptions`
- `SealNextInput`
- `SnapshotHashInput`
- `World`
- `WorldEdge`
- `WorldHead`
- `WorldId`
- `WorldLineage`

## @manifesto-ai/sdk

### @manifesto-ai/sdk

_Source: `packages/sdk/src/index.ts`_

#### Values

- `AlreadyActivatedError`
- `CompileError`
- `createManifesto`
- `createSnapshot`
- `DisposedError`
- `ManifestoError`
- `ReservedEffectError`

#### Types

- `ActionArgs`
- `ActionObjectBindingArgs`
- `ActivatedInstance`
- `AvailableActionDelta`
- `BaseComposableLaws`
- `BaseLaws`
- `CanonicalOutcome`
- `CanonicalPlatformNamespaces`
- `CanonicalSnapshot`
- `CompileDiagnostic`
- `ComposableManifesto`
- `ComputedRef`
- `CoreSnapshot`
- `CreateIntentArgs`
- `DispatchBlocker`
- `DispatchReport`
- `DomainSchema`
- `EffectContext`
- `EffectHandler`
- `ExecutionDiagnostics`
- `ExecutionFailureInfo`
- `ExecutionOutcome`
- `FieldRef`
- `GovernanceLaws`
- `GovernedComposableLaws`
- `Intent`
- `IntentAdmission`
- `IntentAdmissionFailure`
- `IntentExplanation`
- `InvalidInputInfo`
- `LineageComposableLaws`
- `LineageLaws`
- `ManifestoBaseInstance`
- `ManifestoDecoratedRuntimeByLaws`
- `ManifestoDomainShape`
- `ManifestoEvent`
- `ManifestoEventMap`
- `ManifestoEventPayload`
- `ManifestoRuntimeByLaws`
- `Patch`
- `ProjectedDiff`
- `SchemaGraph`
- `SchemaGraphEdge`
- `SchemaGraphEdgeRelation`
- `SchemaGraphNode`
- `SchemaGraphNodeId`
- `SchemaGraphNodeKind`
- `SchemaGraphNodeRef`
- `SdkManifest`
- `Selector`
- `SimulateResult`
- `Snapshot`
- `TypedActionMetadata`
- `TypedActionRef`
- `TypedCommitAsync`
- `TypedCreateIntent`
- `TypedDispatchAsync`
- `TypedGetActionMetadata`
- `TypedGetIntentBlockers`
- `TypedIntent`
- `TypedIsIntentDispatchable`
- `TypedMEL`
- `TypedOn`
- `TypedSimulate`
- `TypedSubscribe`
- `Unsubscribe`

### @manifesto-ai/sdk/effects

_Source: `packages/sdk/src/effects.ts`_

#### Values

- `defineEffects`

#### Types

- `PatchBuilder`

### @manifesto-ai/sdk/extensions

_Source: `packages/sdk/src/extensions.ts`_

#### Values

- `createSimulationSession`
- `getExtensionKernel`

#### Types

- `ExtensionKernel`
- `ExtensionSimulateResult`
- `SimulationActionRef`
- `SimulationSession`
- `SimulationSessionResult`
- `SimulationSessionStatus`
- `SimulationSessionStep`

### @manifesto-ai/sdk/provider

_Source: `packages/sdk/src/provider.ts`_

#### Values

- `activateComposable`
- `assertComposableNotActivated`
- `attachExtensionKernel`
- `attachRuntimeKernelFactory`
- `createBaseRuntimeInstance`
- `createRuntimeKernel`
- `getActivationState`
- `getRuntimeKernelFactory`

#### Types

- `ActivationState`
- `GovernanceRuntimeKernel`
- `GovernanceRuntimeKernelFactory`
- `HostDispatchOptions`
- `LineageRuntimeKernel`
- `LineageRuntimeKernelFactory`
- `RuntimeKernel`
- `RuntimeKernelFactory`
- `SimulateResult`
- `WaitForProposalRuntimeKernel`
