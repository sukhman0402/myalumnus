"use client";

import { useRef } from "react";
import { Icon } from "./Icon";

/**
 * The record photo (design system: Photo, record size). Tapping it opens a larger copy, because the guard
 * compares it with the face in front of them. No photo: says so and what to do instead (never initials).
 */
export function RecordPhoto({ src, name, caption, enlargeLabel, altText, closeLabel, noneTitle, noneText }: {
  src: string | null; name: string; caption: string | null; enlargeLabel: string; altText: string;
  closeLabel: string; noneTitle: string; noneText: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  if (!src) {
    return (
      <figure className="ma-photo ma-photo--record is-none">
        <div className="ma-photo__frame"><Icon name="user" /></div>
        <p className="ma-photo__note"><b>{noneTitle}</b>{noneText}</p>
      </figure>
    );
  }
  return (
    <figure className="ma-photo ma-photo--record">
      <button ref={opener} type="button" className="ma-photo__frame" aria-label={enlargeLabel} onClick={() => dialog.current?.showModal()}>
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed links; no image optimiser in front */}
        <img src={src} alt={altText} />
      </button>
      {caption ? <figcaption>{caption}</figcaption> : null}
      <dialog ref={dialog} className="ma-dialog" style={{ width: "fit-content" }} aria-labelledby="zoom-t"
        onClose={() => opener.current?.focus()}>
        <div className="ma-dialog__head">
          <h2 className="ma-dialog__title" id="zoom-t">{name}</h2>
          <button type="button" className="ma-dialog__close" aria-label={closeLabel} autoFocus onClick={() => dialog.current?.close()}><Icon name="x" /></button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={altText} style={{ width: "min(360px, 70vw)", aspectRatio: "3 / 4", borderRadius: 6, objectFit: "cover", objectPosition: "50% 30%" }} />
        {caption ? <p className="ma-dialog__body">{caption}</p> : null}
      </dialog>
    </figure>
  );
}
