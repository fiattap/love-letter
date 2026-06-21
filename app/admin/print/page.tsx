import { cookies } from "next/headers";

import { ADMIN_COOKIE_NAME } from "@/lib/adminAuth";
import { supabaseServer } from "@/lib/supabaseServer";

import AdminLoginForm from "../AdminLoginForm";
import PrintButton from "./PrintButton";

type PrintPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

type ShippingAddress = {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
} | null;

function formatAddress(address: ShippingAddress): string {
  if (!address) {
    return "No address on file";
  }
  const cityLine = [address.city, address.state, address.postal_code].filter(Boolean).join(", ");
  return [address.line1, address.line2, cityLine, address.country].filter(Boolean).join(" · ");
}

export default async function PrintPage(props: PrintPageProps) {
  const isDevelopment = process.env.NODE_ENV === "development";
  const expectedSecret = process.env.ADMIN_SECRET?.trim() ?? "";
  const query = await props.searchParams;
  const providedSecret = readParam(query.secret).trim();

  const cookieStore = await cookies();
  const cookieSecret = cookieStore.get(ADMIN_COOKIE_NAME)?.value?.trim() ?? "";

  const matches = (value: string) => Boolean(expectedSecret) && value === expectedSecret;
  const isAuthorized = isDevelopment || matches(providedSecret) || matches(cookieSecret);

  if (!isAuthorized) {
    return <AdminLoginForm configured={Boolean(expectedSecret)} />;
  }

  const coupleId = readParam(query.coupleId).trim();
  const cycleKey = readParam(query.cycleKey).trim();

  if (!coupleId || !cycleKey) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10 text-[#342d2a]">
        <p>Missing couple or cycle. Open this page from the Printed Letters panel.</p>
      </main>
    );
  }

  const { data: couple } = await supabaseServer
    .from("couples")
    .select("partner_one_email, partner_two_email, shipping_name, shipping_address")
    .eq("id", coupleId)
    .maybeSingle();

  const { data: lettersData } = await supabaseServer
    .from("letters")
    .select("writer_email, prompt, body, status")
    .eq("couple_id", coupleId)
    .eq("cycle_key", cycleKey)
    .eq("status", "sealed");

  const { data: membersData } = await supabaseServer
    .from("members")
    .select("email, name");
  const nameByEmail = new Map<string, string>();
  for (const member of (membersData ?? []) as { email: string | null; name: string | null }[]) {
    if (member.email) {
      nameByEmail.set(member.email.toLowerCase(), member.name ?? "");
    }
  }

  const letters = (lettersData ?? []) as Array<{
    writer_email: string | null;
    prompt: string | null;
    body: string | null;
  }>;

  const prompt = letters.find((letter) => letter.prompt)?.prompt ?? "";

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 text-[#342d2a]">
      <div className="mb-8 print:hidden">
        <PrintButton />
        <p className="mt-3 text-sm text-[#8d7a72]">
          Cycle {cycleKey} · mail to: {couple?.shipping_name ? `${couple.shipping_name}, ` : ""}
          {formatAddress(couple?.shipping_address as ShippingAddress)}
        </p>
      </div>

      <header className="mb-8 border-b border-[#eadbd0] pb-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c97972]">Love Letter</p>
        <h1 className="mt-2 font-serif text-3xl">{cycleKey} letters</h1>
        {prompt ? (
          <p className="mx-auto mt-4 max-w-md text-base italic text-[#6f5b58]">
            &ldquo;{prompt}&rdquo;
          </p>
        ) : null}
      </header>

      {letters.length === 0 ? (
        <p className="text-[#8d7a72]">No sealed letters found for this couple this cycle.</p>
      ) : (
        <div className="space-y-10">
          {letters.map((letter, index) => {
            const writerName =
              nameByEmail.get((letter.writer_email ?? "").toLowerCase()) || letter.writer_email;
            return (
              <article key={`${letter.writer_email}-${index}`} className="break-inside-avoid">
                <h2 className="font-serif text-2xl text-[#342d2a]">From {writerName}</h2>
                <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-[#342d2a]">
                  {letter.body}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
