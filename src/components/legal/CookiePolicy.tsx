import Doc from "./Doc";

export default function CookiePolicy() {
  return (
    <Doc slug="cookies">
      <h2>1. What We Use</h2>
      <ul>
        <li>
          <strong>Strictly necessary:</strong> session authentication
          (Auth.js), CSRF protection, age-gate confirmation, payment-form
          tokenization (CollectJS / PaymentCloud);
        </li>
        <li>
          <strong>Functional:</strong> remembering your preferred handle,
          theme, viewport, recently watched shows;
        </li>
        <li>
          <strong>Analytics:</strong> aggregate, privacy-respecting metrics
          on page views and feature use;
        </li>
        <li>
          <strong>Security:</strong> bot-prevention and fraud-detection
          fingerprints.
        </li>
      </ul>

      <h2>2. What We Don&rsquo;t Use</h2>
      <ul>
        <li>Third-party advertising trackers;</li>
        <li>Cross-site behavioral profiling;</li>
        <li>Sale of cookie-derived data to third parties.</li>
      </ul>

      <h2>3. Your Choices</h2>
      <p>
        You can clear cookies in your browser at any time. Disabling
        strictly-necessary cookies will break sign-in and bidding. You can
        opt out of marketing emails from your account settings.
      </p>

      <h2>4. Third Parties</h2>
      <p>
        We embed scripts from PaymentCloud (for card tokenization) and Ant
        Media (for video). These services may set their own cookies for the
        duration of the request.
      </p>
    </Doc>
  );
}
