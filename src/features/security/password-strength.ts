/**
 * Password quality for the one account that can change anything.
 *
 * The form's only rule was `length < 6`. That is the floor Supabase itself
 * enforces, so the field was checking nothing the server was not already going
 * to check — on the single admin account of a site whose database this password
 * ultimately guards.
 *
 * Deliberately not a score out of 100. A meter that says "72%" invites tuning
 * until the bar turns green; naming the specific thing that is missing is
 * something the owner can act on.
 */

export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordAssessment {
  /** Fails any hard requirement. */
  acceptable: boolean;
  /** 0-4, for the meter. */
  score: number;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
  /** What would improve it, most valuable first. Empty once nothing would. */
  suggestions: string[];
}

/** Sequences and repeats a cracker tries before anything else. */
const OBVIOUS_PATTERNS = [
  /(.)\1{2,}/, // aaa
  /012|123|234|345|456|567|678|789/,
  /abc|bcd|cde|def|efg|fgh|ghi/i,
  /qwer|asdf|zxcv/i,
];

const COMMON_WORDS = [
  "password",
  "passw0rd",
  "letmein",
  "welcome",
  "admin",
  "qwerty",
  "iloveyou",
  "monkey",
  "dragon",
  "sunshine",
];

export function assessPassword(password: string): PasswordAssessment {
  const suggestions: string[] = [];

  if (!password) {
    return {
      acceptable: false,
      score: 0,
      label: "Too short",
      suggestions: [`Use at least ${PASSWORD_MIN_LENGTH} characters`],
    };
  }

  const lower = password.toLowerCase();

  // Length first: it buys more than any character class does.
  if (password.length < PASSWORD_MIN_LENGTH) {
    suggestions.push(`Use at least ${PASSWORD_MIN_LENGTH} characters`);
  }

  const classes = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  if (classes < 3) {
    suggestions.push("Mix letters, numbers and symbols");
  }

  const hasCommonWord = COMMON_WORDS.some((word) => lower.includes(word));
  if (hasCommonWord) {
    suggestions.push("Avoid common words like “password” or “admin”");
  }

  const hasPattern = OBVIOUS_PATTERNS.some((re) => re.test(password));
  if (hasPattern) {
    suggestions.push("Avoid runs like “123”, “abc” or repeated characters");
  }

  // A password long enough is acceptable even if it is one long passphrase;
  // requiring a symbol in a 30-character phrase is theatre.
  const longEnough = password.length >= PASSWORD_MIN_LENGTH;
  const acceptable = longEnough && !hasCommonWord;

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= 20) score += 1;
  if (classes >= 3) score += 1;
  if (hasCommonWord || hasPattern) score -= 1;
  score = Math.max(0, Math.min(4, score));

  const label: PasswordAssessment["label"] = !longEnough
    ? "Too short"
    : score <= 1
      ? "Weak"
      : score === 2
        ? "Fair"
        : score === 3
          ? "Good"
          : "Strong";

  return { acceptable, score, label, suggestions };
}

/**
 * Do the two fields agree, and is the new one usable?
 *
 * Returns the message to show, or null when the form may be submitted. The
 * page previously did this inline with two `if` statements and its own error
 * string, which is why the rules were invisible to any test.
 */
export function passwordFormError(
  password: string,
  confirmation: string,
): string | null {
  const assessment = assessPassword(password);

  if (!assessment.acceptable) {
    return (
      assessment.suggestions[0] ??
      `Use at least ${PASSWORD_MIN_LENGTH} characters`
    );
  }

  if (password !== confirmation) return "The two passwords do not match";

  return null;
}
