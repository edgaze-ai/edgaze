title = "Workflow Studio"
description = "A complete Workflow Studio guide covering the canvas, builder flow, and every node available in Edgaze."

# Workflow Studio

Workflow Studio is the visual system you use to build editable multi-step AI products in Edgaze.

If Prompt Studio is for one strong prompt, Workflow Studio is for connected logic. It lets you collect inputs, merge data, call models, transform outputs, branch execution, and package the whole thing as a reusable product.

## On This Page

- What Workflow Studio is
- The main areas of the screen
- How to build your first workflow
- Complete node reference
- Runs and testing
- Publishing
- Best practices

## What Workflow Studio Is

A workflow is a chain of connected blocks. Each block does one job. The lines between them define how data moves from one step to the next.

Think of it like this:

```text
Question asked -> Data collected -> AI or logic applied -> Result returned
```

Workflow Studio is the place where you design that chain visually.

## The Main Areas Of The Screen

### Top Bar

The top bar is where you move between major workflow actions.

You will usually find:

- workflow identity and metadata
- Home
- Templates
- Run
- Publish
- canvas controls

The top bar is for actions and navigation, not detailed node configuration.

### Block Library

The Block Library is where you add the actual workflow primitives that Edgaze supports.

Use it to:

- search nodes
- browse categories
- add default builder blocks
- start from known supported primitives

Templates should still instantiate from these same primitives. They should not invent a separate hidden node system.

### Canvas

The canvas is where the graph lives.

This is where you:

- place blocks
- connect blocks
- shape the reading order
- inspect the overall product logic

A good canvas should be understandable before someone opens the Inspector.

### Inspector

The Inspector opens when you select a block. It is where you configure the selected node's real behavior.

Use the Inspector to:

- set prompts
- choose models
- define input questions
- adjust formatting
- configure advanced behavior
- connect API Vault-backed provider access when required

## How To Build Your First Workflow

### Step 1: Decide The Outcome

Before touching blocks, finish this sentence:

**This workflow helps a customer go from _X_ to _Y_.**

If you cannot state the outcome clearly, the graph usually becomes messy.

### Step 2: Define Inputs

Start by deciding what the user should provide.

Good workflow inputs are:

- clear
- minimal
- easy to answer
- directly tied to the outcome

### Step 3: Add The Core Blocks

A good first workflow often looks like this:

```text
Input -> Merge -> LLM -> Output
```

That pattern is enough to learn the core builder ideas.

### Step 4: Connect The Flow

Connect blocks in the order data should move.

The most important graph rule is simple:

**Every connection should make the next step easier to understand.**

### Step 5: Configure The Selected Block In Inspector

Once a block is selected, use the Inspector to set the actual behavior.

Typical configuration work includes:

- choosing the model
- writing the prompt
- defining an input question
- setting an output format
- reviewing provider requirements

### Step 6: Run The Workflow

Use Run to test the product with realistic customer input.

Customer view is often the most useful default because it shows what the actual product experience feels like.

## Complete Node Reference

This section covers every node currently available in Workflow Studio and explains what a creator needs to know to build with it confidently.

### Workflow Input

The Workflow Input node is the entry point for customer-provided data.

```docsgraph
workflow-input
```

**What It Does**

It asks the user a question and turns the answer into data your workflow can use.

If your workflow begins with customer input, this is usually the first node on the canvas.

**Ports**

- one output port: `Data`

Workflow Input does not accept upstream input. It starts the flow.

**Inspector Fields**

The key input settings are:

- `Question`
- `Input Type`
- `Description`

If the selected input type is `Dropdown`, the Inspector also exposes dropdown options so you can define the choices the user will see.

**Input Types**

Workflow Input supports:

- Text
- Long Paragraph
- Number
- URL
- Dropdown
- File Upload (up to 5MB)
- JSON

Choose the type that matches the answer format you actually want. Do not ask for JSON if a short text or dropdown would be clearer.

**Best Use Cases**

Use Workflow Input for:

- customer prompts
- briefs
- URLs
- structured lists
- file-based starting material
- controlled choice inputs

**Best Practices**

- Make the question extremely clear.
- Use the description for examples or constraints.
- Prefer structured inputs when that reduces ambiguity.
- Avoid asking for more than the workflow actually needs.

### Merge

Merge combines several upstream values into one downstream payload.

```docsgraph
merge
```

**What It Does**

Merge is useful when several inputs or branches need to become one combined value before the next step runs.

This is common in prompt-building workflows where multiple user answers need to feed a single LLM or generator.

**Ports**

- three input ports: `in 1`, `in 2`, `in 3`
- one output port: `Data`

At least one inbound connection is required for the node to be meaningful.

**Inspector Fields**

Merge has no Inspector fields. Its behavior is defined by what you connect into it.

**What Comes Out**

At runtime, Merge is treated as a combination step that produces one downstream value from the connected inputs. In practice, creators should think of it as a compact "combine these values before the next step" node.

**Best Use Cases**

Use Merge when:

- multiple inputs should feed one prompt
- several branches need to recombine
- a creative workflow supports several cues or ingredients

**Best Practices**

- Keep the upstream inputs semantically related.
- Avoid using Merge as a dumping ground for unrelated data.
- If the graph becomes hard to read, split merging into stages.

### Workflow Output

Workflow Output is the final return point of the workflow.

```docsgraph
workflow-output
```

**What It Does**

It defines what the user ultimately receives from the workflow.

This is what makes the workflow feel finished.

**Ports**

- one input port: `Result`

Workflow Output should usually sit at the end of a clear branch or at the end of the main flow.

**Inspector Fields**

The main output settings are:

- `Output Name`
- `Output Format`

**Output Formats**

Workflow Output supports:

- JSON
- Text
- HTML

Choose JSON when the result is structured. Choose Text when the result is plain language. Choose HTML when the output needs formatting.

**Best Use Cases**

Use Workflow Output for:

- final answers
- generated copy
- parsed objects
- structured result payloads
- rendered markup

**Best Practices**

- Name the output based on what the customer gets.
- Match the format to the downstream experience.
- Do not leak internal debugging structure into the final result unless the product explicitly needs it.

### LLM Chat

LLM Chat is the main text-generation and reasoning node.

```docsgraph
llm-chat
```

**What It Does**

It takes input, runs it through a selected language model, and returns a model response.

This is the node you use for:

- rewriting
- summarising
- extracting
- classifying
- analysing
- prompt optimisation
- general text generation

**Ports**

- one input port: `Input`
- one output port: `Response`

It accepts string or JSON-like upstream data and produces a response for downstream nodes.

**Inspector Fields**

The main LLM Chat fields are:

- `Prompt (fallback)`
- `Style / System (optional)`
- `Model`
- `Temperature`
- `Max Tokens`

It also includes inline toggles for:

- `Stream`
- `Safe Mode`

And the node supports advanced execution settings such as timeout and retries.

**How To Use Prompt And Input Together**

If the input is connected, the model can work from the incoming data. If it is not connected, the fallback prompt becomes the main source of instruction.

The cleanest pattern is:

- use upstream nodes for raw data
- use the prompt for transformation instructions
- use system/style for tone and constraints

**Model Choice**

The model selector is where you trade off quality, cost, and speed.

Creators should choose based on the job:

- use stronger models for nuanced reasoning and polished writing
- use lighter models for faster and cheaper utility tasks

**Best Use Cases**

Use LLM Chat when the workflow needs language understanding or generation.

**Best Practices**

- Keep each LLM node focused on one job.
- Use explicit instructions.
- Lower temperature for extraction and structured work.
- Higher temperature is better for creative variation.
- Keep max tokens aligned with the expected result length.

### LLM Image

LLM Image is the image-generation node.

```docsgraph
llm-image
```

**What It Does**

It turns a prompt into an image result.

This node works best after the workflow has already clarified what the image should be.

**Ports**

- one input port: `Prompt`
- one output port: `Image URL`

The cleanest setup is to feed it a polished prompt from an upstream text or optimisation step.

**Inspector Fields**

The main image fields are:

- `Prompt (fallback)`
- `Model`
- `Aspect Ratio`
- `Quality`

It also supports execution settings like timeout and retries.

**Model And Aspect Ratio**

Model determines the provider and generation behavior. Aspect ratio determines the intended frame shape.

In practice:

- choose a model first
- choose the right frame shape for the product
- only use quality settings when the selected provider honors them

**Best Use Cases**

Use LLM Image for:

- image generation products
- creative template outputs
- visual concept generation
- art workflows

**Best Practices**

- Feed it a refined prompt instead of raw vague input.
- Make aspect ratio intentional.
- Treat image generation as a final-stage node, not the thinking stage.

### LLM Embeddings

LLM Embeddings converts text into a vector representation.

```docsgraph
llm-embeddings
```

**What It Does**

It produces embeddings for text so the output can be used in similarity, retrieval, indexing, or memory-style workflows.

This node is not for visible customer copy. It is for vector data.

**Ports**

- one input port: `Text`
- one output port: `Embedding`

It expects string input and returns an array-like vector output.

**Inspector Fields**

The main embeddings fields are:

- `Text (fallback)`
- `Model`

It also supports timeout and retries.

**Best Use Cases**

Use LLM Embeddings for:

- semantic search
- memory systems
- retrieval pipelines
- similarity comparison

**Best Practices**

- Feed it clean, meaningful text.
- Use it as infrastructure inside a larger workflow.
- Do not confuse embeddings with visible text output.

### HTTP Request

HTTP Request lets the workflow talk to an external endpoint.

```docsgraph
http-request
```

**What It Does**

It makes a network request and returns the response payload to the workflow.

This is the node you use when the workflow needs outside data or needs to call an external service.

**Ports**

- one input port: `Request`
- one output port: `Response`

It can work from Inspector config, from upstream input, or from a connected object payload.

**Inspector Fields**

The main HTTP fields are:

- `URL`
- `Method`
- `Allowed Hosts`
- `Denied Hosts`
- `Require idempotency`
- `Idempotency key`

It also supports:

- `Follow Redirects`
- timeout
- retries

**Security And Host Controls**

HTTP Request is safe by default. The node includes allowlist and denylist controls to keep request behavior constrained.

Use:

- `Allowed Hosts` when you want to restrict the node to a known set of domains
- `Denied Hosts` to explicitly block unsafe or disallowed targets

**Side Effects And Idempotency**

If the request writes data using POST, PUT, or PATCH, you should think carefully about retries and side effects.

The idempotency controls exist so write-style requests can be retried more safely when appropriate.

**Best Use Cases**

Use HTTP Request for:

- calling public APIs
- fetching external data
- sending structured payloads to another service
- integrating workflow logic with external systems

**Best Practices**

- Prefer HTTPS public endpoints.
- Restrict hosts when possible.
- Treat writes carefully.
- Be explicit about whether the request should be retry-safe.

### JSON Parse

JSON Parse converts a JSON string into a structured object.

```docsgraph
json-parse
```

**What It Does**

It takes a string that contains JSON and parses it into a usable object for downstream steps.

This is useful when an upstream node returns JSON-looking text that needs to become structured workflow data.

**Ports**

- one input port: `JSON String`
- one output port: `Parsed Object`

**Inspector Fields**

JSON Parse does not expose node-specific Inspector fields. Its behavior is driven by the connected input.

**Best Use Cases**

Use JSON Parse when:

- an LLM returns structured JSON text
- an HTTP response includes JSON as a string
- you need structured downstream access after a text step

**Best Practices**

- Only use it when the upstream content is valid JSON text.
- Pair it with prompts that explicitly return machine-readable JSON.

### Condition

Condition is the branching node in Workflow Studio.

```docsgraph
condition
```

**What It Does**

It evaluates incoming data and sends the workflow down either the true branch or the false branch.

Unlike a plain static comparator, this node can use a human-language condition description alongside its operator logic, making it useful for creator-friendly branching.

**Ports**

- one input port: `Value`
- one output port: `True Branch`
- one output port: `False Branch`

Only one branch continues execution after the condition resolves.

**Inspector Fields**

The main condition fields are:

- `Condition (Human Language)`
- `Condition Type`
- `Compare Value`

**Condition Types**

Supported condition types include:

- Truthy
- Falsy
- Equals
- Not Equals
- Greater Than
- Less Than

`Compare Value` is required for comparison-based operators such as equals and greater than.

**How To Think About It**

Use the operator for the hard evaluation shape and use the human-language condition to add creator-friendly intent.

Example:

- operator: `truthy`
- human condition: `The answer clearly confirms the user wants to proceed`

**Best Use Cases**

Use Condition for:

- true/false workflow branches
- gatekeeping a downstream step
- skipping a branch when input fails a rule

**Best Practices**

- Keep the branch meaning obvious on the canvas.
- Use the simplest operator that fits the job.
- Only use human-language conditions when they improve clarity.

### Delay

Delay pauses the workflow before passing data onward.

```docsgraph
delay
```

**What It Does**

It waits for a specified duration and then continues execution.

The node does not transform the data. It changes timing.

**Ports**

- one input port: `Input`
- one output port: `Output`

Whatever goes in is passed forward after the delay finishes.

**Inspector Fields**

The main delay field is:

- `Duration (ms)`

This value is measured in milliseconds.

**Best Use Cases**

Use Delay for:

- pacing a workflow
- spacing steps apart
- waiting before a follow-up request

**Best Practices**

- Keep delays intentional.
- Do not use Delay to hide unclear logic.
- Document why the pause exists if it matters to the workflow outcome.

### Loop

Loop iterates over an array and emits each item one by one.

```docsgraph
loop
```

**What It Does**

It takes an array input and exposes the current item and current index for each iteration.

This is useful when the workflow must repeat the same downstream logic across a list.

**Ports**

- one input port: `Array`
- one output port: `Current Item`
- one output port: `Current Index`

The upstream input must be an array. If it is not, the loop will not behave as intended.

**Inspector Fields**

The main loop field is:

- `Max Iterations`

This protects the workflow from runaway loops.

**Best Use Cases**

Use Loop for:

- processing lists of items
- repeating an enrichment step
- applying the same logic across many entries

**Best Practices**

- Make sure the upstream node really outputs an array.
- Set a sane max iteration limit.
- Keep the loop body simple and predictable.

## Runs And Testing

A workflow is only useful if it behaves well during a real run.

### What To Check During A Run

Check whether the result is understandable, useful, and correctly structured.

### Why Customer View Matters

Customer view is often the best test because it shows the actual product experience instead of only the builder-facing structure.

When you test:

- use realistic input
- test short and long input
- check the customer-facing output
- confirm that model choice matches the job
- confirm that required API keys are available

Do not publish after one lucky run. Publish after repeated, understandable success.

## Publishing

When the workflow is ready, publish it as a product.

### Naming

Choose a name that describes the outcome instead of the internal graph.

### Positioning

Describe what the workflow helps the customer do in plain language.

### Pricing

Price with product value, platform fees, and infrastructure awareness in mind.

At publish time, focus on:

- a clear title
- a sharp one-sentence promise
- sensible pricing
- an honest description of what the product does

If a workflow needs user-provided provider keys, say that clearly. If Edgaze-hosted execution is included, say that clearly too.

## Workflow Studio Best Practices

- start with the smallest graph that can prove the idea
- use templates when you want faster starts, then edit in Workflow Studio
- keep input questions human and plain
- keep prompts specific
- use merge nodes intentionally, not as a dumping ground
- test in customer view before publishing
- make the canvas readable from left to right

### Layout Discipline

If someone cannot understand the graph shape quickly, simplify it before publishing.

### Product Discipline

If a workflow only makes sense after a long explanation, the product abstraction still needs work.

## What To Read Next

- [Templates](/docs/builder/templates)
- [API Vault](/docs/builder/api-vault)
- [Prompt Studio](/docs/builder/prompt-studio)
