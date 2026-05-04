import TermsOfService from "./TermsOfService";
import PrivacyPolicy from "./PrivacyPolicy";
import SellerAgreement from "./SellerAgreement";
import BidderAgreement from "./BidderAgreement";
import ContentGuidelines from "./ContentGuidelines";
import NsfwPolicy from "./NsfwPolicy";
import RefundPolicy from "./RefundPolicy";
import ChargebacksPolicy from "./ChargebacksPolicy";
import ShippingPolicy from "./ShippingPolicy";
import DmcaPolicy from "./DmcaPolicy";
import FraudPolicy from "./FraudPolicy";
import CookiePolicy from "./CookiePolicy";
import GdprCcpaNotice from "./GdprCcpaNotice";
import DataDeletionPolicy from "./DataDeletionPolicy";
import AiPolicy from "./AiPolicy";
import PciCompliance from "./PciCompliance";
import type { LegalSlug } from "@/lib/legal";

export const LEGAL_COMPONENTS: Record<LegalSlug, () => JSX.Element> = {
  terms: TermsOfService,
  privacy: PrivacyPolicy,
  "seller-agreement": SellerAgreement,
  "bidder-agreement": BidderAgreement,
  "content-guidelines": ContentGuidelines,
  nsfw: NsfwPolicy,
  refunds: RefundPolicy,
  chargebacks: ChargebacksPolicy,
  shipping: ShippingPolicy,
  dmca: DmcaPolicy,
  fraud: FraudPolicy,
  cookies: CookiePolicy,
  "gdpr-ccpa": GdprCcpaNotice,
  "data-deletion": DataDeletionPolicy,
  ai: AiPolicy,
  pci: PciCompliance,
};
