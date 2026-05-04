import Doc from "./Doc";

export default function AiPolicy() {
  return (
    <Doc slug="ai">
      <h2>1. How We Use AI Internally</h2>
      <ul>
        <li>Trust &amp; Safety: classifier-assisted review of listings, chat, and stream thumbnails for policy violations;</li>
        <li>Fraud detection: anomaly scoring on bid patterns and payment events;</li>
        <li>Search and recommendations: ranking models that operate on listing metadata;</li>
        <li>Customer support: drafting responses for human review (no automated final replies on policy decisions).</li>
      </ul>

      <h2>2. AI-Generated Content From Sellers</h2>
      <p>
        Sellers who list AI-generated or AI-assisted artwork must:
      </p>
      <ul>
        <li>Disclose AI use in the lot description;</li>
        <li>Have lawful rights to the input data and the output (no training-data laundering);</li>
        <li>Not use AI to mimic a living artist&rsquo;s style without permission in a way that misrepresents authorship.</li>
      </ul>
      <p>
        Pure AI-generated derivatives of copyrighted characters or styles
        without authorization may be removed under our DMCA process.
      </p>

      <h2>3. Deepfakes</h2>
      <p>
        Non-consensual deepfakes of real people are prohibited. This is a
        zero-tolerance rule.
      </p>

      <h2>4. No Training on User Content Without Notice</h2>
      <p>
        We do not sell user-generated content to third-party AI training
        operators. If our internal models train on platform data (such as
        moderation classifiers), we do so only on data within the operating
        scope of the platform, never resold.
      </p>
    </Doc>
  );
}
