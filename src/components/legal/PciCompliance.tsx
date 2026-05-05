import Doc from "./Doc";

export default function PciCompliance() {
  return (
    <Doc slug="pci">
      <h2>1. Card Data Never Touches Our Servers</h2>
      <p>
        We use Divinity Payments&rsquo; secure tokenization to tokenize cards
        inside the bidder&rsquo;s browser. The PAN (full card number), CVV,
        and expiration are submitted directly from the bidder&rsquo;s browser
        to Divinity Payments&rsquo; servers. Our servers receive only a
        single-use payment token, which we exchange for a vault id used for
        future merchant-initiated charges.
      </p>
      <p>
        This places our environment in <strong>PCI DSS SAQ-A scope</strong>{" "}
        &mdash; the lightest assessment, applicable to merchants who fully
        outsource cardholder data handling.
      </p>

      <h2>2. What We Store</h2>
      <ul>
        <li>Card brand (Visa, Mastercard, etc.);</li>
        <li>Last 4 digits of the card;</li>
        <li>Expiration month and year;</li>
        <li>Divinity Payments vault id (a token, not a card number);</li>
        <li>Successful transaction ids for our internal records.</li>
      </ul>

      <h2>3. Encryption At Rest</h2>
      <p>
        Sensitive seller PII (bank account numbers, routing numbers) is
        encrypted at rest with AES-256-GCM via per-deployment keys. The
        key never leaves the application secret manager.
      </p>

      <h2>4. Network Security</h2>
      <ul>
        <li>TLS 1.2+ everywhere;</li>
        <li>HSTS, secure cookies, strict same-site;</li>
        <li>Webhook signature verification on Divinity Payments and streaming events;</li>
        <li>Rate limiting on auth and high-write endpoints.</li>
      </ul>

      <h2>5. Audit &amp; Logging</h2>
      <p>
        Admin actions (refunds, voids, account suspensions) are logged. Logs
        are retained per our standard retention schedule.
      </p>

      <h2>6. Reporting Security Issues</h2>
      <p>
        Email{" "}
        <a href="mailto:trust@indiecomicslive.com">trust@indiecomicslive.com</a>{" "}
        with reproduction steps. Please don&rsquo;t test against live data.
      </p>
    </Doc>
  );
}
