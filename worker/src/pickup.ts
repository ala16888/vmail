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
