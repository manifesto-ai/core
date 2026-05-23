---
layout: home

hero:
  name: Manifesto
  text: One Domain Model For Apps And Agents
  tagline: Define your domain once in MEL, then run the same actions from your app, UI, backend, and agents.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/quick-start
    - theme: alt
      text: Learn Step By Step
      link: /guide/introduction

features:
  - icon:
      src: /icons/deterministic.svg
      width: 48
      height: 48
    title: Deterministic by Design
    details: The same domain, snapshot, and action input produce the same next snapshot.
  - icon:
      src: /icons/multiplatform.svg
      width: 48
      height: 48
    title: Frontend, Backend, and Agents
    details: Use the same domain model to power UI, backend services, and agent workflows without rewriting the rules for each surface.
  - icon:
      src: /icons/snapshot.svg
      width: 48
      height: 48
    title: One App State
    details: Submit an action, read the updated app state, and give UI and agent code the same view.
---

## Quick Example

<HomeCodeExample />

## Learn In Order

| Step | Read | You Can Build Afterward |
|------|------|-------------------------|
| 1 | [Quick Start](/guide/quick-start) | One MEL domain running through the SDK |
| 2 | [Project Anatomy](/guide/project-anatomy) | Know where domain, runtime, UI, and agent files go |
| 3 | [MEL Domain Basics](/guide/essentials/mel-domain-basics) and [MEL For App Developers](/guide/essentials/mel-for-app-developers) | Understand the `.mel` file before it grows |
| 4 | [Creating an App](/guide/essentials/creating-an-app) | Activate the runtime and read snapshots from TypeScript |
| 5 | [Tutorial](/tutorial/) | Build a small Todo app before adding a UI framework |
| 6 | [Bundler Setup](/guides/bundler-setup) and [Code Generation](/guides/code-generation) | Emit the generated Todo facade from the same `.mel` file |
| 7 | [React](/integration/react) and [Runnable Examples](/guide/runnable-examples) | Connect a browser UI and compare it with a working app |
| 8 | [Web App + Agent](/integration/web-app-and-agent) | Put UI and agent writes behind one shared server runtime |
| 9 | [AI Agents](/integration/ai-agents) | Go deeper on agent-only tool loops and server workers |

Stay on the base SDK runtime until the app path is clear. Add
[approval or history](/guides/approval-and-history) only when writes need
review, actor records, or durable history.

## What You Do Not Need First

- low-level package APIs
- raw runtime schema objects
- approval/history runtime setup
- full MEL grammar tables
- package-level internals

Open those pages when a guide sends you there.
