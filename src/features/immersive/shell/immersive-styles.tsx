import "../styles/immersive.css";
import { styleCss } from "../styles/css";

/** Built once: constants only, see styleCss. */
const CSS = styleCss();

/**
 * The texture layer, and the immersive styles' tokens. Rendered only inside
 * an immersive scope, so a Classic page carries neither.
 *
 * `tokens={false}` where the document already has them (a public page, from
 * DocumentStyle). The settings preview keeps its own: it shows a style that
 * may not be the saved one.
 */
export function ImmersiveStyles({ tokens = true }: { tokens?: boolean }) {
  return (
    <>
      {tokens && <style dangerouslySetInnerHTML={{ __html: CSS }} />}
      <div aria-hidden className="im-texture" data-texture />
    </>
  );
}
