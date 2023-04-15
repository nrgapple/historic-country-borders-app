import React from "react";

export default function IconDefault({ size = 34, color = "#fff", ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      color={color}
      fill="currentColor"
      viewBox="0 0 256 256"
      {...props}
    >
      <path
        d="M132,216H47.7a7.6,7.6,0,0,1-7.7-7.7V124a92,92,0,0,1,92-92h0a92,92,0,0,1,92,92h0A92,92,0,0,1,132,216Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="14"
      />
      <circle cx="132" cy="128" r="12" />
      <circle cx="84" cy="128" r="12" />
      <circle cx="180" cy="128" r="12" />
    </svg>
  );
}
