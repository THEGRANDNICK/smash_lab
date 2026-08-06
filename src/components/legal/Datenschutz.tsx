import { LEGAL } from '../../data/legalConfig'
import LegalPageShell from './LegalPageShell'

interface DatenschutzProps {
  onHome: () => void
}

/**
 * Datenschutzerklärung — describes only processing that actually exists in
 * this codebase (audited directly against src/, not written generically).
 * Not a substitute for legal review — see docs/legal-setup.md. Keep this
 * in sync whenever a feature that touches personal data changes: the
 * sections below map 1:1 to real modules (Supabase, sessionStorage,
 * localStorage, mailto/WhatsApp links, external retailer images).
 */
export default function Datenschutz({ onHome }: DatenschutzProps) {
  return (
    <LegalPageShell title="Datenschutzerklärung" lastUpdated={LEGAL.lastUpdated} onHome={onHome}>
      <div className="rounded-2xl border-2 border-court-900/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-4 text-sm">
        Diese Datenschutzerklärung beschreibt, welche Daten diese Website tatsächlich verarbeitet. Sie ersetzt keine rechtliche Beratung — siehe{' '}
        <code>docs/legal-setup.md</code>.
      </div>

      <section>
        <h2>1. Verantwortlicher</h2>
        <p>
          {LEGAL.legalName}, siehe{' '}
          <a href="#impressum" className="underline">
            Impressum
          </a>
          .
        </p>
      </section>

      <section>
        <h2>2. Hosting (GitHub Pages)</h2>
        <p>
          Diese Website wird über GitHub Pages ausgeliefert. Beim Aufruf verarbeitet GitHub als Hosting-Anbieter automatisch technische
          Zugriffsdaten (z. B. IP-Adresse, Zeitpunkt des Zugriffs, angeforderte Datei), wie es für jede Website-Auslieferung technisch notwendig
          ist. Details:{' '}
          <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">
            GitHub Privacy Statement
          </a>
          . Diese Website selbst betreibt keine eigene Server-Protokollierung.
        </p>
      </section>

      <section>
        <h2>3. Fonts</h2>
        <p>Alle Schriftarten (Space Grotesk) werden selbst gehostet und mit der Website ausgeliefert. Es findet keine Verbindung zu Google Fonts oder anderen externen Font-Diensten statt.</p>
      </section>

      <section>
        <h2>4. Analyse- und Tracking-Tools</h2>
        <p>Diese Website verwendet keine Analyse-, Tracking- oder Werbe-Dienste (kein Google Analytics, kein Facebook-Pixel, keine vergleichbaren Tools).</p>
      </section>

      <section>
        <h2>5. Der String-Finder-Quiz</h2>
        <p>
          Deine Antworten im Quiz werden ausschließlich lokal in deinem Browser verarbeitet, um eine Empfehlung zu berechnen. Sie werden nicht an
          einen Server von Smash Lab übertragen oder dort gespeichert — es sei denn, du entscheidest dich aktiv, ein Ergebnis per WhatsApp, E-Mail
          oder Link-Freigabe zu teilen (siehe Abschnitt 7).
        </p>
      </section>

      <section>
        <h2>6. Lokaler Speicher (localStorage / sessionStorage)</h2>
        <p>Diese Website speichert einige Einstellungen ausschließlich lokal auf deinem Gerät, niemals auf einem Server:</p>
        <ul>
          <li>
            <strong>sessionStorage</strong> — deine zuletzt gewählte Vergleichsansicht (Radar/Tabelle), nur für die aktuelle Browser-Sitzung.
          </li>
          <li>
            <strong>localStorage</strong> — dein optional gespeichertes "Mein Setup" (empfohlene Saite, Spannung, Racket-Modell), damit du es beim
            nächsten Besuch wiederverwenden kannst. Wird nur gespeichert, wenn du das aktiv auswählst, und kann jederzeit über die
            Browser-Einstellungen gelöscht werden.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Anfrage per WhatsApp oder E-Mail</h2>
        <p>
          Wenn du nach einer Empfehlung "Setup anfragen" auswählst, öffnet die Website — abhängig von deiner Wahl — entweder WhatsApp (über
          einen <code>wa.me</code>-Link) oder dein E-Mail-Programm (über einen <code>mailto:</code>-Link) mit einer vorausgefüllten Nachricht.
          Der eigentliche Versand erfolgt erst, wenn du das in WhatsApp bzw. deinem E-Mail-Programm aktiv bestätigst. Die Nachricht wird dabei
          direkt an WhatsApp bzw. deinen E-Mail-Anbieter übermittelt — nicht über einen Server von Smash Lab. Es gelten die Datenschutzbestimmungen
          von WhatsApp (Meta) bzw. deines E-Mail-Anbieters für diesen Übertragungsweg.
        </p>
      </section>

      <section>
        <h2>8. Geteilte Ergebnis-Links</h2>
        <p>
          Die "Ergebnis teilen"-Funktion kodiert ausschließlich die für die Empfehlung nötigen, nicht-persönlichen Angaben (z. B. gewählte
          Präferenzen) in die URL — niemals Namen, Kontaktdaten oder freie Texteingaben. Ein geteilter Link berechnet die Empfehlung beim Öffnen
          erneut lokal im Browser der empfangenden Person; es wird nichts auf einem Server gespeichert.
        </p>
      </section>

      <section>
        <h2>9. Supabase (Saiten-Katalog, Lagerbestand, Preise)</h2>
        <p>
          Die öffentlich sichtbaren Inhalte dieser Website (Saiten-Katalog, Lagerbestand, Händlerpreise) werden — sofern konfiguriert — aus einer
          Supabase-Datenbank gelesen. Dabei werden von deinem Browser aus lesende Anfragen an die Supabase-Infrastruktur gestellt (technisch
          notwendig, um die Seite anzuzeigen). Es werden dabei keine personenbezogenen Formulardaten von Besucher:innen an Supabase gesendet. Der
          Admin-Bereich (nur für den Betreiber) verwendet Supabase Authentication für den Login — das betrifft nicht die öffentliche Website.
        </p>
      </section>

      <section>
        <h2>10. Externe Links und Bilder (Händler)</h2>
        <p>
          Für einzelne Saiten können Links zu Händler-Websites sowie deren Logos angezeigt werden. Händler-Logos werden direkt vom Server des
          jeweiligen Händlers geladen (<code>referrerPolicy="no-referrer"</code>, sodass die Ziel-URL nicht an den Händler übermittelt wird);
          dabei kann der Händler technische Zugriffsdaten wie deine IP-Adresse erhalten. Beim Klick auf einen Händler-Link verlässt du diese
          Website — es gelten die Datenschutzbestimmungen des jeweiligen Händlers.
        </p>
      </section>

      <section>
        <h2>11. Deine Rechte</h2>
        <p>Da diese Website keine personenbezogenen Daten auf einem eigenen Server speichert, betreffen die üblichen Betroffenenrechte (Auskunft, Löschung, Widerspruch) primär die lokal auf deinem Gerät gespeicherten Daten (siehe Abschnitt 6), die du jederzeit selbst über deinen Browser löschen kannst. Bei Fragen kontaktiere {LEGAL.legalName} über die im Impressum genannte E-Mail-Adresse.</p>
      </section>
    </LegalPageShell>
  )
}
