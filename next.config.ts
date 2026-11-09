import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {},
  // pdf-parse (pdfjs) et son moteur canvas utilisent des API Node natives :
  // on les charge avec le require de Node au lieu de les empaqueter.
  serverExternalPackages: ['pdf-parse', '@napi-rs/canvas'],
};

export default withPWA(nextConfig);
