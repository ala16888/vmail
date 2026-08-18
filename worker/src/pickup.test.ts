import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizePickup,
  escapeHtml,
  extractVerificationCode,
  getReadableEmailText,
} from "./pickup.ts";
import { encrypt } from "./utils.ts";

test("pickup authorization binds an auth code to one mailbox", () => {
  const secret = "test-secret";
  const email = "abc@hdb168.com";
  const authCode = encrypt(email, secret);

  assert.equal(authorizePickup(email, authCode, "hdb168.com", secret), true);
  assert.equal(
    authorizePickup("other@hdb168.com", authCode, "hdb168.com", secret),
    false,
  );
  assert.equal(authorizePickup(email, "invalid", "hdb168.com", secret), false);
  assert.equal(authorizePickup(email, authCode, "example.com", secret), false);
});

test("verification codes are extracted from HTML-only messages", () => {
  const message = {
    subject: "Your temporary ChatGPT verification code",
    text: null,
    html: `
      <style>.code { font-size: 24px }</style>
      <p>Enter this temporary verification code to continue:</p>
      <p class="code">403307</p>
    `,
  };

  assert.equal(extractVerificationCode(message), "403307");
  assert.match(getReadableEmailText(message), /verification code.*403307/s);
});

test("pickup HTML escapes untrusted email content", () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script>'),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
  );
});
