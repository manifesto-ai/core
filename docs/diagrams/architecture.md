# Architecture Diagrams

Visual diagrams explaining Manifesto's architecture and data flow.

## Package Overview

```mermaid
graph TB
    subgraph Packages
        Core["@manifesto-ai/core"]
        Compiler["@manifesto-ai/compiler"]
        Bridge["@manifesto-ai/bridge-react"]
    end

    subgraph "Core Modules"
        Domain[Domain Definition]
        Expression[Expression DSL]
        Effect[Effect System]
        DAG[DAG Propagation]
        Runtime[Runtime]
        Policy[Policy Evaluation]
        Projection[Projection]
    end

    subgraph "Compiler Modules"
        Pass[Pass System]
        Linker[Linker]
        Verifier[Verifier]
        LLM[LLM Adapters]
    end

    subgraph "Bridge Modules"
        Provider[RuntimeProvider]
        Hooks[React Hooks]
    end

    Core --> Bridge
    Core --> Compiler
    Domain --> Runtime
    Expression --> Runtime
    Effect --> Runtime
    DAG --> Runtime
    Policy --> Runtime
    Runtime --> Provider
    Provider --> Hooks
```

## Core Data Flow

```mermaid
flowchart LR
    subgraph Input
        User[User Action]
        AI[AI Agent]
    end

    subgraph Runtime
        Action[Action Dispatch]
        Precond[Precondition Check]
        Effect[Effect Execution]
        DAG[DAG Propagation]
        Notify[Subscription Notify]
    end

    subgraph Output
        State[Updated State]
        React[React Re-render]
    end

    User --> Action
    AI --> Action
    Action --> Precond
    Precond -->|Pass| Effect
    Precond -->|Fail| Reject[Rejection]
    Effect --> DAG
    DAG --> Notify
    Notify --> State
    State --> React
```

## Semantic Path Structure

```mermaid
graph TD
    subgraph Paths["Semantic Paths"]
        Data["data.*<br/>(Source Paths)"]
        State["state.*<br/>(UI State)"]
        Derived["derived.*<br/>(Computed)"]
        Async["async.*<br/>(Async Operations)"]
    end

    subgraph DataPaths["data.* Examples"]
        DataUser["data.user.name"]
        DataItems["data.items"]
        DataCount["data.count"]
    end

    subgraph DerivedPaths["derived.* Examples"]
        Total["derived.totalPrice"]
        Valid["derived.isValid"]
        Filtered["derived.filteredItems"]
    end

    Data --> DataPaths
    Derived --> DerivedPaths
    DataPaths -.->|deps| DerivedPaths
```

## Expression Evaluation

```mermaid
flowchart TD
    Expr["Expression<br/>['*', ['get', 'data.x'], 2]"]

    subgraph Parse
        Validate[Validate Structure]
        Extract[Extract Dependencies]
    end

    subgraph Evaluate
        Resolve[Resolve Path Values]
        Compute[Compute Result]
    end

    Expr --> Validate
    Validate --> Extract
    Extract --> Resolve
    Resolve --> Compute
    Compute --> Result[Result Value]
```

## Effect System

```mermaid
flowchart TB
    subgraph "Effect Types"
        SetValue["setValue<br/>(path, value)"]
        SetState["setState<br/>(path, value)"]
        ApiCall["apiCall<br/>(endpoint, options)"]
        Navigate["navigate<br/>(path)"]
        Delay["delay<br/>(ms)"]
    end

    subgraph "Combinators"
        Sequence["sequence<br/>[effect1, effect2]"]
        Parallel["parallel<br/>[effect1, effect2]"]
        Conditional["conditional<br/>(cond, then, else)"]
        Catch["catch<br/>(effect, handler)"]
    end

    SetValue --> Sequence
    SetState --> Sequence
    ApiCall --> Parallel
    Navigate --> Conditional
    Delay --> Catch
```

## DAG Propagation

```mermaid
graph LR
    subgraph Sources
        A["data.price"]
        B["data.quantity"]
    end

    subgraph Derived
        C["derived.subtotal<br/>price * quantity"]
        D["derived.tax<br/>subtotal * 0.1"]
        E["derived.total<br/>subtotal + tax"]
    end

    A --> C
    B --> C
    C --> D
    C --> E
    D --> E

    style A fill:#e0f2fe
    style B fill:#e0f2fe
    style C fill:#fef3c7
    style D fill:#fef3c7
    style E fill:#dcfce7
```

## Compiler Pipeline

```mermaid
flowchart LR
    subgraph Input
        TS[TypeScript Code]
        Design[Design Spec]
    end

    subgraph "Compilation"
        Parse[Parse]
        Pass1[SchemaPass]
        Pass2[DerivedPass]
        Pass3[ActionPass]
        Pass4[AsyncPass]
        Pass5[PolicyPass]
        Pass6[MetadataPass]
        Pass7[FragmentPass]
    end

    subgraph "Linking"
        Merge[Fragment Merge]
        Conflict[Conflict Detection]
        Build[Domain Build]
    end

    subgraph "Verification"
        Validate[Validate Domain]
        Report[Issue Report]
    end

    TS --> Parse
    Design --> Parse
    Parse --> Pass1 --> Pass2 --> Pass3 --> Pass4 --> Pass5 --> Pass6 --> Pass7
    Pass7 --> Merge
    Merge --> Conflict
    Conflict --> Build
    Build --> Validate
    Validate --> Report
```

## React Integration

```mermaid
flowchart TB
    subgraph "Provider Setup"
        Domain[Domain Definition]
        Runtime[createRuntime]
        Provider[RuntimeProvider]
    end

    subgraph "Component Hooks"
        useValue[useValue]
        useSetValue[useSetValue]
        useDerived[useDerived]
        useAction[useAction]
    end

    subgraph "React Rendering"
        Subscribe[useSyncExternalStore]
        Render[Component Render]
    end

    Domain --> Runtime
    Runtime --> Provider
    Provider --> useValue
    Provider --> useSetValue
    Provider --> useDerived
    Provider --> useAction
    useValue --> Subscribe
    useDerived --> Subscribe
    Subscribe --> Render
```

## AI Agent Integration

```mermaid
sequenceDiagram
    participant AI as AI Agent
    participant Proj as Projection
    participant Runtime as Runtime
    participant DAG as DAG

    AI->>Proj: Request Context
    Proj->>Runtime: Get Snapshot
    Runtime-->>Proj: Current State
    Proj-->>AI: Projected Context

    AI->>AI: Decide Action
    AI->>Runtime: Execute Action
    Runtime->>Runtime: Check Preconditions
    Runtime->>Runtime: Execute Effect
    Runtime->>DAG: Propagate Changes
    DAG-->>Runtime: Updated State
    Runtime-->>AI: Action Result
```

## Domain Validation Flow

```mermaid
flowchart TD
    Domain[Domain Definition]

    subgraph Checks
        ID[Check ID/Name]
        Paths[Collect All Paths]
        Deps[Check Dependencies]
        Cycles[Detect Cycles]
        Actions[Validate Actions]
    end

    subgraph Result
        Valid[Valid Domain]
        Issues[Validation Issues]
    end

    Domain --> ID
    ID --> Paths
    Paths --> Deps
    Deps --> Cycles
    Cycles --> Actions
    Actions -->|No Errors| Valid
    Actions -->|Has Errors| Issues
```
