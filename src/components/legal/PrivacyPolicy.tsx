import Doc from "./Doc";

export default function PrivacyPolicy() {
  return (
    <Doc slug="privacy">
      <p>
        This Privacy Policy describes how <strong>Divinity Comics Inc.</strong>
        , an Indiana nonprofit corporation operating <strong>Indie Comics
        Live</strong> (&ldquo;we,&rdquo; &ldquo;our,&rdquo; &ldquo;us&rdquo;),
        collects, uses, stores, and protects your personal information when
        you visit indiecomics.live or use our Services.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>A. Information you provide</h3>
      <ul>
        <li>Name, email address, optional phone number;</li>
        <li>Date of birth (sellers only, for KYC);</li>
        <li>Government-issued ID (sellers only, for KYC);</li>
        <li>Bank account information (sellers only, for payouts);</li>
        <li>
          Card details handled exclusively by PaymentCloud&rsquo;s tokenization
          (CollectJS) &mdash; we never receive or store full card numbers
          (PCI SAQ-A scope);
        </li>
        <li>
          Lot listings, images, store bios, livestream broadcasts, chat
          messages, and order history;
        </li>
        <li>Shipping addresses;</li>
        <li>Messages to support and other users.</li>
      </ul>

      <h3>B. Information collected automatically</h3>
      <ul>
        <li>IP address and approximate location;</li>
        <li>Device and browser information;</li>
        <li>Usage analytics, pages visited, actions taken;</li>
        <li>Cookies and similar technologies (see our{" "}
          <a href="/legal/cookies">Cookie Policy</a>).</li>
      </ul>

      <h3>C. Information from third parties</h3>
      <ul>
        <li>
          Payment processors (PaymentCloud / NMI) return transaction status
          and limited card metadata (brand, last 4, expiry);
        </li>
        <li>Identity verification providers return KYC outcomes for sellers;</li>
        <li>Streaming infrastructure (Ant Media) returns broadcast metadata.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>To create and operate accounts and process payments;</li>
        <li>To facilitate communication between sellers and bidders;</li>
        <li>To send transactional notifications and updates;</li>
        <li>To detect fraud, prevent abuse, and enforce our Terms;</li>
        <li>To comply with our legal and tax obligations.</li>
      </ul>
      <p>
        <strong>We do not sell your personal data.</strong>
      </p>

      <h2>3. Sharing Your Information</h2>
      <p>We may share information with:</p>
      <ul>
        <li>
          <strong>Payment processors</strong> (PaymentCloud / NMI) to process
          transactions;
        </li>
        <li>
          <strong>Streaming infrastructure</strong> (Ant Media) to enable
          live video;
        </li>
        <li>
          <strong>Identity verification providers</strong> (sellers only) to
          complete KYC;
        </li>
        <li>
          <strong>Sellers</strong> &mdash; bidders&rsquo; names and shipping
          addresses are shared with sellers to fulfill orders;
        </li>
        <li>
          <strong>Cloud and hosting providers</strong> (e.g., AWS, Cloudflare
          R2) used as data processors;
        </li>
        <li>
          <strong>Legal and regulatory authorities</strong> when required by
          law.
        </li>
      </ul>
      <p>
        Sellers must keep buyer information confidential and may use it only
        for order fulfillment and post-sale communication.
      </p>

      <h2>4. Cookies &amp; Tracking</h2>
      <p>
        We use cookies for session authentication, fraud prevention, and
        analytics. See our <a href="/legal/cookies">Cookie Policy</a>.
      </p>

      <h2>5. Data Storage &amp; Security</h2>
      <ul>
        <li>Encryption in transit (TLS 1.2+);</li>
        <li>
          Encryption at rest for sensitive seller PII (bank account details
          via AES-256-GCM);
        </li>
        <li>Card PANs never touch our servers (PaymentCloud CollectJS);</li>
        <li>Access controls and audit logging on admin actions;</li>
        <li>Regular security review.</li>
      </ul>
      <p>
        No system is 100% secure, but we take commercially reasonable steps
        to protect your data.
      </p>

      <h2>6. Your Rights</h2>
      <p>Depending on your jurisdiction, you may have rights to:</p>
      <ul>
        <li>Access the personal data we hold about you;</li>
        <li>Correct inaccurate information;</li>
        <li>Delete your account (see our <a href="/legal/data-deletion">Data Deletion Policy</a>);</li>
        <li>Receive a portable copy of your data;</li>
        <li>Opt out of marketing communications.</li>
      </ul>
      <p>
        EU residents have additional rights under the GDPR, and California
        residents have additional rights under the CCPA &mdash; see our{" "}
        <a href="/legal/gdpr-ccpa">GDPR &amp; CCPA Notice</a>.
      </p>
      <p>
        Submit requests to{" "}
        <a href="mailto:privacy@indiecomics.live">privacy@indiecomics.live</a>.
      </p>

      <h2>7. Children</h2>
      <p>
        The Services are intended for users 18 years of age and older. We do
        not knowingly collect data from children. If we learn we have
        collected information from a minor, we&rsquo;ll delete it.
      </p>

      <h2>8. International Transfers</h2>
      <p>
        Indie Comics Live is operated from the United States. By using the
        Services, you consent to the transfer and processing of your
        information in the United States.
      </p>

      <h2>9. Retention</h2>
      <p>
        We retain personal information for as long as your account is active
        and as needed for legal, tax, and audit purposes (typically 7 years
        for transaction records).
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material
        changes will be communicated via email or in-app notice.
      </p>

      <h2>11. Contact</h2>
      <p>
        Divinity Comics Inc.
        <br />
        Privacy:{" "}
        <a href="mailto:privacy@indiecomics.live">privacy@indiecomics.live</a>
      </p>
    </Doc>
  );
}
