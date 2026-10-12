// ---------------------------------------------------------------------------
// Legal content — typed, static policy copy for /legal/[slug].
// Each document is real, substantive policy text written for HomeNest Kitchen
// (an e-commerce storefront). ~400–600 words per document.
// Body copy references the contact address through the {{contactEmail}} token
// (session-7 S7-5): the admin-editable settings.contactEmail is substituted at
// render time (legal/[slug]/page.tsx), so the legally binding paragraphs can
// never contradict the footer or the other contact surfaces.
// ---------------------------------------------------------------------------

/**
 * Substitute every {{contactEmail}} token with the live settings address.
 * Pure, unit-pinned in tests/unit/session7-hardening.test.ts. Text without
 * the token passes through untouched; other {{…}} sequences are left alone
 * (the token is the only recognized placeholder).
 */
export function interpolateContactEmail(text: string, contactEmail: string): string {
  return text.split("{{contactEmail}}").join(contactEmail);
}

export type LegalSection = {
  heading: string;
  body: string[];
};

export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

export type LegalSlug =
  | "privacy-policy"
  | "terms-of-service"
  | "disclaimer"
  | "cookie-policy"
  | "refund-policy";

export const LEGAL_SLUGS: LegalSlug[] = [
  "privacy-policy",
  "terms-of-service",
  "disclaimer",
  "cookie-policy",
  "refund-policy",
];

export const legalContent: Record<LegalSlug, LegalDoc> = {
  "privacy-policy": {
    title: "Privacy Policy",
    updated: "January 2026",
    intro:
      "This Privacy Policy explains what information HomeNest Kitchen collects when you browse our store or place an order, how we use and protect that information, and the choices you have. We collect the minimum data needed to run a great shop — nothing more.",
    sections: [
      {
        heading: "Information We Collect",
        body: [
          "When you create an account, sign in, or check out, we collect the details you give us directly: your name, email address, phone number (optional), shipping addresses, and order history. We also store a record of the items you buy so we can honor warranties, process returns, and provide support.",
          "When you browse the store, we collect limited technical information such as your browser type, device category, pages visited, and referring site. This data is aggregated and used to keep pages fast, fix broken flows, and understand which products deserve more shelf space.",
          "Payment card numbers are never stored on our servers. Payments are handled by our payment processor, which transmits card data over an encrypted connection and returns only a masked indicator (such as the last four digits) so your receipts are recognizable.",
        ],
      },
      {
        heading: "How We Use Your Information",
        body: [
          "We use your information to process and fulfill orders, send order status and shipping notifications, provide customer support, and maintain your account features such as saved addresses and wishlists. If you subscribe to our newsletter, we use your email to send occasional product news and offers.",
          "Aggregated usage data helps us improve the store: search quality, page performance, product recommendations, and inventory planning. We do not sell your personal information to third parties, and we do not use your data to build advertising profiles for other companies.",
        ],
      },
      {
        heading: "How We Share Information",
        body: [
          "We share data only with the service providers that help us operate the store: payment processors, shipping carriers, and email delivery services. Each receives only the information required for its job — a carrier gets your shipping label details, not your order notes; an email provider gets your email address, not your full order history.",
          "We may disclose information if required by law, regulation, or valid legal process, or if necessary to protect the rights, property, or safety of HomeNest Kitchen, our customers, or others.",
        ],
      },
      {
        heading: "Data Retention & Security",
        body: [
          "We keep account and order data for as long as your account is active and for a reasonable period afterward to meet tax, accounting, and warranty obligations. When data is no longer needed, it is deleted or anonymized.",
          "We protect your data with industry-standard safeguards: passwords are stored using salted, memory-hard hashing; sessions are secured with signed, HTTP-only cookies; and all traffic is encrypted in transit. No system is perfectly secure, but we design ours so a single failure never exposes sensitive credentials.",
        ],
      },
      {
        heading: "Your Rights & Choices",
        body: [
          "You may access, correct, or delete the personal information associated with your account at any time from the Account page, or by emailing {{contactEmail}}. You can unsubscribe from marketing emails using the link in any message. If you request deletion, we will remove your data except where we are legally required to retain it (for example, completed-order records for tax purposes).",
          "If you have questions about this policy or how your data is handled, contact us at {{contactEmail}} and we will respond within 24 hours on business days.",
        ],
      },
    ],
  },

  "terms-of-service": {
    title: "Terms of Service",
    updated: "January 2026",
    intro:
      "Welcome to HomeNest Kitchen. These Terms of Service govern your use of our website and your purchases from it. By browsing the store, creating an account, or placing an order, you agree to these terms.",
    sections: [
      {
        heading: "Using the Store",
        body: [
          "You may use HomeNest Kitchen for lawful, personal, non-commercial purposes. You agree not to misuse the site: no scraping at volumes that degrade service, no attempts to breach authentication or access other customers' data, no fraudulent orders, and no interference with the store's normal operation.",
          "You are responsible for keeping your account credentials confidential and for activity that occurs under your account. Notify us immediately at {{contactEmail}} if you suspect unauthorized use.",
        ],
      },
      {
        heading: "Products, Pricing & Availability",
        body: [
          "We work hard to display products, colors, and specifications accurately, but we are human: minor variations between photography and the physical product can occur, and handmade items differ slightly piece to piece. Product pages describe the item you should generally expect.",
          "Prices are listed in US dollars and can change at any time before an order is confirmed. If a product is mispriced or becomes unavailable after you order, we will contact you to confirm or cancel that portion of the order, and we will refund any amount charged for items we cannot ship.",
        ],
      },
      {
        heading: "Orders & Payment",
        body: [
          "Your order is an offer to buy; it is accepted when we send the order confirmation. Payment is charged at checkout through our payment processor. We accept the payment methods shown at checkout and never store your full card number on our systems.",
          "Sales tax is calculated based on the shipping address and applicable rates. Shipping costs and free-shipping thresholds are shown before you complete checkout. You are responsible for providing a complete, accurate shipping address; we cannot reship orders lost due to address errors.",
        ],
      },
      {
        heading: "Warranties & Product Care",
        body: [
          "Selected cookware, knives, and appliances include a manufacturer's warranty, described on the product page. Warranties cover manufacturing defects under normal household use; they do not cover misuse, commercial use, unauthorized repairs, or ordinary wear and tear. Care instructions shipped with your product are part of the bargain — following them keeps your warranty intact.",
        ],
      },
      {
        heading: "Limitation of Liability & Changes",
        body: [
          "To the maximum extent permitted by law, HomeNest Kitchen is not liable for indirect, incidental, special, or consequential damages arising from your use of the site or products, and our total liability for any claim is limited to the amount you paid for the order giving rise to the claim.",
          "We may update these terms as the store evolves. The version posted here at the time of your order applies to that order. Material changes will be announced on the site. Questions? Email {{contactEmail}} — a human will answer.",
        ],
      },
    ],
  },

  disclaimer: {
    title: "Disclaimer",
    updated: "January 2026",
    intro:
      "The information provided by HomeNest Kitchen is for general consumer purposes. This disclaimer explains the limits of that information and how to use it sensibly.",
    sections: [
      {
        heading: "General Information Only",
        body: [
          "Product descriptions, images, specifications, care instructions, and recipes published on this site are provided in good faith for general informational purposes. While we strive for accuracy and test the products we sell, we make no representation or warranty of any kind, express or implied, about the completeness, accuracy, or reliability of the information presented.",
          "Colors can vary between screens and between dye lots of natural materials such as walnut and copper. Handmade and small-batch items are, by nature, individually unique — minor variations in finish, grain, or weight are features of craftsmanship, not defects.",
        ],
      },
      {
        heading: "Safety & Kitchen Use",
        body: [
          "Kitchen tools involve sharp edges, heat, and electricity. Always read and follow the safety instructions supplied with your product. Nothing on this site constitutes professional, medical, or dietary advice; consult a qualified professional for questions about food safety, allergies, or appliance installation.",
          "Use cookware and appliances only for their intended purpose. Damage arising from misuse — overheating empty pans, dishwasher-cleaning items marked hand-wash, or modifying electrical products — is not covered by our guarantees or the manufacturer's warranty.",
        ],
      },
      {
        heading: "External Links",
        body: [
          "Our site may link to third-party resources, such as care guides or manufacturer pages. We do not control and are not responsible for the content, availability, or policies of those sites. A link is a convenience, not an endorsement.",
        ],
      },
      {
        heading: "Errors & Omissions",
        body: [
          "If you spot an error in a product description, price, or specification, please tell us at {{contactEmail}}. We correct verified mistakes promptly and will make things right on any affected order. Your use of the site and reliance on its information is at your own discretion.",
        ],
      },
    ],
  },

  "cookie-policy": {
    title: "Cookie Policy",
    updated: "January 2026",
    intro:
      "This Cookie Policy explains how HomeNest Kitchen uses cookies and similar technologies to keep the store working, remember your preferences, and understand how the site is used.",
    sections: [
      {
        heading: "What Are Cookies?",
        body: [
          "Cookies are small text files placed on your device when you visit a website. They allow the site to remember your actions and preferences over time — for example, keeping you signed in as you move from page to page. Similar technologies such as local storage work in much the same way and are covered by this policy too.",
        ],
      },
      {
        heading: "Cookies We Use",
        body: [
          "Essential cookies keep the store functional. Our session cookie (an HTTP-only, signed value) keeps you signed in securely; a guest cart token remembers your cart between visits until you check out or clear it. These cookies are required for core features like authentication and checkout — the store cannot work without them.",
          "Preference and analytics cookies are optional. They remember choices such as your sorting preference and help us measure page performance and spot broken flows in aggregate. We do not use advertising cookies and do not sell behavioral data to third parties.",
        ],
      },
      {
        heading: "Managing Cookies",
        body: [
          "You can control or delete cookies through your browser settings — every major browser lets you view, block, or remove cookies per site. If you block essential cookies, features that depend on them will stop working: you won't be able to stay signed in, and your cart won't persist between visits.",
          "Signing out deletes your session cookie from our side. Clearing cookies in your browser removes all stored values, including your cart token, so a guest cart will start fresh on your next visit.",
        ],
      },
      {
        heading: "Changes to This Policy",
        body: [
          "If our cookie practices change — for example, if we add optional analytics tooling — we will update this page and note the change in the 'Last updated' date. Questions about cookies? Email {{contactEmail}} and we'll explain exactly what is stored on your device.",
        ],
      },
    ],
  },

  "refund-policy": {
    title: "Refund Policy",
    updated: "January 2026",
    intro:
      "We want you to love what lands on your doorstep. This Refund Policy explains how returns, exchanges, and refunds work at HomeNest Kitchen, in plain language.",
    sections: [
      {
        heading: "30-Day Returns",
        body: [
          "Unused items in their original packaging may be returned within 30 days of delivery for a full refund to your original payment method. That includes most cookware, bakeware, tools, and storage — if it hasn't been used and it's in resellable condition, it qualifies.",
          "A few categories are excluded for hygiene and safety reasons: opened food-contact items that cannot be sanitized (such as used cutlery sets), gift cards, and clearance items marked 'final sale' on the product page. Electronics must include all original accessories and packaging.",
        ],
      },
      {
        heading: "How to Start a Return",
        body: [
          "Find your order on the Account page or the Track Order page using your order number, then contact us at {{contactEmail}} with your order number and the items you'd like to return. We'll reply within 24 hours with a prepaid return label for defective or incorrect items, or simple shipping instructions for change-of-mind returns.",
          "Please don't ship anything back before we confirm the return — prepaid labels and the correct return warehouse depend on the item, and unannounced packages can be delayed or lost.",
        ],
      },
      {
        heading: "Refund Timelines",
        body: [
          "Once your return arrives, we inspect it within 2 business days. Approved refunds are issued to your original payment method within 5–7 business days; your bank may take a few additional days to post the credit. Original shipping fees are non-refundable except when the return is our error or the item arrived defective.",
          "If an item arrives damaged or isn't the one you ordered, tell us within 7 days of delivery with a photo if you can — we'll ship a replacement immediately or refund you in full, including shipping. Your choice.",
        ],
      },
      {
        heading: "Exchanges & Warranty Claims",
        body: [
          "Want a different size, color, or model? The fastest path is a standard return followed by a new order — that way stock is reserved for you. For items covered by a manufacturer's warranty beyond the 30-day window, contact us with your order number and a description of the issue; we'll coordinate the warranty claim with the maker on your behalf.",
        ],
      },
    ],
  },
};
