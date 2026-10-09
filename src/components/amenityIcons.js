import {
  Wifi,
  Snowflake,
  Coffee,
  Sunset,
  Wine,
  ShowerHead,
  BellRing,
  Tv,
  Lock,
  Droplets,
  Sparkles,
  Crown,
} from "lucide-react";

export const AMENITY_META = {
  wifi: { icon: Wifi, label: "Complimentary High-speed WiFi" },
  ac: { icon: Snowflake, label: "Climate Controlled A/C" },
  breakfast: { icon: Coffee, label: "Breakfast Included" },
  balcony: { icon: Sunset, label: "Private Sunset Balcony" },
  minibar: { icon: Wine, label: "Fully-stocked Minibar" },
  shower: { icon: ShowerHead, label: "Spacious Rain Shower" },
  service: { icon: BellRing, label: "24-Hour Room Service" },
  tv: { icon: Tv, label: "50-Inch Smart TV" },
  safe: { icon: Lock, label: "In-Room Digital Safe" },
  pool: { icon: Droplets, label: "Private Pool" },
  jacuzzi: { icon: Sparkles, label: "Private Jacuzzi" },
  lounge: { icon: Crown, label: "VIP Lounge Access" },
};
