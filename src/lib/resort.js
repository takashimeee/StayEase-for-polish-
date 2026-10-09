/**
 * Single source of truth for the resort's public details.
 * Replace every value marked PLACEHOLDER before launch.
 * Empty strings are hidden by the footer rather than shown as blanks.
 */
export const RESORT = {
  name: "Amihan Cove",
  fullName: "Amihan Cove Resort",
  tagline:
    "A small beachfront resort where the evening breeze does most of the work. Book directly with us and we'll take care of the rest.",

  // PLACEHOLDER
  address: "Purok 3, Coastal Road, Brgy. San Isidro, Calatagan, Batangas 4215",
  phone: "+63 917 555 0142",
  email: "stay@amihancove.example",

  checkIn: "3:00 PM",
  checkOut: "11:00 AM",

  // Add real URLs; icons with an empty URL are not rendered.
  social: {
    instagram: "",
    facebook: "",
    maps: "",
    messenger: "",
  },
};