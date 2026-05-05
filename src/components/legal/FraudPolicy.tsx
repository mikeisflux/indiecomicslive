import Doc from "./Doc";

export default function FraudPolicy() {
  return (
    <Doc slug="fraud">
      <h2>1. What We Watch For</h2>
      <ul>
        <li>Shill bidding and coordinated bidding rings;</li>
        <li>Account takeover (ATO) &mdash; unusual logins, IP changes, password resets followed by purchases;</li>
        <li>Synthetic-identity sellers (fake KYC documents);</li>
        <li>Friendly-fraud chargebacks;</li>
        <li>Off-platform payment solicitation in chat;</li>
        <li>Counterfeit-item listings.</li>
      </ul>

      <h2>2. How We Detect It</h2>
      <ul>
        <li>Payment-processor risk signals from Divinity Payments;</li>
        <li>IP, device, and behavioral fingerprinting;</li>
        <li>Cross-account graph analysis on bidder-seller-shipping triples;</li>
        <li>KYC document review for sellers (manual + automated);</li>
        <li>Buyer reports;</li>
        <li>Periodic audits of high-velocity accounts.</li>
      </ul>

      <h2>3. Response</h2>
      <ul>
        <li>Holds, reverses, or voids on suspicious transactions;</li>
        <li>Account suspension pending review;</li>
        <li>IP blocklist additions for confirmed fraud;</li>
        <li>Reports to industry fraud-prevention databases;</li>
        <li>Cooperation with law enforcement on confirmed criminal activity.</li>
      </ul>

      <h2>4. Reporting Suspected Fraud</h2>
      <p>
        Email{" "}
        <a href="mailto:trust@indiecomicslive.com">trust@indiecomicslive.com</a>{" "}
        with as much detail as you can. We treat reports as confidential.
      </p>
    </Doc>
  );
}
