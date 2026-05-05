import Doc from "./Doc";

export default function ChargebacksPolicy() {
  return (
    <Doc slug="chargebacks">
      <h2>1. What a Chargeback Is</h2>
      <p>
        A chargeback is a forced reversal of a payment initiated by your
        card issuer. Chargebacks are a legitimate consumer protection &mdash;
        but on a marketplace, they have downstream effects on the seller and
        the platform.
      </p>

      <h2>2. Resolve First, Chargeback Last</h2>
      <p>
        We require buyers to attempt resolution through Indie Comics Live
        before filing a chargeback with their bank. Filing a chargeback
        without first contacting the seller and our support team is
        considered a violation of the{" "}
        <a href="/legal/bidder-agreement">Bidder Agreement</a> and may result
        in account suspension and addition to our IP blocklist.
      </p>

      <h2>3. How Sellers Are Affected</h2>
      <p>
        When a chargeback is filed:
      </p>
      <ul>
        <li>The disputed amount is reversed from the seller&rsquo;s pending payouts;</li>
        <li>PaymentCloud assesses a chargeback fee that is passed through to the seller;</li>
        <li>If the rolling reserve is insufficient, the seller&rsquo;s on-file chargeback recovery card is debited;</li>
        <li>Multiple unjustified chargebacks against a seller may trigger an account review.</li>
      </ul>

      <h2>4. Seller Chargeback Recovery Card</h2>
      <p>
        Every approved Seller must keep a chargeback recovery card on file
        via PaymentCloud&rsquo;s Customer Vault. The PAN never touches our
        servers &mdash; only a vault reference. By saving this card, the
        Seller authorizes Divinity Comics Inc., through PaymentCloud, to
        charge the card for chargeback losses, related fees, and any
        platform fees that cannot be netted from pending payouts.
      </p>

      <h2>5. Disputed Chargebacks</h2>
      <p>
        We provide sellers with the evidence package needed to dispute a
        chargeback (transaction records, shipping confirmation, lot
        descriptions, chat transcripts). If the dispute is won, the funds
        are returned to the seller minus any irreversible fees.
      </p>

      <h2>6. Friendly Fraud</h2>
      <p>
        Chargebacks where the buyer received the item as described and
        then disputes the charge anyway (&ldquo;friendly fraud&rdquo;) are
        treated as account-level fraud. Affected accounts are added to our
        IP blocklist and reported to industry fraud-prevention databases.
      </p>

      <h2>7. Contact</h2>
      <p>
        Disputes:{" "}
        <a href="mailto:trust@indiecomicslive.com">trust@indiecomicslive.com</a>
      </p>
    </Doc>
  );
}
