/** A connected C: three memory paths converge on one point of recall. */
export default function CortexMark() {
  return (
    <svg
      viewBox="0 0 40 40"
      width="36"
      height="36"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M29 8.5a14 14 0 1 0 0 23"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M28 9l-9 6m0 0-7 5 7 5m0-10v10m0 0 9 6M19 15l10 5-10 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".75"
      />
      <circle cx="29" cy="8.5" r="3.5" fill="currentColor" />
      <circle cx="29" cy="31.5" r="3.5" fill="currentColor" />
      <circle cx="12" cy="20" r="2.6" fill="currentColor" />
      <circle cx="29" cy="20" r="3" fill="currentColor" />
      <circle cx="19" cy="15" r="2.1" fill="currentColor" />
      <circle cx="19" cy="25" r="2.1" fill="currentColor" />
    </svg>
  );
}
