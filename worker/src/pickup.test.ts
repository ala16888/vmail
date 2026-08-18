import assert from "node:assert/strict";
import test from "node:test";

import { authorizePickup } from "./pickup.ts";
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
