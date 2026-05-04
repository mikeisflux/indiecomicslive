import Doc from "./Doc";

export default function GdprCcpaNotice() {
  return (
    <Doc slug="gdpr-ccpa">
      <h2>1. EU Residents (GDPR)</h2>
      <p>If you are in the EU/EEA, you have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you;</li>
        <li>Rectify inaccurate data;</li>
        <li>Erase data (subject to legal retention obligations);</li>
        <li>Restrict or object to certain processing;</li>
        <li>Receive a portable copy of your data;</li>
        <li>Lodge a complaint with your supervisory authority.</li>
      </ul>
      <p>
        Our legal bases for processing: contract performance (operating the
        marketplace), legal obligation (tax, AML, KYC), and legitimate
        interest (fraud prevention, platform security).
      </p>

      <h2>2. California Residents (CCPA / CPRA)</h2>
      <p>If you are a California resident, you have the right to:</p>
      <ul>
        <li>Know what personal information we collect, use, disclose, and sell or share;</li>
        <li>Delete your personal information (with limited exceptions);</li>
        <li>Correct inaccurate personal information;</li>
        <li>Opt out of the sale or sharing of personal information.</li>
      </ul>
      <p>
        <strong>We do not sell or share personal information for cross-context behavioral advertising.</strong>{" "}
        You may still exercise your right to opt out as a matter of record by
        emailing{" "}
        <a href="mailto:privacy@indiecomics.live">privacy@indiecomics.live</a>.
      </p>

      <h2>3. How to Exercise Your Rights</h2>
      <p>
        Email{" "}
        <a href="mailto:privacy@indiecomics.live">privacy@indiecomics.live</a>{" "}
        from the address associated with your account. We may need to verify
        your identity before fulfilling certain requests.
      </p>

      <h2>4. Data Retention</h2>
      <p>
        We retain transaction records for 7 years for tax and audit purposes
        even after account deletion. See the{" "}
        <a href="/legal/data-deletion">Data Deletion Policy</a>.
      </p>

      <h2>5. Authorized Agents</h2>
      <p>
        California residents may designate an authorized agent to act on
        their behalf. We&rsquo;ll request written authorization and verify
        the agent&rsquo;s identity.
      </p>
    </Doc>
  );
}
