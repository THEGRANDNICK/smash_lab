// Contact details — this is the only place they live. Reused by the
// Contact section and by the enquiry/"Choose This Setup" prefilled
// WhatsApp/email links.
export const CONTACT = {
  name: 'Nick',
  email: 'inquiries.smashlab@gmail.com',
  location: 'Heidelberg, Germany',
  /**
   * WhatsApp number in international format with no leading "+", spaces,
   * or dashes — the exact format wa.me links require. Used both for the
   * Contact section's WhatsApp button and the result page's enquiry flow
   * (see logic/contactMessage.ts's buildEnquiryWhatsAppUrl()).
   */
  whatsappNumber: '491774204564',
}
