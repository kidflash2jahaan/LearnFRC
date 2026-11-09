"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh, revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clientsFor } from "@/lib/app/result";
import { decideParentOk, recordAgeCheck, requestParentOk } from "@/lib/app/class-consent";
import { PARENT_COOKIE, PARENT_COOKIE_PATH } from "@/lib/classes/consent-rules";

/**
 * The website's door onto the classes age screen and the parent OK. Every
 * rule (the one answer, under 13, the email limits, the single-use link, the
 * network check) lives in src/lib/app/class-consent.ts; these only read the
 * form, the cookie session and the lf_parent cookie. A "use server" function
 * is a public endpoint, so each shared function checks the caller itself.
 */

export type ConsentFormState =
  | {
      error?: string;
      /** Which control the error is about, when it is about one. */
      field?: string;
      /** The sentence to show once it worked. */
      message?: string;
    }
  | undefined;

function text(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

async function sessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * /classes/ready, step one. Under 13 the account is already gone when this
 * returns, so the browser is signed out here and sent to the page that says
 * so (it reads the device cookie, not anything about the person).
 */
export async function submitAgeCheck(_prev: ConsentFormState, formData: FormData): Promise<ConsentFormState> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };

  const result = await recordAgeCheck(user, clientsFor(supabase), {
    birthMonth: text(formData, "birth_month"),
    birthYear: text(formData, "birth_year"),
    confirmed: text(formData, "confirmed"),
  });
  if (!result.ok) return { error: result.error, field: result.field };

  if (result.outcome === "deleted") {
    await supabase.auth.signOut();
    revalidatePath("/", "layout");
    redirect("/classes/ready/deleted");
  }
  refresh();
  return { message: "Saved." };
}

/** /classes/ready, step two: the one email to a parent or guardian. */
export async function sendParentRequest(_prev: ConsentFormState, formData: FormData): Promise<ConsentFormState> {
  const { user } = await sessionUser();
  if (!user) return { error: "Sign in first." };

  const result = await requestParentOk(user, { parentEmail: text(formData, "parent_email") });
  if (!result.ok) return { error: result.error, field: result.field };
  refresh();
  return { message: `Sent to ${result.parentEmail}.` };
}

/**
 * /classes/parent: the parent's answer. The token comes from the lf_parent
 * cookie the emailed link left, never from the form. Once it's decided (or
 * the link turns out to be used up) the cookie is cleared and the page is
 * reloaded at a plain URL that says what happened.
 */
export async function decideParentRequest(
  _prev: ConsentFormState,
  formData: FormData
): Promise<ConsentFormState> {
  const jar = await cookies();
  const token = jar.get(PARENT_COOKIE)?.value;
  const clear = () =>
    jar.set(PARENT_COOKIE, "", {
      path: PARENT_COOKIE_PATH,
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

  const result = await decideParentOk({
    token,
    decision: text(formData, "decision"),
    parentName: text(formData, "parent_name"),
  });
  if (!result.ok) {
    if (result.code === "not_found") {
      clear();
      redirect("/classes/parent?link=closed");
    }
    return { error: result.error, field: result.field };
  }
  clear();
  redirect(`/classes/parent?done=${result.decision === "agree" ? "agreed" : "declined"}`);
}
