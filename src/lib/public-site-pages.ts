export type PublicPageVisual =
  | "constellation"
  | "sequence"
  | "signals"
  | "stack"
  | "comparison"
  | "grid"
  | "orbit"
  | "bridge";

export type PublicPageSection = {
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
  visual: PublicPageVisual;
};

export type PublicPageLink = {
  href: string;
  label: string;
  description: string;
};

export type PublicSitePage = {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string;
  heroCta: PublicPageLink;
  heroHighlights: string[];
  heroStats: Array<{ label: string; value: string }>;
  sections: PublicPageSection[];
  relatedLinks: PublicPageLink[];
};

function makeSection(
  eyebrow: string,
  title: string,
  body: string,
  bullets: string[],
  visual: PublicPageVisual,
): PublicPageSection {
  return { eyebrow, title, body, bullets, visual };
}

export const PUBLIC_CONTEXT_PAGES: PublicSitePage[] = [
  {
    path: "/what-is-edgaze",
    title: "What Is Edgaze? | AI Workflow Platform for Creators",
    description:
      "Learn what Edgaze is, who it serves, and how the platform helps creators turn AI workflows into products people actually pay for.",
    eyebrow: "Platform overview",
    h1: "Edgaze turns AI workflows into products people actually pay for",
    intro:
      "Edgaze is a platform where creators turn AI workflows into products people actually pay for. It brings workflow creation, product packaging, public distribution, and creator monetization into one system that is easier to understand, trust, and buy.",
    heroCta: {
      href: "/marketplace",
      label: "Explore the marketplace",
      description: "Browse public workflow products and creator pages.",
    },
    heroHighlights: [
      "Built for creators who want more than prompt screenshots",
      "Structured for buyers who need clarity before they run",
      "Designed so search engines can understand the product surface",
    ],
    heroStats: [
      { label: "Core model", value: "Runnable workflows" },
      { label: "Primary user", value: "AI creators" },
      { label: "Outcome", value: "Publishable products" },
    ],
    sections: [
      makeSection(
        "Definition",
        "What Edgaze actually is",
        "Edgaze is not a chat app and it is not a gallery of loose prompts. It is a platform for building AI workflows, packaging them as public products, and giving people a direct way to run them.",
        [
          "Workflows instead of fragments",
          "Products instead of notes",
          "Distribution instead of isolation",
        ],
        "constellation",
      ),
      makeSection(
        "Why it exists",
        "Most useful AI systems are hard to share",
        "A lot of valuable AI work lives in private documents, chat threads, or screenshots. Edgaze exists to make that work legible, runnable, and easier to distribute.",
        ["Clear public pages", "Reusable workflow logic", "A cleaner path from idea to use"],
        "signals",
      ),
      makeSection(
        "Who it serves",
        "The platform is built for creators and buyers",
        "Creators need a serious publishing surface. Buyers need confidence about what a workflow does before they trust it. Edgaze is designed to make both sides easier.",
        ["Creators need monetization", "Buyers need clarity", "The platform needs trust"],
        "bridge",
      ),
      makeSection(
        "Product shape",
        "One system covers the full workflow lifecycle",
        "The platform connects creation, presentation, discovery, and monetization. That means the thing a creator builds is directly connected to the thing a buyer sees and runs.",
        [
          "Build in Workflow Studio",
          "Publish with public context",
          "Distribute through marketplace discovery",
        ],
        "sequence",
      ),
      makeSection(
        "Workflow model",
        "Why workflows matter more than isolated prompts",
        "Many practical AI outcomes need multiple steps, tool usage, structured inputs, and clear outputs. Workflows carry that structure in a way a single prompt usually cannot.",
        ["Inputs", "Logic", "Tools", "Outputs"],
        "stack",
      ),
      makeSection(
        "Public pages",
        "Every workflow needs a page that explains itself",
        "Public workflow pages are not decoration. They are part of the product because they help users, search engines, and AI crawlers understand what the workflow does and who it is for.",
        ["Clear purpose", "Clear audience", "Clear use case"],
        "grid",
      ),
      makeSection(
        "Monetization",
        "Creators need more than a builder",
        "A builder without distribution is incomplete. Edgaze adds marketplace exposure and creator infrastructure so useful workflows can become real products instead of private experiments.",
        ["Visibility", "Distribution", "Revenue paths"],
        "orbit",
      ),
      makeSection(
        "Takeaway",
        "Edgaze is best understood as workflow software with distribution built in",
        "The cleanest way to describe Edgaze is simple: it helps creators build AI workflows, publish them clearly, and let other people run them instantly.",
        ["Build", "Publish", "Run", "Monetize"],
        "comparison",
      ),
    ],
    relatedLinks: [
      {
        href: "/how-edgaze-works",
        label: "How Edgaze works",
        description: "See the full path from builder to marketplace.",
      },
      {
        href: "/workflow-studio",
        label: "Workflow Studio",
        description: "Understand the creation layer behind the platform.",
      },
      {
        href: "/for-creators",
        label: "For creators",
        description: "Read the creator side platform story.",
      },
    ],
  },
  {
    path: "/how-edgaze-works",
    title: "How Edgaze Works | Build, Publish, and Run AI Workflows",
    description:
      "Understand how Edgaze works from workflow creation to public publishing, marketplace discovery, instant runs, and creator monetization.",
    eyebrow: "Product flow",
    h1: "Edgaze connects creation, publishing, discovery, and monetization in one workflow system",
    intro:
      "Edgaze works by turning AI workflows into public products. Creators build workflows, publish clear pages, distribute them through the marketplace, and give buyers a direct path to run what they discover.",
    heroCta: {
      href: "/builder",
      label: "Open the builder",
      description: "Start from the workflow creation layer.",
    },
    heroHighlights: [
      "A direct path from idea to published product",
      "Public pages that explain the workflow before it runs",
      "Marketplace discovery that supports creator revenue",
    ],
    heroStats: [
      { label: "Step 1", value: "Build" },
      { label: "Step 2", value: "Publish" },
      { label: "Step 3", value: "Run and monetize" },
    ],
    sections: [
      makeSection(
        "Step one",
        "Creators start in a builder, not a publishing form",
        "The workflow starts as a system. Creators shape prompts, inputs, tools, and logic into something that can deliver a repeatable result.",
        ["Workflow Studio", "Prompt Studio", "Templates"],
        "sequence",
      ),
      makeSection(
        "Structure",
        "The workflow carries the logic of the product",
        "This is where Edgaze differs from thin AI products. The creator is not only writing instructions. They are defining how the workflow behaves.",
        ["Multiple steps", "Tool connections", "Reusable outputs"],
        "stack",
      ),
      makeSection(
        "Publishing",
        "A workflow becomes a product when it gets a clear public page",
        "Publishing gives the workflow a stable public surface that explains what it does, who it is for, and what someone can expect when they run it.",
        ["Readable landing page", "Context for buyers", "Better search legibility"],
        "grid",
      ),
      makeSection(
        "Discovery",
        "Marketplace structure makes the work discoverable",
        "The marketplace helps buyers compare products, understand use cases, and navigate the platform through meaningful categories and creator pages.",
        ["Listings", "Category pages", "Creator identity"],
        "orbit",
      ),
      makeSection(
        "Runtime",
        "The user side is about running, not reconstructing",
        "After discovery, users should be able to run the workflow directly. That is why the platform focuses on runnable products instead of vague AI claims.",
        ["Faster time to value", "Less guesswork", "More confidence"],
        "signals",
      ),
      makeSection(
        "Monetization",
        "Revenue is attached to the same public surface",
        "Because the workflow, public page, and marketplace are connected, creators can monetize from the same product surface buyers already understand.",
        ["Clear path to purchase", "Better conversion context", "Product led monetization"],
        "bridge",
      ),
      makeSection(
        "Quality",
        "Clarity improves both conversion and crawlability",
        "When the workflow page is clear, both people and crawlers understand it better. That improves trust, discoverability, and the chance that the site hierarchy remains legible over time.",
        ["Unique titles", "Server rendered context", "Crawlable links"],
        "comparison",
      ),
      makeSection(
        "Takeaway",
        "Edgaze works because each layer reinforces the next one",
        "The builder makes the workflow useful. The public page makes it understandable. The marketplace makes it discoverable. The runtime makes it valuable.",
        ["Creation", "Explanation", "Discovery", "Usage"],
        "constellation",
      ),
    ],
    relatedLinks: [
      {
        href: "/marketplace",
        label: "Marketplace",
        description: "See the public discovery layer in action.",
      },
      {
        href: "/monetize-ai-workflows",
        label: "Monetize AI workflows",
        description: "See how revenue fits into the system.",
      },
      {
        href: "/templates",
        label: "Templates",
        description: "Start from proven workflow structures.",
      },
    ],
  },
  {
    path: "/for-creators",
    title: "For Creators | Build and Monetize AI Workflows on Edgaze",
    description:
      "See how Edgaze helps creators build AI workflows, publish polished public pages, reach buyers, and monetize useful products.",
    eyebrow: "Creator guide",
    h1: "Edgaze gives creators a cleaner path from workflow idea to paid product",
    intro:
      "Edgaze is built for creators who want more than a prompt notebook. It gives creators a workflow studio, a premium public presentation layer, marketplace distribution, and the infrastructure needed to monetize useful AI systems.",
    heroCta: {
      href: "/creators",
      label: "Visit the creator program",
      description: "Go to the main creator landing page.",
    },
    heroHighlights: [
      "Build real products instead of isolated prompt snippets",
      "Publish with a cleaner surface that can convert buyers",
      "Use marketplace distribution to support long term revenue",
    ],
    heroStats: [
      { label: "Creator focus", value: "Workflow products" },
      { label: "Distribution", value: "Marketplace ready" },
      { label: "Outcome", value: "Monetizable systems" },
    ],
    sections: [
      makeSection(
        "Positioning",
        "Creators need a product layer, not only a tool layer",
        "A powerful builder is useful, but creators also need a public surface that can explain value, earn trust, and convert interest into usage or revenue.",
        ["Build layer", "Presentation layer", "Monetization layer"],
        "stack",
      ),
      makeSection(
        "Creation",
        "Turn prompts into workflows with real structure",
        "Creators can combine prompts with tools, inputs, and logic so the result is a reusable workflow rather than a loose text artifact.",
        ["Structured logic", "Reusable outcomes", "More defensible products"],
        "sequence",
      ),
      makeSection(
        "Publishing",
        "A clean public page helps buyers understand faster",
        "Buyers are more likely to trust and try a workflow when the page explains the use case, value, and intended audience without forcing them to decode it.",
        ["Clear narrative", "Clear audience", "Clear expectations"],
        "grid",
      ),
      makeSection(
        "Discovery",
        "Marketplace placement matters for creator growth",
        "Even a strong workflow can stay invisible without the right discovery layer. The marketplace gives creators a public route into search, sharing, and direct buyer navigation.",
        ["Better internal linking", "Public entry points", "More discoverable products"],
        "orbit",
      ),
      makeSection(
        "Trust",
        "Professional presentation supports conversion",
        "Creators do better when their workflows look like serious products. Premium page design and clear product messaging reduce friction before someone ever clicks run.",
        ["First impression matters", "Clarity reduces bounce", "Good pages help conversion"],
        "signals",
      ),
      makeSection(
        "Monetization",
        "Revenue works best when the product is easy to understand",
        "Monetization is not separate from the product. Buyers need to know what they are paying for, what outcome they will get, and why the workflow is worth using again.",
        ["Clear outcome", "Clear reason to pay", "Clear repeat value"],
        "comparison",
      ),
      makeSection(
        "Operations",
        "Creators can scale better with reusable systems",
        "A workflow product can be improved, republished, and reused over time. That gives creators something more durable than one off consulting or manual prompting work.",
        ["Reusable assets", "Higher leverage", "Cleaner product iteration"],
        "bridge",
      ),
      makeSection(
        "Takeaway",
        "Edgaze is for creators who want distribution with substance",
        "The best use of Edgaze is not posting random AI outputs. It is building useful workflows, presenting them clearly, and turning them into products that people can actually run.",
        ["Useful systems", "Clear product pages", "Marketplace leverage"],
        "constellation",
      ),
    ],
    relatedLinks: [
      {
        href: "/builder",
        label: "Workflow Builder",
        description: "Start building the product itself.",
      },
      {
        href: "/pricing",
        label: "Pricing",
        description: "Review the commercial side of the platform.",
      },
      {
        href: "/monetize-ai-workflows",
        label: "Monetize AI workflows",
        description: "Go deeper on creator revenue mechanics.",
      },
    ],
  },
  {
    path: "/for-buyers",
    title: "For Buyers | Discover and Run AI Workflows on Edgaze",
    description:
      "Learn how buyers use Edgaze to discover useful AI workflows, understand what they do, and run them instantly from clear public pages.",
    eyebrow: "Buyer guide",
    h1: "Edgaze helps buyers find AI workflows they can understand before they run",
    intro:
      "Edgaze is designed for buyers who want practical AI products, not vague claims. The platform makes it easier to discover workflows, evaluate them quickly, and run them from clear public pages.",
    heroCta: {
      href: "/marketplace",
      label: "Browse public workflows",
      description: "Start from the marketplace discovery layer.",
    },
    heroHighlights: [
      "Clear listing pages that reduce guesswork",
      "Runnable products instead of abstract prompt collections",
      "A cleaner path from discovery to direct usage",
    ],
    heroStats: [
      { label: "Buyer need", value: "Clarity" },
      { label: "Product unit", value: "Workflow" },
      { label: "Goal", value: "Run instantly" },
    ],
    sections: [
      makeSection(
        "Discovery",
        "Buyers need more than search and hype",
        "A marketplace only works when listings help people compare products quickly. Edgaze is built to make discovery more practical and less noisy.",
        ["Clear categories", "Clear creator identity", "Clear product framing"],
        "orbit",
      ),
      makeSection(
        "Understanding",
        "The workflow page should explain the product in plain language",
        "Before a buyer runs anything, the page should explain what the workflow does, who it serves, and what kind of result it produces.",
        ["Outcome", "Audience", "Use case"],
        "grid",
      ),
      makeSection(
        "Trust",
        "Legibility matters before execution",
        "People trust products they can understand. That is why page structure, metadata, headings, and supporting context matter as much as interface polish.",
        ["Readable pages", "Consistent titles", "Better buyer confidence"],
        "signals",
      ),
      makeSection(
        "Runtime",
        "Edgaze is built for direct use",
        "The destination is not reading about AI. It is running the workflow. That difference matters because buyers want outcomes, not explanation alone.",
        ["Shorter path to value", "Less reconstruction", "More practical software"],
        "sequence",
      ),
      makeSection(
        "Quality",
        "Good workflow pages help buyers filter faster",
        "A buyer should be able to decide quickly whether a workflow is relevant. Better workflow pages reduce wasted time and improve the quality of platform navigation.",
        ["Faster evaluation", "Better fit", "Lower friction"],
        "comparison",
      ),
      makeSection(
        "Value",
        "Workflows are stronger when they capture more than a prompt",
        "A workflow can include logic, tool usage, and structured inputs. That usually makes it more useful to a buyer than a standalone prompt with no operating context.",
        ["More complete systems", "More repeatable output", "Stronger product value"],
        "stack",
      ),
      makeSection(
        "Navigation",
        "The platform is easier to understand when the hierarchy is stable",
        "Consistent internal linking between marketplace, creators, templates, and documentation helps buyers keep their orientation as they evaluate products.",
        ["Marketplace to creators", "Templates to builder", "Docs to product pillars"],
        "bridge",
      ),
      makeSection(
        "Takeaway",
        "Edgaze is for buyers who want practical AI products they can trust faster",
        "The best buyer experience is simple: discover a workflow, understand what it does, and run it without a lot of guesswork in between.",
        ["Discover", "Understand", "Run"],
        "constellation",
      ),
    ],
    relatedLinks: [
      {
        href: "/run-ai-workflows",
        label: "Run AI workflows",
        description: "Go deeper on the runtime side of the platform.",
      },
      {
        href: "/help",
        label: "Help Center",
        description: "Find support and product guidance.",
      },
      {
        href: "/what-is-edgaze",
        label: "What Edgaze is",
        description: "Read the platform definition from the top.",
      },
    ],
  },
  {
    path: "/ai-workflow-marketplace",
    title: "AI Prompts and Workflows Marketplace | What the Edgaze Marketplace Is For",
    description:
      "Understand the Edgaze marketplace for AI prompts and workflows, how discovery works, and why clear public listing pages matter for creators and buyers.",
    eyebrow: "Marketplace guide",
    h1: "The Edgaze marketplace is the public discovery layer for prompt and workflow products",
    intro:
      "The marketplace helps buyers find useful AI prompts and workflows and helps creators publish their work with a clearer, more trusted presentation layer. It is where prompt and workflow products become discoverable.",
    heroCta: {
      href: "/marketplace",
      label: "Open the marketplace",
      description: "Browse the live public discovery surface.",
    },
    heroHighlights: [
      "Discovery is a product function, not an afterthought",
      "Listing quality shapes trust and conversion",
      "Clear structure helps both users and crawlers navigate",
    ],
    heroStats: [
      { label: "Role", value: "Discovery layer" },
      { label: "Audience", value: "Buyers and creators" },
      { label: "Benefit", value: "Public visibility" },
    ],
    sections: [
      makeSection(
        "Definition",
        "The marketplace is where workflow products become visible",
        "It gives public shape to creator work. That means listings, creator identity, and a stable internal structure that helps people move through the site with context.",
        ["Listings", "Creator pages", "Category paths"],
        "constellation",
      ),
      makeSection(
        "Quality",
        "A marketplace only works when listings explain themselves",
        "Low context listings make a marketplace feel thin. Strong listings explain the use case, intended audience, and product value with enough specificity to support trust.",
        ["Clear outcomes", "Clear audience", "Clear product language"],
        "grid",
      ),
      makeSection(
        "Conversion",
        "Better public pages support better buying decisions",
        "A buyer is more likely to continue when the listing feels professional, complete, and easy to scan. That makes marketplace quality part of the conversion stack.",
        ["Professional design", "Better clarity", "Lower hesitation"],
        "signals",
      ),
      makeSection(
        "Creators",
        "The marketplace gives creators a distribution surface",
        "A creator can build something useful, but without a public discovery layer the product remains hidden. Marketplace exposure helps useful workflows travel further.",
        ["Distribution", "Visibility", "Comparison"],
        "orbit",
      ),
      makeSection(
        "Buyers",
        "Discovery gets easier when hierarchy is stable",
        "When the marketplace links cleanly to creators, templates, docs, and the homepage, buyers can explore without losing their orientation.",
        ["Stable navigation", "Relevant cross links", "Clear hierarchy"],
        "bridge",
      ),
      makeSection(
        "Search",
        "A curated public layer improves crawlability",
        "Search engines understand the site better when public marketplace pages have consistent titles, headings, canonicals, and crawlable links into the core pillars.",
        ["Metadata consistency", "Canonicals", "HTML links"],
        "comparison",
      ),
      makeSection(
        "Positioning",
        "This is not a generic prompt directory",
        "Edgaze positions the marketplace around runnable workflows. That distinction matters because it changes how products are described, evaluated, and trusted.",
        ["Runnable systems", "Better framing", "Stronger product story"],
        "stack",
      ),
      makeSection(
        "Takeaway",
        "A strong marketplace makes creator work easier to discover and easier to buy",
        "The marketplace is most valuable when it feels curated, legible, and connected to the rest of the public site instead of feeling like a disconnected catalog.",
        ["Curation", "Legibility", "Conversion"],
        "sequence",
      ),
    ],
    relatedLinks: [
      {
        href: "/templates",
        label: "Templates",
        description: "See how workflows often start from proven structures.",
      },
      {
        href: "/creators",
        label: "Creators",
        description: "See the people publishing to the marketplace.",
      },
      {
        href: "/why-workflows-not-prompts",
        label: "Why workflows matter",
        description: "Understand the product model behind the marketplace.",
      },
    ],
  },
  {
    path: "/workflow-studio",
    title: "Workflow Studio | Edgaze Builder for AI Creators",
    description:
      "Learn what Workflow Studio is, how creators build AI workflows in Edgaze, and why workflow systems are more useful than standalone prompts.",
    eyebrow: "Builder guide",
    h1: "Workflow Studio helps creators turn AI logic into publishable workflow products",
    intro:
      "Workflow Studio is the visual builder inside Edgaze for creating AI workflows with prompts, tools, logic, and outputs. It is designed to help creators build systems that are worth publishing and selling.",
    heroCta: {
      href: "/builder",
      label: "Open Workflow Studio",
      description: "Go directly to the builder surface.",
    },
    heroHighlights: [
      "A builder designed for publishable products",
      "More structure than a single prompt can carry",
      "Connected directly to templates and public pages",
    ],
    heroStats: [
      { label: "Builder type", value: "Visual workflow editor" },
      { label: "Best for", value: "AI creators" },
      { label: "Outcome", value: "Reusable systems" },
    ],
    sections: [
      makeSection(
        "Purpose",
        "Workflow Studio is where the product starts",
        "The builder is not a side feature. It is the place where a creator defines the system that later becomes a public workflow product.",
        ["Creation first", "Product logic", "Repeatable structure"],
        "sequence",
      ),
      makeSection(
        "Structure",
        "A workflow can carry more than prompt text",
        "Workflow Studio allows creators to shape prompts, tool calls, branching logic, and outputs into a system that can behave more reliably than a single message.",
        ["Logic", "Tools", "Inputs", "Outputs"],
        "stack",
      ),
      makeSection(
        "Speed",
        "Templates reduce time to a useful starting point",
        "Many creators do not want to begin from a blank canvas. Templates give them a strong starting structure that can be adapted to their own use case.",
        ["Faster setup", "Better defaults", "Less wasted work"],
        "grid",
      ),
      makeSection(
        "Publishing",
        "The builder is directly connected to public pages",
        "Because the creation surface and publishing surface are connected, creators can move from workflow logic to public presentation without losing coherence.",
        ["Builder to listing", "Listing to marketplace", "Marketplace to runtime"],
        "bridge",
      ),
      makeSection(
        "Quality",
        "Better workflow structure improves buyer understanding",
        "When a workflow is well shaped inside the builder, it is easier to describe clearly on the public page. Product quality and communication quality reinforce each other.",
        ["Cleaner messaging", "Better demos", "Better page clarity"],
        "signals",
      ),
      makeSection(
        "Advanced use",
        "Workflow Studio supports depth without losing readability",
        "Creators can evolve from simple workflows to more layered systems while still keeping the product understandable to buyers and easier to maintain over time.",
        ["Start simple", "Scale up", "Keep clarity"],
        "comparison",
      ),
      makeSection(
        "Positioning",
        "The builder is for creators who want more than a prototype",
        "Workflow Studio is best for creators who want to package AI systems as real products rather than keeping them as internal experiments or one off chats.",
        ["Product intent", "Distribution intent", "Monetization intent"],
        "orbit",
      ),
      makeSection(
        "Takeaway",
        "Workflow Studio gives creators a serious foundation for publishable AI products",
        "It helps creators build systems that can be explained, shared, and run by other people, which is the real point of the platform.",
        ["Build clearly", "Publish confidently", "Monetize useful work"],
        "constellation",
      ),
    ],
    relatedLinks: [
      {
        href: "/docs/builder/workflow-studio",
        label: "Builder docs",
        description: "Read the product guide for Workflow Studio.",
      },
      {
        href: "/templates",
        label: "Templates",
        description: "Start from a structured workflow foundation.",
      },
      {
        href: "/builder",
        label: "Builder",
        description: "Go directly into the product.",
      },
    ],
  },
  {
    path: "/why-workflows-not-prompts",
    title: "Why Workflows, Not Just Prompts? | Edgaze",
    description:
      "Learn why Edgaze is centered on AI workflows, how workflows differ from prompts, and why runnable systems are more useful than isolated prompt text.",
    eyebrow: "Workflow model",
    h1: "Workflows matter because real AI products need more structure than a single prompt",
    intro:
      "A prompt can be useful, but many practical AI tasks need more than prompt text alone. Edgaze is centered on workflows because workflows combine prompts, logic, tools, inputs, and outputs into something another person can actually run.",
    heroCta: {
      href: "/builder",
      label: "Build a workflow",
      description: "Use the creation layer behind the model.",
    },
    heroHighlights: [
      "Prompts are a component, not always the product",
      "Workflows capture context that prompts alone miss",
      "Runnable systems are easier to explain and sell",
    ],
    heroStats: [
      { label: "Prompt", value: "Instruction" },
      { label: "Workflow", value: "System" },
      { label: "Edgaze focus", value: "Runnable products" },
    ],
    sections: [
      makeSection(
        "Starting point",
        "A prompt is often only one ingredient",
        "A single prompt may contain the core intent, but it usually does not capture tool usage, data flow, validation, or the logic needed for a repeatable product.",
        ["Intent", "Instruction", "Not the full system"],
        "comparison",
      ),
      makeSection(
        "Structure",
        "Workflows capture the shape around the prompt",
        "A workflow gives the prompt operating context. It defines how inputs enter the system, what steps run, and what kind of output is returned.",
        ["Inputs", "Steps", "Outputs"],
        "stack",
      ),
      makeSection(
        "Reliability",
        "Structure helps make outcomes more repeatable",
        "When the creator defines the process around the prompt, the result is usually more stable, more explainable, and easier to improve over time.",
        ["Less ambiguity", "Better repeatability", "Cleaner iteration"],
        "signals",
      ),
      makeSection(
        "Product value",
        "Buyers understand a workflow product more easily",
        "A buyer can evaluate a workflow product because the creator can explain the system. That is much harder when all that exists is a bare prompt.",
        ["More explainable", "More legible", "More trustable"],
        "grid",
      ),
      makeSection(
        "Distribution",
        "Workflows create stronger public pages",
        "Because workflows have richer structure, their public pages can describe the use case more clearly and support stronger internal linking and search visibility.",
        ["Stronger metadata", "Clearer headings", "Better public context"],
        "bridge",
      ),
      makeSection(
        "Monetization",
        "Creators can package workflows as more durable products",
        "A workflow product feels more substantial because it carries logic and usability, not only clever wording. That can make monetization more credible.",
        ["Better product framing", "Higher perceived value", "Clearer differentiation"],
        "orbit",
      ),
      makeSection(
        "Positioning",
        "Edgaze uses prompts inside a larger product model",
        "The platform is not against prompts. It simply treats them as one part of a broader workflow system that is more useful to creators and buyers.",
        ["Prompts still matter", "Workflows add context", "Products become runnable"],
        "constellation",
      ),
      makeSection(
        "Takeaway",
        "The shift from prompts to workflows is a shift from text to product design",
        "That is why Edgaze is centered on workflows. It helps creators ship systems that other people can understand, run, and value.",
        ["From text to system", "From fragment to product", "From idea to use"],
        "sequence",
      ),
    ],
    relatedLinks: [
      {
        href: "/prompt-studio",
        label: "Prompt Studio",
        description: "See where prompts fit inside the platform.",
      },
      {
        href: "/run-ai-workflows",
        label: "Run AI workflows",
        description: "See what buyers experience on the other side.",
      },
      {
        href: "/what-is-edgaze",
        label: "What Edgaze is",
        description: "Zoom back out to the platform definition.",
      },
    ],
  },
  {
    path: "/run-ai-workflows",
    title: "Run AI Workflows | How People Use Edgaze Workflows",
    description:
      "Learn how people run AI workflows on Edgaze, from discovery and public workflow pages to direct execution and repeat use.",
    eyebrow: "Runtime guide",
    h1: "Edgaze is built so people can run useful AI workflows without rebuilding them from scratch",
    intro:
      "The point of the platform is not just to explain AI workflows. It is to make them runnable. Buyers should be able to discover a workflow, understand it quickly, and use it directly from a clear public surface.",
    heroCta: {
      href: "/marketplace",
      label: "Find runnable workflows",
      description: "Start from the discovery layer.",
    },
    heroHighlights: [
      "Discovery starts from a clear public page",
      "Usage should feel direct and practical",
      "Strong workflow pages reduce friction before the run",
    ],
    heroStats: [
      { label: "Start", value: "Discover" },
      { label: "Middle", value: "Understand" },
      { label: "End", value: "Run" },
    ],
    sections: [
      makeSection(
        "Discovery",
        "People usually start with a listing or shared link",
        "The first step is often marketplace discovery or a direct shared page. That first page has to make the workflow legible fast.",
        ["Marketplace entry", "Shared links", "Public landing pages"],
        "orbit",
      ),
      makeSection(
        "Clarity",
        "A workflow page should answer the essential questions first",
        "A strong workflow page should quickly explain what the workflow does, who it is for, and why someone would want to run it.",
        ["What it does", "Who it serves", "Why it matters"],
        "grid",
      ),
      makeSection(
        "Execution",
        "Running should feel like using a product, not assembling instructions",
        "A buyer should not need to copy prompts into another tool or guess how the process works. The value of the platform is direct execution.",
        ["Less manual work", "Clearer UX", "Faster results"],
        "sequence",
      ),
      makeSection(
        "Trust",
        "Good pre run context reduces hesitation",
        "People are more willing to run a workflow when the page looks serious, explains the use case, and feels specific rather than generic.",
        ["Better confidence", "Cleaner conversion", "Lower bounce"],
        "signals",
      ),
      makeSection(
        "Repeat value",
        "A useful workflow should invite reuse",
        "If a workflow solves a meaningful task well, the user should be able to come back to it rather than treating it like a one time experiment.",
        ["Practical outcomes", "Reusable system", "Higher buyer value"],
        "stack",
      ),
      makeSection(
        "Creators",
        "Creators benefit when the runtime is easy to understand",
        "A smoother runtime experience improves trust, which supports creator reputation, repeat usage, and monetization over time.",
        ["Better perception", "Better retention", "Better creator outcomes"],
        "bridge",
      ),
      makeSection(
        "Search",
        "Search legibility helps people reach runnable products",
        "Better metadata, canonicals, and internal linking mean buyers can discover the workflow through clearer public pathways rather than only through direct sharing.",
        ["Stronger discovery", "Cleaner hierarchy", "Better entry points"],
        "comparison",
      ),
      makeSection(
        "Takeaway",
        "Running is where the product proves itself",
        "The strongest Edgaze workflows are the ones that move smoothly from discovery to understanding to execution without asking the user to piece the product together manually.",
        ["Discover", "Trust", "Run"],
        "constellation",
      ),
    ],
    relatedLinks: [
      {
        href: "/for-buyers",
        label: "For buyers",
        description: "Read the buyer side platform overview.",
      },
      {
        href: "/ai-workflow-marketplace",
        label: "Marketplace guide",
        description: "See how discovery feeds the runtime experience.",
      },
      {
        href: "/help",
        label: "Help Center",
        description: "Find support and product guidance.",
      },
    ],
  },
  {
    path: "/monetize-ai-workflows",
    title: "Monetize AI Workflows | Creator Monetization on Edgaze",
    description:
      "Understand how creators monetize AI workflows on Edgaze through clear public pages, marketplace distribution, and creator focused product infrastructure.",
    eyebrow: "Monetization guide",
    h1: "Creators monetize best when useful workflows are packaged as clear public products",
    intro:
      "Edgaze helps creators turn useful AI workflows into public products with distribution and monetization built into the platform. The goal is to make the workflow easier to understand, easier to trust, and easier to buy.",
    heroCta: {
      href: "/pricing",
      label: "Review pricing",
      description: "See the commercial structure behind the platform.",
    },
    heroHighlights: [
      "Monetization starts with a clear product, not a payment link",
      "Discovery and trust are part of the revenue equation",
      "Professional pages support better buyer conversion",
    ],
    heroStats: [
      { label: "Revenue driver", value: "Useful products" },
      { label: "Support layer", value: "Marketplace visibility" },
      { label: "Buyer need", value: "Confidence" },
    ],
    sections: [
      makeSection(
        "Foundation",
        "Monetization begins with product quality",
        "A workflow is easier to monetize when it solves a real task well and when the creator can explain the value clearly. Monetization starts with usefulness, not packaging alone.",
        ["Real outcome", "Repeat use", "Clear positioning"],
        "stack",
      ),
      makeSection(
        "Presentation",
        "The public page is part of the conversion system",
        "A strong workflow page reduces friction before purchase. It frames the value of the workflow, sets expectations, and helps buyers trust what they are considering.",
        ["Clear offer", "Clear audience", "Clear reason to buy"],
        "grid",
      ),
      makeSection(
        "Distribution",
        "The marketplace brings the workflow into public view",
        "Without discovery, even useful creator work stays hidden. Marketplace structure gives products a place where they can be compared, found, and revisited.",
        ["Visibility", "Navigation", "Public reach"],
        "orbit",
      ),
      makeSection(
        "Trust",
        "Professional design supports commercial credibility",
        "Buyers judge quality quickly. Premium layout, clear copy, and stable structure make the workflow feel more like a serious product and less like an experiment.",
        ["Higher trust", "Better conversion", "Cleaner first impression"],
        "signals",
      ),
      makeSection(
        "Retention",
        "A monetizable workflow should invite repeat usage",
        "Creators earn more when the workflow continues to deliver value beyond a single run. That means product clarity and workflow quality both matter long after the first visit.",
        ["Repeat use", "Repeat trust", "Longer term value"],
        "comparison",
      ),
      makeSection(
        "Positioning",
        "Workflows can carry more value than isolated prompts",
        "Because workflows include logic, tools, and structure, creators can often present them as more complete and durable products than a single prompt asset.",
        ["More complete offer", "More defensible value", "Stronger positioning"],
        "bridge",
      ),
      makeSection(
        "Operations",
        "Reusable systems create better creator leverage",
        "A creator who builds a reusable workflow product is building an asset that can be improved, distributed, and monetized repeatedly over time.",
        ["More leverage", "Better iteration", "Cleaner product growth"],
        "sequence",
      ),
      makeSection(
        "Takeaway",
        "Monetization works best when the workflow, page, and marketplace reinforce each other",
        "That is the real Edgaze advantage for creators. The builder, the public product page, and the discovery layer all support the same commercial outcome.",
        ["Useful system", "Clear product page", "Discoverable distribution"],
        "constellation",
      ),
    ],
    relatedLinks: [
      {
        href: "/creators",
        label: "Creator program",
        description: "See the main creator focused surface.",
      },
      {
        href: "/ai-workflow-marketplace",
        label: "Marketplace guide",
        description: "See why discovery matters for conversion.",
      },
      {
        href: "/for-creators",
        label: "For creators",
        description: "Read the broader creator side overview.",
      },
    ],
  },
  {
    path: "/about/mission",
    title: "Edgaze Mission | Build Useful, Runnable AI Workflow Products",
    description:
      "Read the Edgaze mission and why the company is focused on making AI workflows clearer, more runnable, and more useful for creators and buyers.",
    eyebrow: "Mission",
    h1: "Edgaze exists to make AI workflows clearer, more useful, and easier to distribute",
    intro:
      "The mission behind Edgaze is straightforward. AI workflows should not stay trapped inside screenshots, private documents, or one off chats. They should become products that people can understand and run instantly.",
    heroCta: {
      href: "/about",
      label: "Read about Edgaze",
      description: "Go to the main company and platform story.",
    },
    heroHighlights: [
      "Clarity over hype",
      "Useful product design over shallow AI noise",
      "A public web surface that is legible to people and crawlers",
    ],
    heroStats: [
      { label: "Mission", value: "Make AI work legible" },
      { label: "Belief", value: "Useful beats noisy" },
      { label: "Direction", value: "Build for trust" },
    ],
    sections: [
      makeSection(
        "Belief",
        "AI workflows deserve a better public form",
        "A useful AI system should be understandable and runnable. That belief shapes the product, the public site, and the way workflow pages are presented.",
        ["Clarity", "Usability", "Legibility"],
        "constellation",
      ),
      makeSection(
        "Problem",
        "A lot of AI value is still buried in private spaces",
        "When workflows stay hidden in notes or threads, the work does not travel well and other people cannot benefit from it. Edgaze exists to solve that gap.",
        ["Private docs", "Scattered prompts", "Lost distribution"],
        "signals",
      ),
      makeSection(
        "Product response",
        "The platform turns hidden systems into public products",
        "The builder, marketplace, and public pages are all parts of the same mission. Each one helps turn internal creator knowledge into something usable by other people.",
        ["Creation", "Presentation", "Distribution"],
        "sequence",
      ),
      makeSection(
        "Creators",
        "Creators should be able to publish real workflow products",
        "The mission includes supporting creators with a serious publishing surface rather than asking them to improvise with disconnected tools and ad hoc landing pages.",
        ["Better publishing", "Better distribution", "Better monetization"],
        "bridge",
      ),
      makeSection(
        "Buyers",
        "Buyers should be able to understand value quickly",
        "A good product page saves time. Buyers should be able to tell what a workflow does and whether it is relevant before they commit attention or money.",
        ["Faster understanding", "Lower friction", "More trust"],
        "grid",
      ),
      makeSection(
        "Design standard",
        "Premium presentation is part of the mission",
        "If the goal is trust and clarity, the public surface cannot feel accidental. Design, hierarchy, spacing, and motion all contribute to whether the product feels serious.",
        ["Premium feel", "Thoughtful hierarchy", "Focused communication"],
        "orbit",
      ),
      makeSection(
        "Search legibility",
        "The public site should be understandable to machines too",
        "A well structured site helps search engines and AI crawlers understand what Edgaze is, how the product is organized, and why the pages are distinct.",
        ["Clear canonicals", "Curated sitemap", "Consistent metadata"],
        "comparison",
      ),
      makeSection(
        "Takeaway",
        "The mission is to make useful AI work easier to understand, easier to trust, and easier to run",
        "That mission shows up in both the product and the public web experience. Edgaze is trying to make AI workflows feel like real software, not scattered prompt artifacts.",
        ["Useful", "Trustworthy", "Runnable"],
        "stack",
      ),
    ],
    relatedLinks: [
      {
        href: "/what-is-edgaze",
        label: "What Edgaze is",
        description: "Read the platform definition in practical terms.",
      },
      {
        href: "/how-edgaze-works",
        label: "How Edgaze works",
        description: "See how the mission maps to product structure.",
      },
      {
        href: "/marketplace",
        label: "Marketplace",
        description: "See the mission in the public discovery layer.",
      },
    ],
  },
];

export function getPublicContextPage(path: string) {
  return PUBLIC_CONTEXT_PAGES.find((page) => page.path === path) ?? null;
}
