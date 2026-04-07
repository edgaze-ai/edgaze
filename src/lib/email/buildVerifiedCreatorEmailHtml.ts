/** Verified creator email: PNG badge (SVG blocked in many clients), production asset URLs */

const CTA_URL = "https://edgaze.ai/builder";
const BADGE_URL = "https://edgaze.ai/brand/verified-creator-email-badge.png";
const CTA_LABEL = "Start building your workflow";

export function buildVerifiedCreatorEmailHtml(_params: {
  fullName?: string | null;
  handle?: string | null;
  email: string;
  builderUrl: string;
}): string {
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Verified on Edgaze</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style type="text/css">
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { border: 0; outline: none; text-decoration: none; line-height: 100%; }
    a { text-decoration: none; }
    @media only screen and (max-width: 620px) {
      .outer-pad { padding: 20px 10px 32px !important; }
      .shell { width: 100% !important; max-width: 100% !important; }
      .pad { padding-left: 20px !important; padding-right: 20px !important; }
      .h1 { font-size: 22px !important; }
      .body { font-size: 16px !important; }
      .cta { display: block !important; width: 100% !important; box-sizing: border-box !important; padding: 16px 20px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .email-bg { background: #0c0c0e !important; }
      .card { background: #141416 !important; border-color: #27272a !important; }
      .h1 { color: #fafafa !important; }
      .body { color: #d4d4d8 !important; }
      .muted { color: #a1a1aa !important; }
      .foot { color: #71717a !important; }
      .rule { border-color: #27272a !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="email-bg" style="background:#f4f4f5;min-width:100%;">
    <tr>
      <td align="center" class="outer-pad" style="padding:28px 12px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="shell card" style="width:100%;max-width:680px;background:#ffffff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden;">
          <tr>
            <td style="padding:0;background:linear-gradient(90deg,#22d3ee,#67e8f9,#f472b6);height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="pad" align="center" style="padding:32px 36px 8px;">
              <img src="${BADGE_URL}" width="72" height="72" alt="Verified on Edgaze" style="display:block;width:72px;height:72px;margin:0 auto;" />
            </td>
          </tr>
          <tr>
            <td class="pad" style="padding:8px 36px 28px;">
              <p class="body" style="margin:0 0 18px;font-size:17px;color:#3f3f46;line-height:1.55;">Hello,</p>
              <p class="h1" style="margin:0 0 14px;font-size:26px;font-weight:600;color:#0f172a;line-height:1.25;letter-spacing:-0.02em;">You are now verified on Edgaze.</p>
              <p class="body" style="margin:0 0 12px;font-size:17px;color:#3f3f46;line-height:1.55;">Your account carries a trust signal across the platform, helping users take your work seriously from the start.</p>
              <p class="body" style="margin:0 0 26px;font-size:17px;color:#3f3f46;line-height:1.55;">Publish your first workflow today. Verified creators get the most visibility when they start early.</p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:0 0 12px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${CTA_URL}" style="height:56px;v-text-anchor:middle;width:100%;" arcsize="10%" stroke="f" fillcolor="#0f172a">
                    <w:anchorlock/><center style="color:#ffffff;font-size:16px;font-weight:600;line-height:1.3;padding:0 12px;">${CTA_LABEL}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <a href="${CTA_URL}" class="cta" style="display:inline-block;width:100%;max-width:100%;box-sizing:border-box;background:#0f172a;color:#ffffff !important;font-size:17px;font-weight:600;padding:16px 24px;border-radius:10px;text-align:center;line-height:1.35;">${CTA_LABEL}</a>
                    <!--<![endif]-->
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 0 28px;">
                    <p class="muted" style="margin:0;font-size:14px;color:#52525b;line-height:1.5;"><a href="${CTA_URL}" style="color:#2563eb;text-decoration:underline;">${CTA_URL}</a></p>
                  </td>
                </tr>
              </table>

              <p class="muted" style="margin:0 0 8px;font-size:15px;color:#52525b;line-height:1.5;">Reply to this email if you need anything.</p>
              <p class="body" style="margin:0;font-size:15px;color:#3f3f46;line-height:1.5;font-weight:500;">Edgaze Team</p>
            </td>
          </tr>
          <tr>
            <td class="pad rule" style="padding:22px 36px 28px;border-top:1px solid #e4e4e7;">
              <p class="foot" style="margin:0;font-size:12px;color:#71717a;line-height:1.45;">Sent because your creator account was verified on Edgaze.</p>
              <p class="foot" style="margin:10px 0 0;font-size:12px;color:#71717a;line-height:1.45;">© ${year} Edge Platforms, Inc.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
