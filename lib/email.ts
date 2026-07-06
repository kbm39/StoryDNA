import "server-only";

/** Send the password-reset email via Resend's HTTP API (no SDK dependency). */
export async function sendResetEmail(to: string, link: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("Email isn't configured (set RESEND_API_KEY).");
  const from = process.env.RESET_FROM || "onboarding@resend.dev";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Reset your Manuscript Review password",
      html: `
        <div style="font-family: Georgia, serif; color: #1e1b16;">
          <h2 style="margin:0 0 12px;">Reset your password</h2>
          <p>Click the link below to set a new password. It expires in 1 hour.</p>
          <p><a href="${link}" style="color:#7b2d26;">${link}</a></p>
          <p style="color:#888; font-size:13px;">If you didn't request this, you can ignore this email — your password won't change.</p>
        </div>`,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Email send failed (${res.status}): ${body.slice(0, 140)}`);
  }
}
