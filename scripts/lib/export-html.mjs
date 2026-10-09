/**
 * The "Built with Foliokit" line every public page carries.
 *
 * It is written into the finished HTML by the build (scripts/finalize-export.mjs),
 * not rendered by a component, so it does not depend on a setting, a theme
 * or the site style, and a site built from a fork carries it without anyone
 * adding it.
 */

export const CREDIT_URL = "https://github.com/akshay-bharadva/foliokit";
export const CREDIT_NAME = "Foliokit";

/** Marks the line, so it is added once and can be checked for. */
const MARK = "data-fk";

// Inline styles: the line has to read on any theme without a class the
// stylesheet might not contain. It takes the page's own text colour.
const CREDIT =
  `<p ${MARK} style="margin:0;padding:12px 16px 16px;text-align:center;font-size:12px;line-height:1.5">` +
  `Built with <a href="${CREDIT_URL}" target="_blank" rel="noopener" ` +
  `style="color:inherit;font-weight:600;text-decoration:underline;text-underline-offset:3px">${CREDIT_NAME}</a>` +
  `</p>`;

/** Whether a page already carries the credit line and its link. */
export function hasCredit(html) {
  return html.includes(MARK) && html.includes(`href="${CREDIT_URL}"`);
}

/** The page with the credit as the last thing in its body. */
export function withCredit(html) {
  if (hasCredit(html)) return html;
  const end = html.lastIndexOf("</body>");
  if (end === -1) return html;
  return html.slice(0, end) + CREDIT + html.slice(end);
}

/**
 * Whether a built file is a public page. The private workspace and the test
 * harness are not: nobody but the owner sees them, and the workspace fills
 * the window, so a line under it would add a scrollbar.
 */
export function takesCredit(file) {
  const [first] = file.split(/[\\/]/);
  return first !== "admin" && first !== "dev";
}
