title = "Templates"
description = "Learn how Edgaze templates work, how guided setup flows create editable workflows, and how to start from outcomes instead of raw nodes."

# Templates

Templates are the fastest way to start building in Edgaze when you know the result you want but do not want to assemble a graph from scratch.

Instead of asking you to think in nodes first, templates let you think in outcomes first.

## On This Page

- What templates are
- Where templates appear
- How guided setup works
- What happens after you click Use template
- Example template structure
- When to use templates vs blank builder

## What Templates Are

### Definition Layer

A template has its own metadata, preview, setup schema, and workflow blueprint.

### Instantiation Layer

The final workflow is created from the template definition and the user's answers.

A template is not just a copied workflow file.

A template in Edgaze is a structured system with:

- product metadata
- a preview graph
- a guided setup schema
- an underlying workflow blueprint
- deterministic instantiation rules

That matters because the workflow created from a template still needs to be reliable, editable, and easy to understand once it lands in the builder.

## Where Templates Appear

### Standalone Library

The `/templates` route is for discovery, browsing, and detail-page evaluation.

### Builder Modal

The in-builder modal is for fast insertion while a creator is already working.

Templates appear in two places:

- the standalone library at `/templates`
- the template modal inside Workflow Studio

These are two entry points into the same underlying template system. They should feel like the same product surface because they are reading from the same source of truth.

## How Guided Setup Works

### Outcome First

The user should answer outcome-focused questions before seeing the final graph.

### Setup Before Builder

This reduces low-level builder work and makes the workflow feel immediately usable.

Some templates can be used instantly. Others ask a few setup questions first.

The right experience is:

1. Choose the template.
2. Answer a small number of guided questions.
3. Let Edgaze build the initial workflow for you.
4. Open that workflow in Workflow Studio as a normal editable graph.

This is important because good template UX should absorb complexity before the builder opens.

## Guided Setup Should Feel Like Product, Not Dev Tooling

A strong setup step asks questions like:

- How many inputs should this workflow use?
- What should the prompt optimiser focus on?
- Which model should this use?
- What output shape do you want?

It should not force the user to understand:

- node configuration paths
- handle mapping
- raw internal prompt plumbing

### Good Guided Questions

Good setup questions explain the decision in the language of the outcome.

### Bad Guided Questions

Bad setup questions expose internal graph mechanics that should stay abstracted.

## What Happens After You Click Use Template

After guided setup is complete, Edgaze instantiates a real workflow from the template definition.

That generated workflow:

- uses normal builder primitives
- appears in Workflow Studio as a normal graph
- can still be edited block by block afterward

Templates are meant to accelerate creation, not hide the workflow forever.

### Editable After Generation

The generated workflow should still be inspectable and editable in Workflow Studio.

## Example: AI Art Creator

AI Art Creator is a guided creative workflow template.

Its guided setup can ask for:

- number of inputs
- the question and format for each input
- prompt optimiser instructions
- image model
- aspect ratio

The resulting workflow can look like this:

```docsgraph
ai-art-creator
```

If the selected input count is three or fewer, the graph can stay simpler and use one merge path instead of two.

### Why This Graph Works

It keeps the input gathering layer separate from the optimisation and generation layer.

## Template Detail Pages

### What A Detail Page Should Explain

A detail page should make the workflow understandable before the builder opens.

### What A Detail Page Should Avoid

It should avoid dumping raw internal implementation detail onto the user.

Template detail pages exist so a user can evaluate the product before opening the builder.

A good detail page should answer:

- what this template creates
- what setup the user will be asked for
- what the graph shape looks like
- what kind of creator or use case it is best for

The page is not there to overwhelm the user with every internal configuration detail.

## When To Use Templates

Templates are the best choice when:

- the user wants a working starting point fast
- the outcome is more important than the graph structure
- setup questions can remove the need for manual builder work

Templates are less important when:

- you already know the exact graph you want
- the workflow is small enough to build directly
- you are experimenting with low-level logic from scratch

### Best Use Case

Templates are strongest when they remove repetitive setup work from a known product pattern.

## Best Practices For Template-Based Products

- Start with a strong outcome name.
- Keep setup steps short and guided.
- Use the same visual language in the modal and page.
- Make the generated workflow readable after insertion.
- Keep the graph editable after setup.

### Reliability Principle

The template system should instantiate workflows predictably rather than relying on brittle graph cloning.

## What To Read Next

- [Workflow Studio](/docs/builder/workflow-studio)
- [API Vault](/docs/builder/api-vault)
- [Builder Overview](/docs/builder)
