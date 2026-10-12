// Kontaktformular: Die Edge Function «contact» schickt die Nachricht als E-Mail an den Shop (Antwort per Reply-To).
import { useId, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Field, TextAreaField } from "@/components/account/form";
import { backendConfigured } from "@/integrations/supabase/client";
import { callFunction } from "@/integrations/supabase/functions";
import { useLocale, useLocaleParam, useT } from "@/i18n";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN = 10;
const MAX = 4000;

type Errors = Partial<Record<"name" | "email" | "message" | "form", string>>;

export function ContactForm() {
  const t = useT();
  const locale = useLocale();
  const lp = useLocaleParam();
  const id = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [errors, setErrors] = useState<Errors>({});
  const f = t.contactForm;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!name.trim()) next.name = f.nameRequired;
    if (!EMAIL.test(email.trim())) next.email = t.common.invalidEmail;
    if (message.trim().length < MIN) next.message = f.messageTooShort;
    else if (message.trim().length > MAX) next.message = f.messageTooLong;
    if (!next.name && !next.email && !next.message && !backendConfigured)
      next.form = f.notConfigured;
    setErrors(next);
    if (Object.keys(next).length) return;
    setState("sending");
    const result = await callFunction<{ sent: true }>("contact", {
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      locale,
      website,
    });
    if (result.ok) {
      setState("sent");
      return;
    }
    setState("idle");
    const byCode: Record<string, Errors> = {
      NAME_REQUIRED: { name: f.nameRequired },
      INVALID_EMAIL: { email: t.common.invalidEmail },
      MESSAGE_TOO_SHORT: { message: f.messageTooShort },
      MESSAGE_TOO_LONG: { message: f.messageTooLong },
      RATE_LIMITED: { form: f.rateLimited },
      NOT_CONFIGURED: { form: f.notConfigured },
      BUSY: { form: f.busy },
      NETWORK: { form: t.common.networkError },
    };
    setErrors(byCode[result.error] ?? { form: f.failed });
  }

  if (state === "sent") {
    return (
      <p className="contact-done" role="status">
        {f.sent}
      </p>
    );
  }

  return (
    <form className="account-form contact-form" onSubmit={submit} noValidate>
      <h2>{f.title}</h2>
      <Field
        label={f.name}
        autoComplete="name"
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
      />
      <Field
        label={f.email}
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
      />
      <TextAreaField
        label={f.message}
        hint={f.messageHint}
        rows={6}
        maxLength={MAX}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        error={errors.message}
      />
      {/* Für Menschen unsichtbar; Bots füllen es oft aus. */}
      <div className="hp-field" aria-hidden="true">
        <label htmlFor={`${id}-website`}>Website</label>
        <input
          id={`${id}-website`}
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      <p className="field-hint">
        {f.privacy}{" "}
        <Link to="/{-$locale}/datenschutz" params={{ locale: lp }}>
          {f.privacyLink}
        </Link>
        .
      </p>
      {errors.form && (
        <p className="form-error" role="alert">
          {errors.form}
        </p>
      )}
      <Button type="submit" disabled={state === "sending"}>
        {state === "sending" ? f.sending : f.submit}
      </Button>
    </form>
  );
}
