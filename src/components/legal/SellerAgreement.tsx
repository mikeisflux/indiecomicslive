import Doc from "./Doc";

export default function SellerAgreement() {
  return (
    <Doc slug="seller-agreement">
      <p>
        Approved Sellers on Indie Comics Live (operated by{" "}
        <strong>Divinity Comics Inc.</strong>, an Indiana nonprofit
        corporation) agree to the following responsibilities. This agreement
        is incorporated into the{" "}
        <a href="/legal/terms">Terms of Service</a> by reference.
      </p>

      <h2>1. Accuracy &amp; Transparency</h2>
      <ul>
        <li>Provide truthful and complete lot descriptions;</li>
        <li>Disclose grading, condition, completeness, and known defects;</li>
        <li>Use realistic images that match the actual item being sold;</li>
        <li>Disclose any restoration, signatures, or third-party authentication.</li>
      </ul>
      <p>Misleading or fraudulent listings are prohibited.</p>

      <h2>2. Order Fulfillment</h2>
      <ul>
        <li>Ship every paid order within your stated handling window (14 days max by default);</li>
        <li>Provide tracking through the platform;</li>
        <li>Communicate proactively if there are delays;</li>
        <li>Honor reasonable refund requests when items are not as described.</li>
      </ul>
      <p>
        See the <a href="/legal/shipping">Shipping Policy</a> and{" "}
        <a href="/legal/refunds">Refund Policy</a>.
      </p>

      <h2>3. Auction Conduct</h2>
      <ul>
        <li>
          <strong>No shill bidding.</strong> You may not bid on your own lots,
          coordinate with associates to inflate prices, or use multiple
          accounts;
        </li>
        <li>Honor every winning bid &mdash; you may not refuse to ship after a fair auction;</li>
        <li>Don&rsquo;t cancel lots mid-auction except for genuine emergencies, and disclose the reason in chat.</li>
      </ul>

      <h2>4. Communication</h2>
      <ul>
        <li>Respond to buyer messages within a reasonable window (typically 48 hours);</li>
        <li>Respect buyer privacy &mdash; addresses and contact info are for fulfillment only;</li>
        <li>Don&rsquo;t harass, dox, or retaliate against bidders for legitimate reviews or refund requests.</li>
      </ul>

      <h2>5. Legal Compliance</h2>
      <ul>
        <li>You are responsible for all sales taxes, business licenses, and regulatory requirements that apply to your products and your jurisdiction;</li>
        <li>You must not use the platform to ship items that are illegal in either your jurisdiction or the buyer&rsquo;s;</li>
        <li>For adult / NSFW content, you additionally agree to the{" "}
          <a href="/legal/nsfw">NSFW Policy</a>.</li>
      </ul>

      <h2>6. Identity Verification &amp; Due Diligence</h2>
      <p>Before approving a Seller, we conduct:</p>
      <ul>
        <li>
          <strong>Identity verification:</strong> Government-issued photo ID
          (and a state Secretary of State business filing if you operate as a
          business entity);
        </li>
        <li>
          <strong>Social media verification:</strong> All linked profiles are
          logged and reviewed by our team;
        </li>
        <li>
          <strong>Cross-platform audit:</strong> We search Whatnot, eBay,
          Kickstarter, Indiegogo, GoFundMe, and similar platforms to review
          your previous selling and campaign history, including buyer
          reviews, comments, and public feedback;
        </li>
        <li>
          <strong>Fulfillment history validation:</strong> We may contact you
          directly when discrepancies or concerns are identified;
        </li>
        <li>
          <strong>Payment account verification:</strong> Complete
          PaymentCloud bank-account setup and place a chargeback recovery card
          on file.
        </li>
      </ul>
      <p>
        All verification findings, correspondence, and review decisions are
        documented internally and retained for compliance and audit purposes.
      </p>
      <p>
        <strong>Automatic disqualification.</strong> Applicants are
        automatically declined if they have:
      </p>
      <ul>
        <li>
          <strong>Three or more unfulfilled campaigns</strong> on any
          crowdfunding or auction platform, or
        </li>
        <li>
          <strong>Any campaign more than one year past its stated delivery
          date</strong>, regardless of current fulfillment status.
        </li>
      </ul>
      <p>
        We reserve the right to refuse service to anyone, at any time, for
        any reason consistent with law and our policies.
      </p>

      <h2>7. Chargeback Recovery</h2>
      <p>
        You agree to keep a chargeback recovery card on file. If a chargeback
        occurs and your rolling reserve is insufficient, Divinity Comics Inc.
        may charge that card to recoup the loss. See the{" "}
        <a href="/legal/chargebacks">Chargebacks Policy</a> for full details.
      </p>

      <h2>8. Failure to Operate Responsibly</h2>
      <p>If you cannot fulfill an order, you must:</p>
      <ul>
        <li>Communicate immediately and clearly;</li>
        <li>Offer a refund where feasible;</li>
        <li>Demonstrate good-faith resolution.</li>
      </ul>
      <p>
        Sellers who fail to act responsibly may be removed from the
        platform.
      </p>

      <h2>9. Termination</h2>
      <p>
        We may suspend or terminate your seller status at any time for
        violation of this agreement, the <a href="/legal/terms">Terms</a>,
        the <a href="/legal/content-guidelines">Content Guidelines</a>, or
        applicable law. Terminated sellers remain liable for any chargebacks,
        refunds, and obligations arising from their prior activity.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions about seller responsibilities:{" "}
        <a href="mailto:sellers@indiecomicslive.com">sellers@indiecomicslive.com</a>
      </p>
    </Doc>
  );
}
