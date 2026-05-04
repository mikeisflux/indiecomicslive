import Doc from "./Doc";

export default function DataDeletionPolicy() {
  return (
    <Doc slug="data-deletion">
      <h2>1. How to Delete Your Account</h2>
      <p>
        Sign in and visit Account &rarr; Delete Account, or email{" "}
        <a href="mailto:privacy@indiecomics.live">privacy@indiecomics.live</a>{" "}
        from the email address on file.
      </p>

      <h2>2. What Gets Deleted Immediately</h2>
      <ul>
        <li>Bio, location, social links, profile image, banner;</li>
        <li>Saved addresses (kept on shipped orders only as needed);</li>
        <li>Saved payment methods (vault entries are deleted from PaymentCloud);</li>
        <li>OAuth tokens and connected-app credentials;</li>
        <li>Chat presence, follow lists, draft listings, watch lists;</li>
        <li>Email subscriptions.</li>
      </ul>

      <h2>3. What We Retain</h2>
      <p>
        Some data is retained for legal, tax, and audit reasons even after
        deletion:
      </p>
      <ul>
        <li>
          <strong>Order records:</strong> Buyer/seller name, email, item
          purchased, amount, transaction id &mdash; retained for 7 years per
          IRS and PaymentCloud audit requirements;
        </li>
        <li>
          <strong>KYC documentation</strong> (sellers): retained for the
          duration required by the underlying processor and AML rules;
        </li>
        <li>
          <strong>Chargeback and dispute records:</strong> retained for the
          life of the platform;
        </li>
        <li>
          <strong>Aggregated analytics</strong> (no PII).
        </li>
      </ul>

      <h2>4. Deletion vs. Soft-Delete</h2>
      <ul>
        <li>
          <strong>Account deletion (irreversible).</strong> User-initiated
          permanent deletion. We cannot restore a deleted account.
        </li>
        <li>
          <strong>Mod soft-delete (reversible).</strong> A moderator can mark
          your account deleted to remove access while preserving the record.
          Reversible by support.
        </li>
      </ul>

      <h2>5. Pending Activity at Deletion Time</h2>
      <ul>
        <li>Pending bids are cancelled;</li>
        <li>Active live shows owned by the user are ended;</li>
        <li>Unshipped orders remain &mdash; the seller still owes the buyer;</li>
        <li>Unfulfilled chargebacks remain billable to the on-file recovery card.</li>
      </ul>

      <h2>6. Backups</h2>
      <p>
        Backup snapshots are rotated on a 30-day cycle. Deleted PII is
        purged from primary storage immediately and ages out of backups
        within that window.
      </p>
    </Doc>
  );
}
