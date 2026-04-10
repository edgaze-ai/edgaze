import { getSiteOrigin } from "@lib/site-origin";
import { defaultSocialImageAbsoluteUrl, DEFAULT_SOCIAL_IMAGE } from "@lib/default-social-image";

export default function Head() {
  const ogImage = defaultSocialImageAbsoluteUrl();
  const w = String(DEFAULT_SOCIAL_IMAGE.width);
  const h = String(DEFAULT_SOCIAL_IMAGE.height);
  return (
    <>
      <title>Beta</title>
      <meta name="description" content="Join the Edgaze beta." />
      <meta property="og:title" content="Beta" />
      <meta property="og:description" content="Join the Edgaze beta." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={`${getSiteOrigin()}/apply`} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content={w} />
      <meta property="og:image:height" content={h} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content={ogImage} />
    </>
  );
}
