title = "Prompt Studio"
description = "Learn how to create reusable prompt products in Edgaze, from placeholders and testing to publishing and monetization."

# Prompt Studio

Prompt Studio is the simplest way to turn a strong prompt into a product.

Instead of building a graph, you write one prompt, define the information a user should provide, test the result, and publish it with a clean customer experience.

## On This Page

- What Prompt Studio is
- When to use it instead of Workflow Studio
- How placeholders work
- How to test and publish
- Prompt product best practices

## What Prompt Studio Is

Prompt Studio is for products where a single prompt is doing most of the work.

That makes it ideal for:

- writing prompts
- analysis prompts
- transformation prompts
- structured prompt templates
- lightweight utilities that do not need a graph

## Prompt Studio Vs Workflow Studio

### When Prompt Studio Is The Better Fit

Use Prompt Studio when:

- one prompt is enough
- the user flow should stay simple
- you want the fastest path from idea to product

Use Workflow Studio when:

- you need multiple connected steps
- you need merges, routing, or composed logic
- you want a graph that stays editable block by block

### When Workflow Studio Is The Better Fit

If you need several steps, orchestration, or post-processing, Workflow Studio is usually the better product surface.

## How Prompt Products Work

### The Prompt Layer

A strong prompt should do one job clearly.

### The Input Layer

The placeholder system should make it obvious what the customer needs to provide.

### The Product Layer

The final published product should feel cleaner than the underlying prompt text.

A prompt product usually has three parts:

1. The prompt itself
2. The placeholders the user fills in
3. The final rendered prompt or model output

That means the structure is often:

```text
User Inputs -> Prompt Template -> Final Prompt -> Result
```

## Placeholders

### Good Placeholder Names

Good placeholder names are specific, human, and easy to understand later.

### Weak Placeholder Names

Weak placeholder names make the product feel internal and unfinished.

Placeholders are the variables inside your prompt.

A placeholder should represent a real decision the customer can make.

Good placeholder examples:

- topic
- tone
- audience
- length
- format

Weak placeholder examples:

- input1
- field2
- stuff

The rule is simple:

**If a customer cannot understand the placeholder name, rename it.**

## Writing Good Placeholder Questions

Each placeholder should have a clear question attached to it.

For example:

- instead of **Topic**
- use **What should this be about?**

Instead of exposing internal prompt structure, explain the decision in plain language.

## Testing In Prompt Studio

### Test For Real Inputs

Use the kind of messy, realistic values a customer would actually enter.

### Test For Clarity

Make sure the final result still reads like a polished product experience.

Before you publish, test the prompt with realistic values.

Good tests include:

- short values
- long values
- values that are messy or imperfect
- values from the exact audience you expect to use the product

If the prompt only works when the input is perfectly phrased, it is not ready yet.

## Publishing Prompt Products

### Title

The title should describe the outcome, not the internal prompt trick.

### Description

The description should explain who the product is for and what kind of result it returns.

When you publish a prompt product, the buyer should immediately understand:

- what outcome it creates
- what they need to enter
- what kind of result they should expect

Use a title and description that describe the outcome, not the internal wording trick you used to get there.

## Prompt Studio Best Practices

- Use one prompt for one job.
- Keep placeholder labels human.
- Write customer-facing questions, not developer-facing field names.
- Test with realistic examples before publishing.
- Prefer simple products over clever but fragile ones.

### A Good Prompt Product Feels Obvious

The best prompt products feel simple on the outside even if the wording behind them took effort to refine.

## When To Graduate To Workflow Studio

### Signs You Need A Graph

If your prompt product keeps growing new layers of logic, it is probably time to move into Workflow Studio.

Move from Prompt Studio to Workflow Studio when you catch yourself wanting:

- multiple prompt stages
- branching logic
- external data retrieval
- structured merging of several inputs
- post-processing before the final output

That is the point where a graph becomes useful.

## What To Read Next

- [Workflow Studio](/docs/builder/workflow-studio)
- [Templates](/docs/builder/templates)
- [API Vault](/docs/builder/api-vault)
