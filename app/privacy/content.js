/**
 * Privacy notice copy, six locales.
 *
 * Long-form prose lives here rather than in app/i18n/*.json, which are UI strings and carry
 * an identical-key-set invariant. The consent line near the form IS in i18n, because that is
 * a UI string.
 *
 * D-005 (downgraded): this is a deliberately reduced, plain-language notice — no controller
 * identity, no postal address, no boilerplate. Three things it must never do, per that
 * decision:
 *   1. call unsubscribe "deletion" — unsubscribe is a soft opt-out, the record remains
 *   2. describe a company that does not exist
 *   3. promise a retention period nobody will act on
 */

export const PRIVACY = {
  en: {
    title: 'Privacy',
    intro: 'NextCollect is an early-stage project. This page explains in plain language what happens to your email address if you sign up. No legal boilerplate.',
    sections: [
      { h: 'What we collect', p: ['When you sign up we store your email address and the country you select. We also store the language you were using, so we can write to you in it, and the date you signed up.', "That's everything. No name, no analytics, no advertising cookies, and we don't track whether you open our emails."] },
      { h: 'Why', p: ['One reason: to email you about NextCollect. A confirmation straight away, and an announcement when we launch.', "Nothing else — no newsletters, no marketing from anyone else. If we ever wanted to send you something different, we'd ask first."] },
      { h: 'Who else handles it', p: ['Three standard services: Supabase stores the database (servers in the EU, Stockholm), Vercel hosts this website, and Resend sends the emails.', "We don't sell your data or share it with anyone else."] },
      { h: 'How long we keep it', p: ["We keep it until we've sent the launch announcement. You can ask us to delete it sooner at any time."] },
      { h: 'Stopping emails vs deleting your data', p: ['These are two different things.', 'Unsubscribe — the link at the bottom of every email. Stops us emailing you. Your record stays in our list, marked as unsubscribed.', 'Deletion — removes your record entirely. Email info@nxtcollect.com and we\'ll delete it. You can use that address to ask what we hold about you, too.'] },
      { h: 'Who we are', p: ['NextCollect is a small pre-launch project, not yet a registered company. Reach us at info@nxtcollect.com.'] },
    ],
  },
  nl: {
    title: 'Privacy',
    intro: 'NextCollect is een project in een vroege fase. Deze pagina legt in gewone taal uit wat er met je e-mailadres gebeurt als je je aanmeldt. Geen juridisch jargon.',
    sections: [
      { h: 'Wat we bewaren', p: ['Als je je aanmeldt bewaren we je e-mailadres en het land dat je kiest. Ook de taal die je gebruikte, zodat we je in die taal kunnen schrijven, en de datum van aanmelding.', 'Dat is alles. Geen naam, geen analytics, geen advertentiecookies, en we houden niet bij of je onze e-mails opent.'] },
      { h: 'Waarom', p: ['Eén reden: om je te mailen over NextCollect. Direct een bevestiging, en een aankondiging bij de lancering.', 'Meer niet — geen nieuwsbrieven, geen marketing van anderen. Als we ooit iets anders willen sturen, vragen we het eerst.'] },
      { h: 'Wie het verder verwerkt', p: ['Drie standaarddiensten: Supabase bewaart de database (servers in de EU, Stockholm), Vercel host deze website en Resend verstuurt de e-mails.', 'We verkopen je gegevens niet en delen ze met niemand anders.'] },
      { h: 'Hoe lang we het bewaren', p: ['We bewaren het totdat we de lanceringsaankondiging hebben verstuurd. Je kunt altijd vragen om het eerder te verwijderen.'] },
      { h: 'E-mails stoppen versus gegevens verwijderen', p: ['Dit zijn twee verschillende dingen.', 'Afmelden — de link onderaan elke e-mail. Wij mailen je dan niet meer. Je record blijft in onze lijst staan, gemarkeerd als afgemeld.', 'Verwijderen — haalt je record helemaal weg. Mail info@nxtcollect.com en we verwijderen het. Via dat adres kun je ook opvragen wat we van je hebben.'] },
      { h: 'Wie we zijn', p: ['NextCollect is een klein project vóór lancering, nog geen geregistreerd bedrijf. Bereik ons op info@nxtcollect.com.'] },
    ],
  },
  de: {
    title: 'Datenschutz',
    intro: 'NextCollect ist ein Projekt in einer frühen Phase. Diese Seite erklärt in einfacher Sprache, was mit Ihrer E-Mail-Adresse passiert, wenn Sie sich anmelden. Kein Juristendeutsch.',
    sections: [
      { h: 'Was wir speichern', p: ['Bei der Anmeldung speichern wir Ihre E-Mail-Adresse und das gewählte Land. Außerdem die verwendete Sprache, damit wir Ihnen darin schreiben können, und das Datum der Anmeldung.', 'Das ist alles. Kein Name, keine Analyse-Tools, keine Werbe-Cookies, und wir verfolgen nicht, ob Sie unsere E-Mails öffnen.'] },
      { h: 'Warum', p: ['Ein Grund: um Ihnen über NextCollect zu schreiben. Sofort eine Bestätigung und eine Ankündigung zum Start.', 'Mehr nicht — keine Newsletter, keine Werbung Dritter. Sollten wir jemals etwas anderes senden wollen, fragen wir vorher.'] },
      { h: 'Wer es sonst verarbeitet', p: ['Drei Standarddienste: Supabase speichert die Datenbank (Server in der EU, Stockholm), Vercel hostet diese Website, und Resend versendet die E-Mails.', 'Wir verkaufen Ihre Daten nicht und geben sie an niemanden weiter.'] },
      { h: 'Wie lange wir es speichern', p: ['Wir speichern es, bis wir die Startankündigung versendet haben. Sie können jederzeit früher um Löschung bitten.'] },
      { h: 'E-Mails stoppen oder Daten löschen', p: ['Das sind zwei verschiedene Dinge.', 'Abmelden — der Link am Ende jeder E-Mail. Wir schreiben Ihnen dann nicht mehr. Ihr Eintrag bleibt in unserer Liste, als abgemeldet markiert.', 'Löschen — entfernt Ihren Eintrag vollständig. Schreiben Sie an info@nxtcollect.com und wir löschen ihn. Über dieselbe Adresse können Sie auch erfragen, was wir gespeichert haben.'] },
      { h: 'Wer wir sind', p: ['NextCollect ist ein kleines Projekt vor dem Start, noch kein eingetragenes Unternehmen. Kontakt: info@nxtcollect.com.'] },
    ],
  },
  fr: {
    title: 'Confidentialité',
    intro: "NextCollect est un projet à ses débuts. Cette page explique en langage clair ce qu'il advient de votre adresse e-mail si vous vous inscrivez. Sans jargon juridique.",
    sections: [
      { h: 'Ce que nous conservons', p: ["Lors de l'inscription, nous conservons votre adresse e-mail et le pays choisi. Également la langue utilisée, afin de vous écrire dans celle-ci, et la date d'inscription.", "C'est tout. Pas de nom, pas d'outils d'analyse, pas de cookies publicitaires, et nous ne suivons pas si vous ouvrez nos e-mails."] },
      { h: 'Pourquoi', p: ['Une seule raison : vous écrire au sujet de NextCollect. Une confirmation immédiate, et une annonce au lancement.', "Rien d'autre — pas de newsletters, pas de publicité de tiers. Si nous voulions un jour envoyer autre chose, nous demanderions d'abord."] },
      { h: 'Qui le traite également', p: ['Trois services standard : Supabase héberge la base de données (serveurs dans l\'UE, Stockholm), Vercel héberge ce site, et Resend envoie les e-mails.', 'Nous ne vendons pas vos données et ne les partageons avec personne.'] },
      { h: 'Combien de temps', p: ["Nous les conservons jusqu'à l'envoi de l'annonce de lancement. Vous pouvez demander leur suppression plus tôt à tout moment."] },
      { h: 'Arrêter les e-mails ou supprimer vos données', p: ['Ce sont deux choses différentes.', 'Désinscription — le lien en bas de chaque e-mail. Nous cessons de vous écrire. Votre enregistrement reste dans notre liste, marqué comme désinscrit.', 'Suppression — retire entièrement votre enregistrement. Écrivez à info@nxtcollect.com et nous le supprimerons. Vous pouvez aussi utiliser cette adresse pour demander ce que nous conservons.'] },
      { h: 'Qui nous sommes', p: ['NextCollect est un petit projet avant lancement, pas encore une société enregistrée. Contact : info@nxtcollect.com.'] },
    ],
  },
  es: {
    title: 'Privacidad',
    intro: 'NextCollect es un proyecto en una fase temprana. Esta página explica en lenguaje claro qué ocurre con tu correo electrónico si te registras. Sin jerga legal.',
    sections: [
      { h: 'Qué guardamos', p: ['Al registrarte guardamos tu correo electrónico y el país que elijas. También el idioma que usabas, para escribirte en él, y la fecha de registro.', 'Eso es todo. Sin nombre, sin analítica, sin cookies publicitarias, y no registramos si abres nuestros correos.'] },
      { h: 'Por qué', p: ['Un motivo: escribirte sobre NextCollect. Una confirmación de inmediato y un aviso cuando lancemos.', 'Nada más — sin boletines, sin publicidad de terceros. Si alguna vez quisiéramos enviar algo distinto, lo preguntaríamos antes.'] },
      { h: 'Quién más lo trata', p: ['Tres servicios estándar: Supabase almacena la base de datos (servidores en la UE, Estocolmo), Vercel aloja esta web y Resend envía los correos.', 'No vendemos tus datos ni los compartimos con nadie.'] },
      { h: 'Cuánto tiempo lo guardamos', p: ['Lo guardamos hasta que hayamos enviado el aviso de lanzamiento. Puedes pedirnos que lo borremos antes en cualquier momento.'] },
      { h: 'Dejar de recibir correos frente a borrar tus datos', p: ['Son dos cosas distintas.', 'Darse de baja — el enlace al final de cada correo. Dejamos de escribirte. Tu registro sigue en la lista, marcado como dado de baja.', 'Borrado — elimina tu registro por completo. Escribe a info@nxtcollect.com y lo borraremos. También puedes usar esa dirección para preguntar qué guardamos.'] },
      { h: 'Quiénes somos', p: ['NextCollect es un pequeño proyecto previo al lanzamiento, todavía no una empresa registrada. Contacto: info@nxtcollect.com.'] },
    ],
  },
  it: {
    title: 'Privacy',
    intro: 'NextCollect è un progetto in fase iniziale. Questa pagina spiega in parole semplici cosa succede al tuo indirizzo email se ti iscrivi. Senza linguaggio legale.',
    sections: [
      { h: 'Cosa conserviamo', p: ["Quando ti iscrivi conserviamo il tuo indirizzo email e il paese che scegli. Anche la lingua che stavi usando, per scriverti in quella, e la data d'iscrizione.", 'Tutto qui. Nessun nome, nessuna analisi, nessun cookie pubblicitario, e non tracciamo se apri le nostre email.'] },
      { h: 'Perché', p: ['Un motivo solo: scriverti riguardo a NextCollect. Una conferma subito e un annuncio al lancio.', "Nient'altro — niente newsletter, niente pubblicità di terzi. Se volessimo mai inviarti altro, lo chiederemmo prima."] },
      { h: 'Chi altro li tratta', p: ['Tre servizi standard: Supabase conserva il database (server nell\'UE, Stoccolma), Vercel ospita questo sito e Resend invia le email.', 'Non vendiamo i tuoi dati e non li condividiamo con nessuno.'] },
      { h: 'Per quanto tempo', p: ["Li conserviamo finché non avremo inviato l'annuncio di lancio. Puoi chiederci di cancellarli prima in qualsiasi momento."] },
      { h: 'Smettere di ricevere email o cancellare i dati', p: ['Sono due cose diverse.', 'Disiscrizione — il link in fondo a ogni email. Smettiamo di scriverti. Il tuo record resta nella lista, segnato come disiscritto.', 'Cancellazione — rimuove del tutto il tuo record. Scrivi a info@nxtcollect.com e lo cancelleremo. Puoi usare lo stesso indirizzo per chiedere cosa conserviamo.'] },
      { h: 'Chi siamo', p: ['NextCollect è un piccolo progetto pre-lancio, non ancora una società registrata. Contatto: info@nxtcollect.com.'] },
    ],
  },
};
