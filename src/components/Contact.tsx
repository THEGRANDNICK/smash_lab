// Contact details are placeholders — edit freely, this is the only place they live.
const CONTACT = {
  name: 'Nick',
  whatsapp: '+49 (0) 1590 8154825',
  email: 'nicovogt56@gmail.com',
  location: 'TSG Rohrbach Badminton Club / drop-off point, City',
  instagram: 'Coming Soon',
}

export default function Contact() {
  return (
    <section id="contact" className="py-20 px-4 sm:px-6 max-w-3xl mx-auto scroll-mt-20">
      <div className="text-center mb-10">
        <p className="text-shuttle-600 font-semibold text-sm tracking-wide uppercase">Get in touch</p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">Ready to get strung?</h2>
        <p className="text-ink-700/70 dark:text-shuttle-100/70 mt-3">
          Message me your recommended setup (or just ask a question) — I'll sort out drop-off and timing with you directly.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 p-8 grid sm:grid-cols-2 gap-6">
        <ContactRow emoji="💬" label="WhatsApp" value={CONTACT.whatsapp} />
        <ContactRow emoji="✉️" label="Email" value={CONTACT.email} />
        <ContactRow emoji="📍" label="Drop-off" value={CONTACT.location} />
        <ContactRow emoji="📸" label="Instagram" value={CONTACT.instagram} />
      </div>
    </section>
  )
}

function ContactRow({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-2xl" aria-hidden="true">
        {emoji}
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-700/50 dark:text-shuttle-100/50">{label}</p>
        <p className="font-semibold text-ink-900 dark:text-shuttle-50">{value}</p>
      </div>
    </div>
  )
}
