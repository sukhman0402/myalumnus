import { Shell } from "@/components/Shell";
import { type Duty } from "@/lib/gate";
import { Today } from "./Today";
import { OfflineSync } from "./OfflineSync";

/** Every guard screen after the name picker: title row and the Today tiles. The rail, logo and profile badge
 *  come from the console layout (app/gate/layout.tsx). */
export function GateShell({ duty, title, banner, actions, children }: {
  duty: Duty; title: string; banner?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode;
}) {
  const { lang } = duty;
  return (
    <Shell title={title} banner={banner} actions={actions} aside={<Today lang={lang} />}>
      <OfflineSync lang={lang} />
      {children}
    </Shell>
  );
}
