title = "Builder Overview"
description = "A complete beginner-friendly guide to the Edgaze builder system, including Workflow Studio, Prompt Studio, Templates, and API Vault."

# Builder Overview

The Edgaze builder system is designed to help you turn an idea into a working AI product without needing to understand low-level code, orchestration, or model plumbing first.

If you are brand new, start here. This page explains what each builder surface does, how they fit together, and which one to open first.

## On This Page

- What the builder system is
- The four builder surfaces
- Which tool to use first
- A simple publishing flow
- Example workflow patterns
- Recommended learning path

## What The Builder System Is

Edgaze gives you a connected set of product-building tools:

- **Workflow Studio** for multi-step products with connected blocks
- **Prompt Studio** for single prompt products with structured user inputs
- **Templates** for outcome-first starting points that create an editable workflow for you
- **API Vault** for securely connecting the provider keys your products need

The important idea is simple:

- You are not building code.
- You are building an outcome.
- Edgaze handles the structure, runtime, and product packaging around that outcome.

## The Four Builder Surfaces

### Workflow Studio

Workflow Studio is the visual graph builder. You place blocks on a canvas, connect them, configure them in the inspector, and run the workflow end to end.

Use Workflow Studio when you need:

- More than one step
- Multiple model calls
- Branching or merging logic
- Structured inputs and outputs
- A product that should stay editable after setup

[Open the Workflow Studio guide](/docs/builder/workflow-studio)

### Prompt Studio

Prompt Studio is the fastest way to package a great prompt into a reusable product. You write one prompt, define the user inputs it needs, test it, and publish it.

Use Prompt Studio when you need:

- One strong prompt instead of a graph
- A lightweight product with fewer moving parts
- A clean customer form instead of a block canvas
- Fast iteration on prompt wording

[Open the Prompt Studio guide](/docs/builder/prompt-studio)

### Templates

Templates are guided workflow starters. Instead of beginning with a blank graph, you choose an outcome, answer a few setup questions, and land in the builder with an editable workflow already assembled.

Use Templates when you want:

- Faster starts
- Better defaults
- Less manual graph assembly
- A guided setup before entering the builder

[Open the Templates guide](/docs/builder/templates)

### API Vault

API Vault is where Edgaze stores your model provider keys securely and connects them to the nodes that need them.

Use API Vault when you need:

- Your own OpenAI, Anthropic, or Google model access
- Vault-backed execution in Workflow Studio
- A cleaner setup than pasting secrets into individual nodes

[Open the API Vault guide](/docs/builder/api-vault)

## Which Tool To Use First

Use this rule of thumb:

- Choose **Prompt Studio** if one prompt can solve the whole job.
- Choose **Workflow Studio** if the product needs multiple connected steps.
- Choose **Templates** if you know the outcome you want, but do not want to build the graph from scratch.
- Set up **API Vault** as soon as you want reliable provider-backed runs using your own keys.

### Start With Prompt Studio

Choose Prompt Studio first when the product can be expressed as one strong prompt with structured user inputs.

### Start With Workflow Studio

Choose Workflow Studio first when the product needs connected logic, multiple steps, or richer orchestration.

### Start With Templates

Choose Templates first when speed and guided structure matter more than starting from a blank graph.

## The Core Builder Flow

Most creator journeys in Edgaze follow the same shape:

1. Start with a blank builder or a template.
2. Define what the customer should provide.
3. Configure the model or workflow logic.
4. Test with real examples.
5. Publish with clear positioning and pricing.

That is the system in one sentence:

**Collect input, transform it intelligently, test the result, then package it as a product.**

## Example Workflow Patterns

Here are three simple patterns to keep in your head while building.

### Pattern 1: Single Prompt Product

Best for simple writing, analysis, and transformation tasks.

```text
Customer Input -> Prompt -> Output
```

This is usually a Prompt Studio product.

### Pattern 2: Guided AI Workflow

Best for structured AI products that need multiple steps.

```text
Input -> Merge -> Prompt Optimiser -> LLM Or Image Node -> Output
```

This is usually a Workflow Studio or Template-based product.

### Pattern 3: Multi-Input Creative Workflow

Best for products that combine several ideas before generation.

```text
Input 1 ----\
Input 2 ----- Merge A --\
Input 3 ----/            \
Input 4 ----------------- Merge B -> Prompt Optimiser -> Generator -> Output
Input 5 ----------------/
```

This is the pattern behind guided creative templates such as AI Art Creator.

```docsgraph
ai-art-creator
```

## A Good Beginner Workflow

If you are just getting started, this is the easiest path:

1. Open Templates and pick a proven starting point.
2. Answer the setup questions.
3. Run the workflow once with realistic input.
4. Open the inspector and tweak only what matters.
5. Publish after you have seen at least one good result.

This approach keeps the learning curve low without trapping you in a rigid product.

## Recommended Learning Path

If you know nothing yet, use this order:

1. Read this page.
2. Read [Workflow Studio](/docs/builder/workflow-studio) if you want full graph control.
3. Read [Templates](/docs/builder/templates) if you want guided workflow starts.
4. Read [API Vault](/docs/builder/api-vault) before using your own provider accounts.
5. Read [Prompt Studio](/docs/builder/prompt-studio) if you want smaller prompt-first products.

### If You Want Full Control

Go from Builder Overview into Workflow Studio first.

### If You Want The Fastest Start

Go from Builder Overview into Templates first.

### If You Need Provider Access

Read API Vault early so provider-backed runs make sense before you publish.

## Publishing Mindset

The best Edgaze products are not just technically correct. They are also easy for a customer to understand.

### Outcome Clarity

Your title and description should describe what the product achieves.

### Input Clarity

The customer should immediately understand what they need to provide.

### Output Clarity

The final result should feel intentional, complete, and productized.

Before you publish, make sure you can answer:

- What outcome does this product create?
- What should the customer provide?
- What does the customer get back?
- Why is this easier than doing it manually?

If those answers are clear, the builder usually becomes easier too.

## Next Step

If you want the main product-building guide, go to [Workflow Studio](/docs/builder/workflow-studio).

If you want the fastest route to a working graph, go to [Templates](/docs/builder/templates).
