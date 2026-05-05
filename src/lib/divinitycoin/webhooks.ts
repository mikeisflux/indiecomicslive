import crypto from "node:crypto";
import { getDivinityCoinWebhookSecret, getDivinityCoinConfig } from "./config";
import type {
  DivinityCoinWebhookRequest,
  TestPingResponse,
} from "./types";

// HMAC-SHA256 over the raw body using the webhook secret. DC sends the
// hex digest in the X-Webhook-Signature header.
export function verifyWebhookSignature(
  payload: string,
  providedSignature: string,
  secret: string,
): boolean {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedSignature),
      Buffer.from(expected),
    );
  } catch {
    return false;
  }
}

export async function constructWebhookEvent(
  payload: string,
  signature: string,
): Promise<DivinityCoinWebhookRequest> {
  const secret = await getDivinityCoinWebhookSecret();
  if (!secret) {
    throw new Error("DivinityCoin webhook secret not configured");
  }
  if (!verifyWebhookSignature(payload, signature, secret)) {
    throw new Error("Invalid webhook signature");
  }
  return JSON.parse(payload) as DivinityCoinWebhookRequest;
}

export async function handleTestPing(): Promise<TestPingResponse> {
  const cfg = await getDivinityCoinConfig();
  return {
    success: true,
    message: "Webhook received successfully",
    partnerId: cfg?.partnerId ?? "unknown",
    sandboxMode: process.env.NODE_ENV !== "production",
  };
}
