import { CONTACT } from '../data/contact'

export default function Contact() {
  return (
    <section id="contact" className="py-20 px-4 sm:px-6 max-w-3xl mx-auto scroll-mt-20">
      <div className="text-center mb-10">
        <p className="text-shuttle-600 font-semibold tracking-wide uppercase">Get in touch</p>
        <h2 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink-900 dark:text-shuttle-50">Have a question?</h2>
        <p className="text-ink-700/70 dark:text-shuttle-100/70 mt-3">Questions about a string recommendation, stringing, or Smash Lab? Feel free to get in touch.</p>
      </div>

      <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/80 dark:bg-white/5 p-8 grid sm:grid-cols-2 gap-6">
        <ContactRow emoji="👤" label="Name" value={CONTACT.name} />
        <ContactRow emoji="✉️" label="Email" value={CONTACT.email} />
        <ContactRow emoji="📍" label="Location" value={CONTACT.location} />
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
        {label === 'Email' ? (
          <a
            href={`mailto:${value}`}
            className="font-semibold text-ink-900 dark:text-shuttle-50 hover:underline"
           >
             {value}
           </a>
         ) : (
           <p className="font-semibold text-ink-900 dark:text-shuttle-50">{value}</p>
        )}
      </div>
    </div>
  )
}
