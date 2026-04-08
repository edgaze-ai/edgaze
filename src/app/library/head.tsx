import { getSiteOrigin } from "@lib/site-origin";
import { defaultSocialImageAbsoluteUrl, DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";

export default function Head() {
  const ogImage = defaultSocialImageAbsoluteUrl();
  const w = String(DEFAULT_SOCIAL_IMAGE.width);
  const h = String(DEFAULT_SOCIAL_IMAGE.height);
  return (
    <>
      <title>Library | Edgaze</title>
      <meta
        name="description"
        content="Your created and purchased prompts and workflows in one place."
      />
      <meta property="og:title" content="Library | Edgaze" />
      <meta
        property="og:description"
        content="Your created and purchased prompts and workflows in one place."
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`${getSiteOrigin()}/library`} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content={w} />
      <meta property="og:image:height" content={h} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content={ogImage} />
    </>
  );
}
