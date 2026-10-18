/**
 * The tick that marks the current choice in a `.block-menu` — the block handle's
 * menu (the block's type, the hidden-files toggle in the sidebar's folder menu).
 */
export function MenuCheck() {
  return (
    <svg
      className="block-menu-check"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      aria-hidden
    >
      <path
        d="M3.5 8.5l3 3 6.5-7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
