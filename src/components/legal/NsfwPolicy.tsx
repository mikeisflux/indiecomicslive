import Doc from "./Doc";

export default function NsfwPolicy() {
  return (
    <Doc slug="nsfw">
      <p>
        Indie Comics Live is built to support adult-friendly creators. This
        policy spells out what is and isn&rsquo;t allowed when listing,
        streaming, or buying NSFW material.
      </p>

      <h2>1. Who This Applies To</h2>
      <p>
        Any seller who lists adult-oriented work, any show flagged 18+, and
        every bidder who enters an 18+ show.
      </p>

      <h2>2. Hard Limits (Zero Tolerance)</h2>
      <ul>
        <li>
          <strong>No minors.</strong> All depicted persons must be 18 years
          of age or older. Sellers must be able to provide proof on request.
          For drawn / illustrated work, no character may be depicted as a
          minor in a sexual context, regardless of artistic style;
        </li>
        <li>No content depicting non-consensual acts presented approvingly;</li>
        <li>No content that violates federal obscenity law in the United States;</li>
        <li>No bestiality, no necrophilia, no extreme gore;</li>
        <li>No content created without the depicted person&rsquo;s consent (revenge / leak material).</li>
      </ul>

      <h2>3. Seller Requirements</h2>
      <ul>
        <li>Mark every NSFW show as 18+ at scheduling time;</li>
        <li>Tag NSFW lots with the appropriate categories;</li>
        <li>For shows including live human models, sellers must have signed model releases on file (not stored on our servers, but produceable on request);</li>
        <li>Comply with 18 U.S.C. § 2257 record-keeping requirements where applicable to the seller&rsquo;s own production.</li>
      </ul>

      <h2>4. Bidder Requirements</h2>
      <ul>
        <li>You must be 18+ and in a jurisdiction where adult content is legal to enter an 18+ show;</li>
        <li>You agree the platform&rsquo;s 18+ entry confirmation is binding even if your jurisdiction later requires stricter ID-based verification;</li>
        <li>Don&rsquo;t screenshot, screen-record, or redistribute adult content without the seller&rsquo;s permission.</li>
      </ul>

      <h2>5. Live Streaming Rules</h2>
      <ul>
        <li>Static display of adult comic art and art books is allowed;</li>
        <li>Sellers may discuss the work, including explicit content;</li>
        <li>Live sexual performance, full nudity for the purpose of arousal, or explicit acts on camera are not allowed in our standard shows. Compliance partners may be added in the future to support this kind of content with stricter age verification gating.</li>
      </ul>

      <h2>6. Reporting</h2>
      <p>
        Report violations to{" "}
        <a href="mailto:trust@indiecomics.live">trust@indiecomics.live</a>.
        Suspected CSAM is reported to NCMEC immediately and to law enforcement
        as appropriate.
      </p>

      <h2>7. Compliance Notice</h2>
      <p>
        Several U.S. states (including Texas, Louisiana, Utah, Mississippi,
        Virginia, North Carolina, Indiana, and others) and the United
        Kingdom (Online Safety Act) require ID-based age verification for
        commercial adult sites. We comply with applicable law in each
        jurisdiction. Where required, ID-based age verification will be
        enabled for users in that jurisdiction.
      </p>
    </Doc>
  );
}
