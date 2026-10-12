export interface LegalPageContent {
  title: string;
  updated: string;
  sections: { heading: string; body: string[] }[];
}

export const legalContent: Record<string, LegalPageContent> = {
  "privacy-policy": {
    title: "Privacy Policy",
    updated: "November 1, 2025",
    sections: [
      {
        heading: "Information We Collect",
        body: [
          "We collect information you provide directly, such as your name, email, shipping address and payment details when you create an account or place an order.",
          "We also collect limited technical information, including browser type and pages visited, to improve site performance and security.",
        ],
      },
      {
        heading: "How We Use Your Information",
        body: [
          "To process and fulfill orders, communicate order status, and provide customer support.",
          "To personalize your shopping experience and send relevant marketing communications, which you may opt out of at any time.",
        ],
      },
      {
        heading: "Data Retention & Security",
        body: [
          "We retain account and order data only as long as necessary to provide our services and meet legal obligations, and apply industry-standard safeguards to protect it.",
        ],
      },
      {
        heading: "Your Rights",
        body: [
          "You may request access to, correction of, or deletion of your personal data at any time by contacting our support team.",
        ],
      },
    ],
  },
  "terms-of-service": {
    title: "Terms of Service",
    updated: "November 1, 2025",
    sections: [
      {
        heading: "Acceptance of Terms",
        body: [
          "By accessing or using HomeNest Kitchen, you agree to be bound by these Terms of Service and our Privacy Policy.",
        ],
      },
      {
        heading: "Orders & Payment",
        body: [
          "All orders are subject to acceptance and availability. Prices are listed in USD and may change without notice prior to order confirmation.",
        ],
      },
      {
        heading: "Product Warranty",
        body: [
          "Select cookware and knife products include a limited lifetime warranty against manufacturing defects. Normal wear, misuse and commercial use are excluded.",
        ],
      },
      {
        heading: "Limitation of Liability",
        body: [
          "HomeNest Kitchen is not liable for indirect, incidental or consequential damages arising from use of our products or services, to the maximum extent permitted by law.",
        ],
      },
    ],
  },
  "refund-policy": {
    title: "Refund Policy",
    updated: "November 1, 2025",
    sections: [
      {
        heading: "30-Day Returns",
        body: [
          "Unused items in original packaging may be returned within 30 days of delivery for a full refund to your original payment method.",
        ],
      },
      {
        heading: "How to Start a Return",
        body: [
          "Visit the Order Tracking page, locate your order, and select 'Start a Return', or contact our support team with your order number.",
        ],
      },
      {
        heading: "Refund Timeline",
        body: [
          "Once your return is received and inspected, refunds are processed within 5-7 business days. Shipping fees are non-refundable except in cases of our error.",
        ],
      },
    ],
  },
  "cookie-policy": {
    title: "Cookie Policy",
    updated: "November 1, 2025",
    sections: [
      {
        heading: "What Are Cookies",
        body: [
          "Cookies are small text files stored on your device that help us remember your preferences and understand how you use our site.",
        ],
      },
      {
        heading: "Types of Cookies We Use",
        body: [
          "Essential cookies required for core functionality like your shopping cart, and analytics cookies that help us improve the browsing experience.",
        ],
      },
      {
        heading: "Managing Cookies",
        body: [
          "You can control or delete cookies through your browser settings. Disabling essential cookies may affect site functionality such as checkout.",
        ],
      },
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    updated: "November 1, 2025",
    sections: [
      {
        heading: "General Information",
        body: [
          "Product descriptions, images and specifications are provided for general informational purposes. While we strive for accuracy, minor variations may occur.",
        ],
      },
      {
        heading: "Demo Environment Notice",
        body: [
          "This storefront is a demonstration build. No real payments are processed, and order data is stored locally in your browser rather than on a production server.",
        ],
      },
    ],
  },
};
