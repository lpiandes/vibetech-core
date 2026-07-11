"use client";

import { useEffect } from "react";
import { LAST_BUSINESS_COOKIE } from "@/lib/platform/businessCookies";

/** Remember last business for intelligent root routing. */
export default function RememberBusinessCookie({ businessId }: { businessId: string }) {
  useEffect(() => {
    if (!businessId) return;
    document.cookie = `${LAST_BUSINESS_COOKIE}=${encodeURIComponent(businessId)}; path=/; SameSite=Lax; Max-Age=31536000`;
  }, [businessId]);
  return null;
}
