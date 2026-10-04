import "server-only";
import { createClient } from "@/lib/supabase/server";
import { samplePhoto } from "@/lib/format";

/**
 * Photo addresses for a page (planning/02 D8). The fictional sample people use drawn faces shipped with the app;
 * real photos sit in the private "photos" bucket and are shown through links that expire after 5 minutes.
 * Storage rules decide who may sign them: admins, and gate devices of the same university.
 */
export async function signPhotos(paths: (string | null | undefined)[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const real: string[] = [];
  for (const p of new Set(paths.filter((x): x is string => Boolean(x)))) {
    const sample = samplePhoto(p);
    if (sample) out.set(p, sample);
    else real.push(p);
  }
  if (real.length) {
    const supabase = await createClient();
    const { data } = await supabase.storage.from("photos").createSignedUrls(real, 300);
    data?.forEach((d) => { if (d.path && d.signedUrl) out.set(d.path, d.signedUrl); });
  }
  return out;
}
