// PaymentCloud / NMI Direct Post integration. Ported from indiecrowdfund_2.0.
//
// PaymentCloud is a high-risk-friendly merchant. Their gateway is a
// white-label of NMI — same Direct Post API at a different host. We use
// CollectJS in the browser to tokenize cards (PAN never touches our
// servers) and the Customer Vault to charge a saved card on auction win.
//
// Single endpoint: POST /api/transact.php with `type` selecting the
// action (sale / refund / void / capture / validate) or
// `customer_vault` for tokenization. All requests are
// application/x-www-form-urlencoded; responses are also query-string
// encoded (response=1&responsetext=APPROVED&...).
//
// MVP: config from env. To rotate keys without a redeploy later, move
// the loader to a DB-backed PlatformSettings table (same pattern as
// indiecrowdfund_2.0/src/lib/vault.ts).

export interface NmiConfig {
  securityKey: string;
  publicKey: string | null;
  webhookSecret: string | null;
  environment: "production" | "sandbox";
  /** Final URL hit for /transact.php — production / sandbox / reseller override. */
  gatewayUrl: string;
}

export function loadNmiConfig(): NmiConfig | null {
  const securityKey = process.env.NMI_SECURITY_KEY;
  if (!securityKey) return null;

  const env =
    process.env.NMI_ENVIRONMENT === "sandbox" ? "sandbox" : "production";

  // Production defaults to PaymentCloud's NMI-white-label host (the
  // documented POST URL in their integration portal). Sandbox falls
  // back to NMI's shared sandbox since white-labels typically don't
  // mint a separate sandbox subdomain. Either is overridable via
  // NMI_GATEWAY_URL for any other ISO that proxies NMI.
  const defaultUrl =
    env === "sandbox"
      ? "https://sandbox.nmi.com/api/transact.php"
      : "https://paymentcloud.transactiongateway.com/api/transact.php";
  const gatewayUrl = process.env.NMI_GATEWAY_URL?.trim() || defaultUrl;

  return {
    securityKey,
    publicKey: process.env.NMI_PUBLIC_KEY || null,
    webhookSecret: process.env.NMI_WEBHOOK_SECRET || null,
    environment: env,
    gatewayUrl,
  };
}

export interface NmiRequestParams {
  [key: string]: string | number | boolean | undefined | null;
}

export interface NmiResponse {
  /** "1" = approved, "2" = declined, "3" = error */
  response: string;
  responsetext: string;
  authcode?: string;
  transactionid?: string;
  customer_vault_id?: string;
  raw: Record<string, string>;
}

function parseQueryStringResponse(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const params = new URLSearchParams(body);
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

export class NmiApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`NMI gateway ${status}: ${body.slice(0, 200)}`);
    this.name = "NmiApiError";
  }
}

async function nmiPost(
  config: NmiConfig,
  params: NmiRequestParams,
): Promise<NmiResponse> {
  const body = new URLSearchParams();
  body.append("security_key", config.securityKey);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    body.append(k, String(v));
  }

  const res = await fetch(config.gatewayUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new NmiApiError(res.status, text);
  }

  const raw = parseQueryStringResponse(text);
  return {
    response: raw.response,
    responsetext: raw.responsetext,
    authcode: raw.authcode,
    transactionid: raw.transactionid,
    customer_vault_id: raw.customer_vault_id,
    raw,
  };
}

export interface SaleByTokenInput {
  amount: number;
  customerVaultId: string;
  orderid?: string;
  orderdescription?: string;
  email?: string;
  // PaymentCloud / NMI credential-on-file (CIT/MIT) tagging. Set on
  // re-charges of a card already stored in the Customer Vault so the
  // gateway and card networks recognize the transaction as expected
  // recurring activity rather than fraud.
  initiatedBy?: "customer" | "merchant";
  storedCredentialIndicator?: "stored" | "used";
  initialTransactionId?: string;
}

export async function saleByVaultToken(
  config: NmiConfig,
  input: SaleByTokenInput,
): Promise<NmiResponse> {
  return nmiPost(config, {
    type: "sale",
    customer_vault_id: input.customerVaultId,
    amount: input.amount.toFixed(2),
    orderid: input.orderid,
    orderdescription: input.orderdescription,
    email: input.email,
    initiated_by: input.initiatedBy,
    stored_credential_indicator: input.storedCredentialIndicator,
    initial_transaction_id: input.initialTransactionId,
  });
}

export interface SaleByPaymentTokenInput {
  amount: number;
  paymentToken: string;
  orderid?: string;
  orderdescription?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

// One-shot sale against a Collect.js payment_token. No vault entry.
export async function saleByPaymentToken(
  config: NmiConfig,
  input: SaleByPaymentTokenInput,
): Promise<NmiResponse> {
  return nmiPost(config, {
    type: "sale",
    payment_token: input.paymentToken,
    amount: input.amount.toFixed(2),
    orderid: input.orderid,
    orderdescription: input.orderdescription,
    email: input.email,
    first_name: input.firstName,
    last_name: input.lastName,
    address1: input.address1,
    address2: input.address2,
    city: input.city,
    state: input.state,
    zip: input.zip,
    country: input.country,
  });
}

export async function refund(
  config: NmiConfig,
  transactionId: string,
  amount?: number,
): Promise<NmiResponse> {
  return nmiPost(config, {
    type: "refund",
    transactionid: transactionId,
    amount: amount === undefined ? undefined : amount.toFixed(2),
  });
}

export async function voidTransaction(
  config: NmiConfig,
  transactionId: string,
): Promise<NmiResponse> {
  return nmiPost(config, {
    type: "void",
    transactionid: transactionId,
  });
}

export async function captureAuth(
  config: NmiConfig,
  transactionId: string,
  amount: number,
): Promise<NmiResponse> {
  return nmiPost(config, {
    type: "capture",
    transactionid: transactionId,
    amount: amount.toFixed(2),
  });
}

export interface AddCustomerInput {
  paymentToken: string;
  // Caller-supplied vault id. PaymentCloud's white-label has been
  // observed to NOT echo customer_vault_id back on add_customer
  // responses. Pass our own and store it locally; NMI accepts arbitrary
  // strings and uses them as-is per the Direct Post API.
  customerVaultId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export async function addCustomerToVault(
  config: NmiConfig,
  input: AddCustomerInput,
): Promise<NmiResponse> {
  return nmiPost(config, {
    customer_vault: "add_customer",
    customer_vault_id: input.customerVaultId,
    payment_token: input.paymentToken,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    address1: input.address1,
    address2: input.address2,
    city: input.city,
    state: input.state,
    zip: input.zip,
    country: input.country,
  });
}

export async function deleteVaultCustomer(
  config: NmiConfig,
  customerVaultId: string,
): Promise<NmiResponse> {
  return nmiPost(config, {
    customer_vault: "delete_customer",
    customer_vault_id: customerVaultId,
  });
}

// Smoke-test the security key against the gateway WITHOUT touching a
// real card. We post a customer_vault add_customer with no payment
// data — the gateway responds with response=3 + responsetext that
// either tells us the card was missing (security_key works, request
// was just incomplete — what we want) or that the security_key is
// wrong (what we're trying to detect). Free, no vault entries created.
export async function pingNmi(config: NmiConfig): Promise<{
  ok: boolean;
  message: string;
  gatewayUrl: string;
}> {
  try {
    const resp = await nmiPost(config, { customer_vault: "add_customer" });
    const text = (resp.responsetext || "").toLowerCase();
    const looksLikeBadKey =
      text.includes("invalid security key") ||
      text.includes("security key") ||
      text.includes("not authenticated") ||
      text.includes("authentication");
    if (looksLikeBadKey) {
      return {
        ok: false,
        message: resp.responsetext || "Security key rejected by gateway",
        gatewayUrl: config.gatewayUrl,
      };
    }
    return {
      ok: true,
      message: resp.responsetext || "Connected to PaymentCloud",
      gatewayUrl: config.gatewayUrl,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Network error reaching PaymentCloud",
      gatewayUrl: config.gatewayUrl,
    };
  }
}

// Run a zero-cost auth-and-void to confirm a saved vault entry is a
// real, chargeable card. Used at vault-on-card-add so invalid cards
// are caught up front instead of on the first auction-win charge.
export async function validateVaultCard(
  config: NmiConfig,
  customerVaultId: string,
): Promise<NmiResponse> {
  return nmiPost(config, {
    type: "validate",
    customer_vault_id: customerVaultId,
  });
}
