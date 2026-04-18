import { instantiateTemplate } from "./instantiateTemplate";
import { TEMPLATE_REGISTRY } from "./registry";
import type {
  InstantiateTemplateInput,
  InstantiatedWorkflowResult,
  TemplateDefinition,
  TemplateFilters,
} from "./types";

function matchesQuery(template: TemplateDefinition, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    template.meta.name,
    template.meta.shortDescription,
    template.meta.longDescription,
    template.meta.category,
    ...(template.meta.tags ?? []),
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export const templateService = {
  async listTemplates(filters?: TemplateFilters): Promise<TemplateDefinition[]> {
    return TEMPLATE_REGISTRY.filter((template) => {
      if (template.status !== "published") return false;
      if (filters?.featuredOnly && !template.meta.featured) return false;
      if (
        filters?.category &&
        filters.category !== "all" &&
        template.meta.category !== filters.category
      ) {
        return false;
      }
      if (filters?.query && !matchesQuery(template, filters.query)) return false;
      return true;
    });
  },

  async getTemplateBySlug(slug: string): Promise<TemplateDefinition | null> {
    return (
      TEMPLATE_REGISTRY.find(
        (template) => template.slug === slug && template.status === "published",
      ) ?? null
    );
  },

  async getTemplateById(id: string): Promise<TemplateDefinition | null> {
    return (
      TEMPLATE_REGISTRY.find((template) => template.id === id && template.status === "published") ??
      null
    );
  },

  async instantiate(input: InstantiateTemplateInput): Promise<InstantiatedWorkflowResult> {
    return instantiateTemplate(input);
  },
};
