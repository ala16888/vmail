import { isAllowedMailboxAddress } from "./sender.ts";
import { decrypt } from "./utils.ts";

export function authorizePickup(
  email: string,
  authCode: string,
  emailDomains: string,
  secret: string,
): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  if (
    !authCode ||
    !secret ||
    !isAllowedMailboxAddress(normalizedEmail, emailDomains)
  ) {
    return false;
  }

  try {
    return decrypt(authCode, secret).trim().toLowerCase() === normalizedEmail;
  } catch {
    return false;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (entity, code) => {
      const codePoint = Number(code);
      return Number.isInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    })
    .replace(/&#x([0-9a-f]+);/gi, (entity, code) => {
      const codePoint = Number.parseInt(code, 16);
      return Number.isInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : entity;
    });
}

export function getReadableEmailText(message: {
  text?: string | null;
  html?: string | null;
}): string {
  if (message.text?.trim()) {
    return message.text.trim();
  }

  if (!message.html) {
    return "";
  }

  const text = message.html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(text)
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractVerificationCode(message: {
  subject?: string | null;
  text?: string | null;
  html?: string | null;
}): string | null {
  const readableText = getReadableEmailText(message);
  const numericCode = readableText.match(/\b\d{4,8}\b/);
  if (numericCode) {
    return numericCode[0];
  }

  const context = `${message.subject ?? ""}\n${readableText}`.match(
    /(?:verification|verify|security|one[-\s]?time|code|验证码|驗證碼|安全码|安全碼)[\s\S]{0,120}/i,
  )?.[0];
  const alphaNumericCode = context?.match(
    /\b(?=[a-z0-9]{4,10}\b)(?=[a-z0-9]*\d)(?=[a-z0-9]*[a-z])[a-z0-9]+\b/i,
  );
  return alphaNumericCode?.[0] ?? null;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

interface PickupPageMessage {
  subject?: string | null;
  messageFrom?: string | null;
  from?: { address?: string; name?: string } | null;
  date?: string | Date | null;
  createdAt?: string | Date | null;
  text?: string | null;
  html?: string | null;
}

export function getPickupMessageSummary(message: PickupPageMessage | null) {
  if (!message) {
    return {
      code: null,
      subject: null,
      from: null,
      receivedAt: null,
      text: "",
    };
  }

  const senderName = message.from?.name?.trim();
  const senderAddress = message.from?.address?.trim() || message.messageFrom;
  const from = senderName
    ? `${senderName}${senderAddress ? ` <${senderAddress}>` : ""}`
    : senderAddress || null;
  const receivedAt = message.date ?? message.createdAt ?? null;

  return {
    code: extractVerificationCode(message),
    subject: message.subject || null,
    from,
    receivedAt:
      receivedAt instanceof Date ? receivedAt.toISOString() : receivedAt,
    text: getReadableEmailText(message),
  };
}

export function renderPickupPage(
  email: string,
  message: PickupPageMessage | null,
  jsonUrl: string,
): string {
  const summary = getPickupMessageSummary(message);
  const safeEmail = escapeHtml(email);
  const safeJsonUrl = escapeHtml(jsonUrl);
  const safeSubject = escapeHtml(summary.subject || "无主题");
  const safeFrom = escapeHtml(summary.from || "未知发件人");
  const safeReceivedAt = escapeHtml(summary.receivedAt || "");
  const safeText = escapeHtml(summary.text.slice(0, 5000));
  const safeCode = summary.code ? escapeHtml(summary.code) : "";
  const refreshTag = message ? "" : '<meta http-equiv="refresh" content="5">';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  ${refreshTag}
  <title>${message ? "最新邮件" : "等待邮件"} - ${safeEmail}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #18181b; color: #f4f4f5; font-family: Arial, sans-serif; }
    main { width: min(720px, calc(100% - 32px)); margin: 40px auto; }
    header { border-bottom: 1px solid #3f3f46; padding-bottom: 20px; }
    h1 { margin: 0 0 10px; font-size: 22px; }
    .email { color: #22d3ee; overflow-wrap: anywhere; }
    .panel { margin-top: 20px; border: 1px solid #3f3f46; border-radius: 8px; background: #27272a; padding: 20px; }
    .label { color: #a1a1aa; font-size: 13px; margin-bottom: 8px; }
    .code-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .code { color: #4ade80; font-family: Consolas, monospace; font-size: 38px; font-weight: 700; letter-spacing: 3px; }
    button, a { color: #e4e4e7; border: 1px solid #52525b; border-radius: 6px; background: #3f3f46; padding: 8px 12px; text-decoration: none; cursor: pointer; }
    button:hover, a:hover { background: #52525b; }
    dl { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 10px; margin: 0; }
    dt { color: #a1a1aa; }
    dd { margin: 0; overflow-wrap: anywhere; }
    pre { margin: 0; max-height: 360px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: #d4d4d8; font: 14px/1.6 Arial, sans-serif; }
    .waiting { color: #facc15; font-size: 18px; }
    nav { display: flex; gap: 10px; margin-top: 20px; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>${message ? "最新邮件" : "等待邮件"}</h1>
      <div class="email">${safeEmail}</div>
    </header>
    ${
      message
        ? `<section class="panel">
      <div class="label">验证码</div>
      <div class="code-row">
        <div class="code" id="verification-code">${safeCode || "未识别"}</div>
        ${safeCode ? '<button type="button" id="copy-code">复制验证码</button>' : ""}
      </div>
    </section>
    <section class="panel">
      <dl>
        <dt>主题</dt><dd>${safeSubject}</dd>
        <dt>发件人</dt><dd>${safeFrom}</dd>
        <dt>时间</dt><dd>${safeReceivedAt}</dd>
      </dl>
    </section>
    <section class="panel">
      <div class="label">邮件正文</div>
      <pre>${safeText || "邮件没有可显示的正文"}</pre>
    </section>`
        : '<section class="panel waiting">暂时没有邮件，页面每 5 秒自动刷新。</section>'
    }
    <nav><button type="button" onclick="location.reload()">刷新</button><a href="${safeJsonUrl}">查看 JSON</a></nav>
  </main>
  ${
    safeCode
      ? `<script>
    document.getElementById("copy-code")?.addEventListener("click", async () => {
      await navigator.clipboard.writeText(document.getElementById("verification-code").textContent || "");
      document.getElementById("copy-code").textContent = "已复制";
    });
  </script>`
      : ""
  }
</body>
</html>`;
}
