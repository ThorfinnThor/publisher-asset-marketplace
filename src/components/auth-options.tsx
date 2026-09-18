import { googleAuthIsConfigured } from "@/lib/auth/google";
import { magicLinkAuthIsConfigured } from "@/lib/auth/magic-link";

import { MagicLinkForm } from "./magic-link-form";

type AuthOptionsProps = {
  context: "create and manage assets" | "submit an asset" | "manage your published assets";
};

export function AuthOptions({ context }: AuthOptionsProps) {
  const googleEnabled = googleAuthIsConfigured();
  const magicLinkEnabled = magicLinkAuthIsConfigured();

  return (
    <>
      <div className="auth-options" aria-label="Sign-in options">
        <a className="button button--primary" href="/api/auth/github">
          Continue with GitHub
        </a>
        {googleEnabled ? (
          <a className="button button--secondary" href="/api/auth/google">
            Continue with Google
          </a>
        ) : null}
      </div>
      {magicLinkEnabled ? <MagicLinkForm /> : null}
      <small>
        Sign in to {context}. We use your account profile only to identify your creator account.
      </small>
    </>
  );
}
