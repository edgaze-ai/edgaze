title = "API Vault"
description = "Learn how the Edgaze API Vault stores provider keys, how nodes use vault-backed access, and how to set up reliable provider execution."

# API Vault

API Vault is the secure key management layer for Edgaze.

It lets you connect provider accounts such as OpenAI, Anthropic, and Google so your workflows and prompts can run using vault-backed credentials instead of pasted secrets spread across your products.

## On This Page

- What API Vault is
- Why it exists
- Where it appears in the product
- How vault-backed runs work
- What creators should expect
- Best practices

## What API Vault Is

### Security Layer

API Vault keeps provider credentials centralised instead of scattered across products.

### Execution Layer

API Vault also helps the runtime know which provider path should be used for a given node.

API Vault is the place where Edgaze stores your provider API keys securely and makes them available to the nodes that need them during execution.

This system exists for two reasons:

- security
- reliability

It is better than asking creators to paste secrets repeatedly into product configuration.

## Why API Vault Matters

### Reliability

Provider-backed execution is much easier to reason about when the key source is predictable.

### Maintainability

Key rotation and troubleshooting become simpler when secrets live in one controlled place.

Without a vault system, creators run into the same problems again and again:

- secrets copied into too many places
- confusion about which provider a node needs
- workflows that fail because the right key is missing
- painful maintenance when keys rotate

API Vault fixes that by centralising the provider connection point.

## Where API Vault Appears

You will see API Vault in places such as:

- the Inspector when a selected node needs a provider key
- runtime surfaces when a run depends on user-provided provider access
- account or settings surfaces where keys are managed directly

Inside Workflow Studio, the vault section should appear alongside the node configuration flow, not detached from it.

### Inspector Context

In the builder, vault controls should feel like part of the node setup flow rather than a separate unrelated system.

## How Vault-Backed Execution Works

The logic is simple:

1. A node declares which provider it needs.
2. Edgaze checks whether the required vault key is available.
3. If the key exists, the run can proceed using that provider-backed access.
4. If the key is missing, Edgaze prompts for the missing connection path instead of silently failing.

This makes provider requirements easier to understand at both build time and run time.

### Missing Key Behavior

If a required key is not available, the user should get a clear path to fixing the provider connection instead of a vague failure.

## Which Providers Matter Most

The main vault-backed providers are typically:

- OpenAI
- Anthropic
- Google

The exact provider required depends on the model family selected in the node configuration.

### Provider Matching

The selected model should always be aligned with the connected provider path.

## What A Creator Should Know

When you configure a model-driven node:

- pick the right model for the job
- confirm the matching provider is connected in API Vault
- test the workflow using the same provider path you expect customers or your own account to use

Do not wait until publish time to learn that the wrong provider is connected.

### Test Early

It is better to validate provider access during build and test than after listing a product.

## Example

If a workflow uses an Anthropic model in an LLM block, the node should resolve against an Anthropic vault key.

If a workflow uses a Google model for image or text generation, it should resolve against the matching Google vault key.

The vault is there to keep that mapping predictable.

### Anthropic Example

An Anthropic model should resolve through an Anthropic vault key.

### Google Example

A Google model should resolve through the matching Google vault key.

## Best Practices

- Keep vault keys centralised.
- Do not paste secrets into loose notes or unrelated node fields.
- Match the provider to the actual selected model.
- Re-test after changing provider configuration.
- Document provider expectations in published products when relevant.

### Operational Habit

Treat vault setup as part of product quality, not as an afterthought.

## Common Misunderstanding

API Vault does not change what your workflow does. It changes how the workflow gets authorised to run.

That means it is infrastructure for execution, not product logic.

## What To Read Next

- [Workflow Studio](/docs/builder/workflow-studio)
- [Templates](/docs/builder/templates)
- [Payments Overview](/docs/payments-overview)
