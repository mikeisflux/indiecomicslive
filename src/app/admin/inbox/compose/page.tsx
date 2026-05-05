import ComposeForm from "./ComposeForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compose — Admin",
  robots: { index: false, follow: false },
};

export default function ComposePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">New email</h1>
      <p className="mt-1 text-sm text-paper/60">
        Sends from{" "}
        <code className="rounded bg-black/40 px-1">
          {process.env.AUTH_EMAIL_FROM ?? "(unset)"}
        </code>{" "}
        via SendGrid. Comma- or semicolon-separate multiple addresses in
        the To/Cc/Bcc fields.
      </p>
      <ComposeForm />
    </div>
  );
}
