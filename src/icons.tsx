import type { ReactNode } from "react";

interface IconProps {
  size?: number | string;
  className?: string;
}

// Linear path data from Iconsax (MIT), with the app's shared SVG attributes.
function linear(paths: ReactNode) {
  return function LinearIcon({ size = 20, className }: IconProps) {
    return (
      <svg
        className={`ak-icon${className ? ` ${className}` : ""}`}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit="10"
        aria-hidden="true"
      >
        {paths}
      </svg>
    );
  };
}

/** Determinate-feel spinner for busy states — inherits text color. */
export function SpinnerIcon({ size = 16, className }: IconProps) {
  return (
    <svg
      className={`ak-icon ak-spin${className ? ` ${className}` : ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const SettingIcon = linear(
  <>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    <path d="M2 12.88v-1.76c0-1.04.85-1.9 1.9-1.9 1.81 0 2.55-1.28 1.64-2.85-.52-.9-.21-2.07.7-2.59l1.73-.99c.79-.47 1.81-.19 2.28.6l.11.19c.9 1.57 2.38 1.57 3.29 0l.11-.19c.47-.79 1.49-1.07 2.28-.6l1.73.99c.91.52 1.22 1.69.7 2.59-.91 1.57-.17 2.85 1.64 2.85 1.04 0 1.9.85 1.9 1.9v1.76c0 1.04-.85 1.9-1.9 1.9-1.81 0-2.55 1.28-1.64 2.85.52.91.21 2.07-.7 2.59l-1.73.99c-.79.47-1.81.19-2.28-.6l-.11-.19c-.9-1.57-2.38-1.57-3.29 0l-.11.19c-.47.79-1.49 1.07-2.28.6l-1.73-.99a1.899 1.899 0 0 1-.7-2.59c.91-1.57.17-2.85-1.64-2.85-1.05 0-1.9-.86-1.9-1.9Z" />
  </>,
);
export const PrevIcon = linear(
  <path d="M15 19.92L8.48 13.4c-.77-.77-.77-2.03 0-2.8L15 4.08" />,
);
export const NextIcon = linear(
  <path d="M8.91 19.92l6.52-6.52c.77-.77.77-2.03 0-2.8L8.91 4.08" />,
);
export const TrashIcon = linear(
  <path d="M21 5.98c-3.33-.33-6.68-.5-10.02-.5-1.98 0-3.96.1-5.94.3L3 5.98M8.5 4.97l.22-1.31C8.88 2.71 9 2 10.69 2h2.62c1.69 0 1.82.75 1.97 1.67l.22 1.3M18.85 9.14l-.65 10.07C18.09 20.78 18 22 15.21 22H8.79C6 22 5.91 20.78 5.8 19.21L5.15 9.14M10.33 16.5h3.33M9.5 12.5h5" />,
);
export const InfoCircleIcon = linear(
  <>
    <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10ZM12 8v5" />
    <path d="M11.995 16h.009" strokeWidth="2" />
  </>,
);

/** Locally drawn quota gauge, matching the app's 1.5px Linear outlines. */
export function UsageIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      className={`ak-icon${className ? ` ${className}` : ""}`}
      data-icon="usage-gauge"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5.6 19a9 9 0 1 1 12.8 0H5.6Z" />
      <path d="M5 12h2m10 0h2M12 5v2M7 7l1.4 1.4M16 8l-3 4" />
      <circle cx="12" cy="13" r="1.5" />
    </svg>
  );
}
export const ChartIcon = linear(
  <>
    <path d="M2 22h20" />
    <path d="M9.75 4v18h4.5V4c0-1.1-.45-2-1.8-2h-.9c-1.35 0-1.8.9-1.8 2ZM3 10v12h4V10c0-1.1-.4-2-1.6-2h-.8C3.4 8 3 8.9 3 10ZM17 15v7h4v-7c0-1.1-.4-2-1.6-2h-.8c-1.2 0-1.6.9-1.6 2Z" />
  </>,
);
export const LogoutIcon = linear(
  <path d="M17.44 14.62L20 12.06 17.44 9.5M9.76 12.06h10.17M11.76 20c-4.42 0-8-3-8-8s3.58-8 8-8" />,
);
export const CloseIcon = linear(
  <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10ZM9.17 14.83l5.66-5.66M14.83 14.83 9.17 9.17" />,
);
export const AddIcon = linear(
  <path d="M6 12h12M12 18V6" />,
);
export const SaveIcon = linear(
  <>
    <path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10Z" />
    <path d="m7.75 12 2.83 2.83 5.67-5.66" />
  </>,
);
export const CopyIcon = linear(
  <>
    <path d="M16 12.9v4.2c0 3.5-1.4 4.9-4.9 4.9H6.9C3.4 22 2 20.6 2 17.1v-4.2C2 9.4 3.4 8 6.9 8h4.2c3.5 0 4.9 1.4 4.9 4.9z" />
    <path d="M22 6.9v4.2c0 3.5-1.4 4.9-4.9 4.9H16v-3.1C16 9.4 14.6 8 11.1 8H8V6.9C8 3.4 9.4 2 12.9 2h4.2C20.6 2 22 3.4 22 6.9z" />
  </>,
);
export const EyeIcon = linear(
  <>
    <path d="M15.58 12c0 1.98-1.6 3.58-3.58 3.58S8.42 13.98 8.42 12s1.6-3.58 3.58-3.58 3.58 1.6 3.58 3.58Z" />
    <path d="M12 20.27c3.53 0 6.82-2.08 9.11-5.68.9-1.41.9-3.78 0-5.19-2.29-3.6-5.58-5.68-9.11-5.68-3.53 0-6.82 2.08-9.11 5.68-.9 1.41-.9 3.78 0 5.19 2.29 3.6 5.58 5.68 9.11 5.68Z" />
  </>,
);
export const EyeOffIcon = linear(
  <>
    <path d="m14.53 9.47-5.06 5.06a3.576 3.576 0 1 1 5.06-5.06Z" />
    <path d="M17.82 5.77C16.07 4.45 14.07 3.73 12 3.73c-3.53 0-6.82 2.08-9.11 5.68-.9 1.41-.9 3.78 0 5.19.79 1.24 1.71 2.31 2.71 3.17M8.42 19.53c1.14.48 2.35.74 3.58.74 3.53 0 6.82-2.08 9.11-5.68.9-1.41.9-3.78 0-5.19-.33-.52-.69-1.01-1.06-1.47" />
    <path d="M15.51 12.7a3.565 3.565 0 0 1-2.82 2.82M9.47 14.53 2 22M22 2l-7.47 7.47" />
  </>,
);
export const KeyIcon = linear(
  <>
    <path d="M19.79 14.93a7.575 7.575 0 0 1-7.6 1.87l-4.71 4.7c-.34.35-1.01.56-1.49.49l-2.18-.3c-.72-.1-1.39-.78-1.5-1.5l-.3-2.18c-.07-.48.16-1.15.49-1.49l4.7-4.7c-.8-2.6-.18-5.55 1.88-7.6 2.95-2.95 7.74-2.95 10.7 0 2.96 2.95 2.96 7.76.01 10.71ZM6.89 17.49l2.3 2.3" />
    <path d="M14.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
  </>,
);
export const TickIcon = SaveIcon;
export function RefreshIcon({ size = 20, className }: IconProps) {
  return <svg className={`ak-icon${className ? ` ${className}` : ""}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 3v6h-6M21 9a9 9 0 1 0-2.74 9.74" />
  </svg>;
}

export function ResetIcon({ size = 20 }: IconProps) {
  return <svg className="ak-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 8a8 8 0 1 1-.5 7M4 3v5h5" />
  </svg>;
}

/** Two-way account switch, distinct from the data refresh action. */
export function AccountSwitchIcon({ size = 20 }: IconProps) {
  return <svg className="ak-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4" /></svg>;
}

/** Rename an account without changing its login. */
export const EditIcon = linear(
  <>
    <path d="m13.26 3.6-8.21 8.69c-.31.33-.61.98-.67 1.43l-.37 3.24c-.13 1.17.71 1.97 1.87 1.77l3.22-.55c.45-.08 1.08-.41 1.39-.75l8.21-8.69c1.42-1.5 2.06-3.21-.15-5.3-2.2-2.07-3.87-1.34-5.29.16Z" />
    <path d="M11.89 5.05a6.126 6.126 0 0 0 5.45 5.15M3 22h18" />
  </>,
);
