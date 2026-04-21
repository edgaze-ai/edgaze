import EdgazeNotFoundScreen from "../components/errors/EdgazeNotFoundScreen";

export default function NotFound() {
  return (
    <EdgazeNotFoundScreen
      code="404"
      eyebrow="Page not found"
      title="This page fell off the grid."
      description="The link may be outdated, moved, or never published. Jump back into the Edgaze marketplace and keep exploring premium prompts, workflows, and creator-built AI products."
      primaryHref="/marketplace"
      primaryLabel="Explore marketplace"
    />
  );
}
