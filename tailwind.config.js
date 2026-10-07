/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    // lib + hooks hold runtime-applied class names (VALID_THEMES,
    // THEME_PRESETS, typography presets) — without scanning them Tailwind
    // tree-shakes the corresponding custom styles out of the bundle.
    "./src/lib/**/*.{js,ts,jsx,tsx}",
    "./src/hooks/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-body)", "Inter", "sans-serif"],
        heading: ["var(--font-heading)", "Inter", "sans-serif"],
        mono: [
          "var(--font-code)",
          "JetBrains Mono",
          "IBM Plex Mono",
          "monospace",
        ],
        caveat: ["var(--font-caveat)", "Caveat", "cursive"],
        handwriting: ["Caveat", "cursive"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
        // State, never data (F11): every preset resolves these, gated by
        // check:themes. Always shown with an icon or text, never alone.
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // v3 two-tier shape system: surfaces (cards, panels) and controls
        // (buttons, inputs). lg/md/sm above follow each preset's --radius and
        // stay for the shadcn primitives. (The v3 vision doc this came from
        // was never in the repo; .ai/DESIGN_SYSTEM.md records the system.)
        surface: "var(--r-surface)",
        control: "var(--r-control)",
      },
      // Named layers, lowest first. Values are the ones the code
      // already used, so naming them changed nothing on screen.
      zIndex: {
        raised: "10", // above its siblings: badges, hover actions
        sticky: "20", // sticky within a scroll area: table columns, toolbars
        chrome: "30", // page chrome: top bar, reading progress, floating buttons
        rail: "40", // fixed rails and full-screen editors
        overlay: "50", // dialogs, sheets, popovers, menus (Radix portals)
        skip: "60", // the skip link, above an open overlay
        top: "100", // maintenance screen: covers everything
      },
      // One motion scale. Easing is `enter` / `exit` below.
      transitionDuration: {
        instant: "var(--d-instant)",
        fast: "var(--d-fast)",
        base: "var(--d-base)",
        slow: "var(--d-slow)",
        page: "var(--d-page)",
      },
      boxShadow: {
        // v3 elevation. Derived from the theme's own foreground so depth reads
        // correctly on light and dark presets alike.
        e1: "var(--e-1)",
        e2: "var(--e-2)",
        e3: "var(--e-3)",
      },
      maxWidth: {
        content: "var(--w-content)",
        wide: "var(--w-wide)",
        prose: "var(--w-prose)",
        hero: "var(--w-hero)",
      },
      fontSize: {
        display: ["var(--t-display)", { lineHeight: "1.05" }],
        title: ["var(--t-title)", { lineHeight: "1.12" }],
        heading: ["var(--t-heading)", { lineHeight: "1.25" }],
        lead: ["var(--t-lead)", { lineHeight: "1.55" }],
        micro: ["var(--t-micro)", { lineHeight: "1.4" }],
      },
      transitionTimingFunction: {
        enter: "cubic-bezier(0.32, 0.72, 0, 1)",
        exit: "cubic-bezier(0.4, 0, 1, 1)",
        standard: "cubic-bezier(0.2, 0, 0.38, 0.9)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%, 70%, 100%": { opacity: "1" },
          "20%, 50%": { opacity: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.2s ease-out infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    function ({ addUtilities }) {
      addUtilities({
        ".break-inside-avoid": {
          "break-inside": "avoid",
        },
      });
    },
  ],
};
