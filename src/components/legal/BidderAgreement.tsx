import Doc from "./Doc";

export default function BidderAgreement() {
  return (
    <Doc slug="bidder-agreement">
      <p>
        By placing a bid on Indie Comics Live (operated by{" "}
        <strong>Divinity Comics Inc.</strong>, an Indiana nonprofit
        corporation), you agree to the following.
      </p>

      <h2>1. Bids Are Binding Offers</h2>
      <p>
        Each bid you place is a binding offer to purchase the lot for the
        bid amount, plus any applicable shipping, sales tax, and platform
        fees. If you are the highest bidder when the lot closes, the offer
        is accepted and you are obligated to pay.
      </p>

      <h2>2. Saved-Card Authorization (MIT)</h2>
      <p>
        To bid, you must save a payment method via PaymentCloud&rsquo;s
        CollectJS tokenization. By saving a card, you authorize Divinity
        Comics Inc., through PaymentCloud, to charge that card automatically
        whenever you win a lot. This is a{" "}
        <strong>merchant-initiated transaction</strong> with credential-on-file
        flags consistent with card-network rules.
      </p>
      <p>
        If a charge is declined, the order will remain open and we may retry
        the charge or ask you to update your card. Repeated declines may
        result in account suspension.
      </p>

      <h2>3. Shipping &amp; Fulfillment</h2>
      <p>
        Sellers ship items directly. Shipping costs, handling windows, and
        return policies are set by each seller and disclosed on the lot or in
        the seller&rsquo;s store profile. See the{" "}
        <a href="/legal/shipping">Shipping Policy</a>.
      </p>

      <h2>4. Refunds, Disputes, and Chargebacks</h2>
      <p>
        Refund and dispute resolution is described in the{" "}
        <a href="/legal/refunds">Refund Policy</a>. Filing a chargeback before
        attempting to resolve a dispute through Indie Comics Live is grounds
        for account suspension &mdash; see the{" "}
        <a href="/legal/chargebacks">Chargebacks Policy</a>.
      </p>

      <h2>5. Conduct</h2>
      <ul>
        <li>No bid retraction except in the case of an obvious typo, and only before the lot closes;</li>
        <li>No coordinated bidding, account-sharing, or proxy bidding to manipulate price;</li>
        <li>Be respectful in chat &mdash; harassment, hate speech, doxxing, and threats are grounds for permanent ban;</li>
        <li>Don&rsquo;t share, screenshot, or distribute another user&rsquo;s personal information.</li>
      </ul>

      <h2>6. Adult Content</h2>
      <p>
        Some shows feature adult / NSFW content. By entering an 18+ stream you
        confirm you are at least 18 years of age and that adult content is
        legal in your jurisdiction. See the{" "}
        <a href="/legal/nsfw">NSFW Policy</a>.
      </p>

      <h2>7. Termination</h2>
      <p>
        We may suspend or terminate your bidding privileges for violation of
        this agreement or applicable law. Outstanding obligations (paid or
        owed) survive termination.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions:{" "}
        <a href="mailto:support@indiecomics.live">support@indiecomics.live</a>
      </p>
    </Doc>
  );
}
