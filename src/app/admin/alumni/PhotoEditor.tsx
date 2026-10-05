"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { DEMO_MODE } from "@/lib/demo";
import { toGatePhoto } from "@/lib/resize";
import { removePhoto, uploadPhoto } from "./actions";

/**
 * The record's photo exactly as the guard sees it (3:4 crop, mockup a08), with Replace and Remove.
 * The browser crops and resizes before uploading, so the original file never leaves the admin's computer.
 */
export function PhotoEditor({ personId, src, caption, name }: { personId: string; src: string | null; caption: string | null; name: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  const pick = (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    start(async () => {
      try {
        const jpeg = await toGatePhoto(file);
        const fd = new FormData();
        fd.set("photo", new File([jpeg], "photo.jpg", { type: "image/jpeg" }));
        const r = await uploadPhoto(personId, fd);
        setMsg(r.ok ? { ok: true, text: "Photo saved. The gate shows it from the next search." } : { ok: false, text: r.error });
        if (r.ok) router.refresh();
      } catch {
        setMsg({ ok: false, text: "That file couldn't be read as a photo. Choose a JPEG, PNG or WebP image." });
      }
      if (input.current) input.current.value = "";
    });
  };
  const remove = () => start(async () => {
    const r = await removePhoto(personId);
    setConfirm(false);
    setMsg(r.ok ? { ok: true, text: "Photo removed. The guard will see “No photo on file” and check ID instead." } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });

  return (
    <div className="ma-field">
      <span className="ma-field__label" id="ph-l">Photo</span>
      <div className="ma-photo-edit" aria-labelledby="ph-l" aria-busy={busy || undefined}>
        <figure className={`ma-photo ma-photo--record${src ? "" : " is-none"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed link */}
          <div className="ma-photo__frame">{busy ? <Icon name="loader-circle" className="ma-spin" /> : src ? <img src={src} alt={`Photo of ${name}`} /> : <Icon name="user" />}</div>
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
        {DEMO_MODE ? null : <div style={{ flex: "1 1 14rem" }}>
          <p className="ma-note">JPEG, PNG or WebP.</p>
          <div className="ma-actions">
            <input ref={input} id="ph-file" className="ma-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
            <label htmlFor="ph-file" className="ma-btn ma-btn--secondary" aria-disabled={busy ? "true" : undefined}><Icon name="upload" />{src ? "Replace photo" : "Add photo"}</label>
            {src && !confirm ? <button type="button" className="ma-btn ma-btn--secondary" onClick={() => setConfirm(true)} disabled={busy}><Icon name="x" />Remove photo</button> : null}
          </div>
          {confirm ? (
            <div className="ma-banner ma-banner--escalation" role="alert">
              <span className="ma-circle"><Icon name="triangle-alert" /></span>
              <span className="ma-banner__text"><b>Remove this photo?</b> The file is deleted; the guard checks ID instead.
                <span className="ma-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="ma-btn ma-btn--secondary" autoFocus onClick={() => setConfirm(false)}>Keep photo</button>
                  <button type="button" className="ma-btn ma-btn--destructive" onClick={remove} disabled={busy}>Remove</button>
                </span>
              </span>
            </div>
          ) : null}
          {msg ? (
            <div className={`ma-banner ma-banner--${msg.ok ? "success" : "danger"}`} role={msg.ok ? "status" : "alert"}>
              <span className="ma-circle"><Icon name={msg.ok ? "check" : "circle-alert"} /></span><span className="ma-banner__text">{msg.text}</span>
            </div>
          ) : null}
        </div>}
      </div>
    </div>
  );
}
