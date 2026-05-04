import Doc from "./Doc";

export default function RefundPolicy() {
  return (
    <Doc slug="refunds">
      <p>
        Indie Comics Live is an auction marketplace. Bids are binding offers,
        but we recognize that legitimate refund situations exist.
      </p>

      <h2>1. Eligible Refund Reasons</h2>
      <ul>
        <li>Item not received within 30 days of payment;</li>
        <li>Item materially different from the description (wrong issue, wrong condition, missing pages, etc.);</li>
        <li>Item arrived damaged because of inadequate packaging by the seller;</li>
        <li>Counterfeit or unauthorized item.</li>
      </ul>

      <h2>2. Not Eligible</h2>
      <ul>
        <li>Buyer&rsquo;s remorse;</li>
        <li>Bid mistakes (wrong amount, bid on wrong lot);</li>
        <li>Item value drop after the auction;</li>
        <li>Damage caused by the carrier when the seller used reasonable packaging (file a carrier claim instead).</li>
      </ul>

      <h2>3. How to Request a Refund</h2>
      <ol className="list-decimal pl-6">
        <li>Open the order on /orders/[id];</li>
        <li>Use &ldquo;Request refund&rdquo; (coming soon) or email{" "}
          <a href="mailto:support@indiecomics.live">support@indiecomics.live</a>;</li>
        <li>Include order ID, photos of the item if there&rsquo;s a defect, and a brief description.</li>
      </ol>

      <h2>4. Resolution Timeline</h2>
      <ul>
        <li>Sellers have 5 business days to respond;</li>
        <li>If no resolution within 10 business days, our team can step in;</li>
        <li>Approved refunds typically post to the original card within 5&ndash;10 business days.</li>
      </ul>

      <h2>5. Partial Refunds</h2>
      <p>
        Sellers and buyers may agree to a partial refund (for example, when
        an item arrives in lower-than-described condition but is still
        usable). Partial refunds are processed against the original
        transaction.
      </p>

      <h2>6. Chargebacks vs. Refunds</h2>
      <p>
        Always request a refund through the platform first. Filing a
        chargeback before attempting platform resolution may result in
        account suspension &mdash; see the{" "}
        <a href="/legal/chargebacks">Chargebacks Policy</a>.
      </p>
    </Doc>
  );
}
