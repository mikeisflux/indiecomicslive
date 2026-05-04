import Doc from "./Doc";

export default function ShippingPolicy() {
  return (
    <Doc slug="shipping">
      <h2>1. Sellers Ship Directly</h2>
      <p>
        Indie Comics Live does not warehouse inventory. Each Seller ships
        directly to the buyer.
      </p>

      <h2>2. Handling Window</h2>
      <p>
        Default handling window is <strong>14 calendar days</strong> from
        the order being marked paid. Sellers may set a shorter handling
        window for individual shows, but never longer without disclosing it
        in the show description and on each lot.
      </p>

      <h2>3. Tracked Shipping Required</h2>
      <p>
        Sellers must ship with tracking and add the tracking number to the
        order through their dashboard. Untracked shipments are at the
        seller&rsquo;s risk &mdash; if a buyer claims non-receipt, an
        untracked shipment defaults to a refund.
      </p>

      <h2>4. International Shipping</h2>
      <p>
        Sellers who ship internationally are responsible for customs
        declarations, accurate item-value declarations, and any
        export-control compliance. Buyers are responsible for any duties
        and taxes assessed by their destination country.
      </p>

      <h2>5. Lost Packages</h2>
      <p>
        If a tracked package is lost in transit, the seller must file a
        carrier claim and either reship or refund the buyer. Indie Comics
        Live does not pay for carrier-loss replacements directly.
      </p>

      <h2>6. Damaged in Transit</h2>
      <p>
        Buyers should photograph the packaging and item before discarding.
        If the damage is due to inadequate packaging by the seller, the
        seller is responsible. If the damage is carrier-caused despite
        reasonable packaging, the seller files the carrier claim.
      </p>

      <h2>7. Combined Shipping</h2>
      <p>
        Sellers may combine multiple wins from the same buyer into a single
        shipment to save on postage. Combined-shipping policy is set by
        each seller and disclosed at the show level.
      </p>

      <h2>8. Prohibited Shipments</h2>
      <p>
        See the <a href="/legal/content-guidelines">Content Guidelines</a>.
        Shipping prohibited items will result in account termination.
      </p>
    </Doc>
  );
}
