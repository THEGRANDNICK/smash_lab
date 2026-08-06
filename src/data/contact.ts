// Contact details are placeholders — edit freely, this is the only place
// they live. Reused by the Contact section and by the "Request this" /
// "Choose This Setup" prefilled-email links.
export const CONTACT = {
  name: 'Nick',
  email: 'inquiries.smashlab@gmail.com',
  location: 'TSG Rohrbach Badminton Club',
  /**
   * WhatsApp number in international format with no leading "+", spaces,
   * or dashes (e.g. "491701234567") — the exact format wa.me links
   * require. Left blank on purpose: no real number exists yet, and
   * nothing here invents one. While empty, the "Send via WhatsApp"
   * enquiry option is hidden and only the email option is offered — see
   * logic/contactMessage.ts's buildEnquiryWhatsAppUrl().
   */
  whatsappNumber: '',
}
