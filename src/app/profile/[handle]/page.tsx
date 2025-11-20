import PublicProfileView from "src/components/profile/PublicProfileView";

export default function ProfileByHandlePage({
  params,
}: {
  params: { handle: string };
}) {
  // Accept either "arjun" or "@arjun" in the URL
  const raw = decodeURIComponent(params.handle);
  const handle = raw.startsWith("@") ? raw.slice(1) : raw;

  return <PublicProfileView handle={handle} />;
}
