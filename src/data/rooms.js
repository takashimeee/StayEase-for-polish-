const u = (id, w = 1200) =>
  `https://images.unsplash.com/photo-${id}?q=80&w=${w}&auto=format&fit=crop`;

const P = {
  eco: "1602002418082-a4443e081dd1",
  pool: "1571003123894-1f0594d2b5d9",
  bed1: "1616594039964-ae9021a400a0",
  villa: "1600585154340-be6161a56a0c",
  bed2: "1616486338812-3dadae4b4ace",
  ocean: "1611892440504-42a792e24d32",
  garden: "1600607687920-4e2a09cf159d",
  penthouse: "1582719478250-c89cae4dc85b",
  resort: "1587061949409-02df41d5e562",
};

const gallery = (...keys) => keys.map((k) => u(P[k], 1000));

export const HERO_IMAGE = u(P.pool, 1800);

export const ROOM_STYLES = ["All Styles", "Ocean Front", "Tropical Forest", "Private Villa", "City Gateways"];

export const GUEST_OPTIONS = [
  { value: "1a", label: "1 Adult", adults: 1, children: 0 },
  { value: "2a", label: "2 Adults", adults: 2, children: 0 },
  { value: "2a1c", label: "2 Adults, 1 Child", adults: 2, children: 1 },
  { value: "2a2c", label: "2 Adults, 2 Children", adults: 2, children: 2 },
  { value: "3a", label: "3 Adults", adults: 3, children: 0 },
  { value: "4a", label: "4 Adults", adults: 4, children: 0 },
];

export const getGuestOption = (value) =>
  GUEST_OPTIONS.find((g) => g.value === value) ?? GUEST_OPTIONS[1];

export const guestKeyFor = (adults, children) =>
  GUEST_OPTIONS.find((g) => g.adults === adults && g.children === children)?.value ?? "2a";

export const ROOMS = [
  {
    id: "ocean-suite",
    name: "Ocean Suite",
    resort: "StayEase Maldives Resort",
    location: "Maldives · Overwater Suite",
    style: "Ocean Front",
    beds: "1 King Bed",
    maxGuests: 3,
    sqm: 55,
    view: "Sea View",
    price: 540,
    minNights: 1,
    popular: true,
    chips: ["WiFi", "Private Pool", "Breakfast Included"],
    rating: 4.9,
    reviewCount: 98,
    image: u(P.ocean, 900),
    gallery: gallery("ocean", "pool", "bed1", "bed2"),
    about: [
      "Perched above turquoise water, this overwater suite opens onto panoramic sea views from a private deck with its own plunge pool. Floor-to-ceiling glass keeps the horizon in view from bed to bath.",
      "Wake to the sound of the lagoon, take breakfast on the deck, and finish the day with a sunset soak. Everything is designed for slow, effortless days.",
    ],
    amenities: ["wifi", "ac", "breakfast", "pool", "minibar", "shower", "service", "tv", "safe"],
  },
  {
    id: "garden-villa",
    name: "Garden Villa",
    resort: "StayEase Bali Gateway",
    location: "Bali, Indonesia · Jungle Villa",
    style: "Tropical Forest",
    beds: "1 King Bed",
    maxGuests: 4,
    sqm: 70,
    view: "Garden View",
    price: 280,
    minNights: 2,
    popular: true,
    chips: ["WiFi", "Infinity Pool", "King Bed"],
    rating: 4.8,
    reviewCount: 112,
    image: u(P.garden, 900),
    gallery: gallery("garden", "eco", "bed1", "villa"),
    about: [
      "A private villa wrapped in tropical greenery, with an infinity pool that spills toward the jungle canopy. Open-air living spaces blur the line between inside and out.",
      "Reclaimed timber, woven textures and soft linens keep the mood calm, while the forest deck is made for morning yoga and long dinners.",
    ],
    amenities: ["wifi", "ac", "breakfast", "pool", "balcony", "shower", "service", "tv"],
  },
  {
    id: "sunset-penthouse",
    name: "Sunset Penthouse",
    resort: "StayEase Sunset Escape",
    location: "Manila Bay, Philippines · Penthouse",
    style: "City Gateways",
    beds: "1 Queen Bed",
    maxGuests: 4,
    sqm: 90,
    view: "Bay View",
    price: 490,
    minNights: 1,
    popular: true,
    chips: ["WiFi", "Jacuzzi", "VIP Lounge"],
    rating: 4.9,
    reviewCount: 87,
    image: u(P.penthouse, 900),
    gallery: gallery("penthouse", "bed2", "resort", "bed1"),
    about: [
      "Top-floor living with a wraparound terrace facing the bay, timed perfectly for golden hour. A private jacuzzi and VIP lounge access make this the city's most relaxed address.",
      "Inside, warm wood, soft lighting and a fully stocked minibar set the tone for an easy evening after a day exploring.",
    ],
    amenities: ["wifi", "ac", "breakfast", "jacuzzi", "lounge", "balcony", "minibar", "service", "tv", "safe"],
  },
  {
    id: "royal-beach-pavilion",
    name: "Royal Beach Pavilion",
    resort: "StayEase Boracay Shore",
    location: "Boracay, Philippines · Beachfront Pavilion",
    style: "Ocean Front",
    beds: "2 King Beds",
    maxGuests: 4,
    sqm: 85,
    view: "Beach View",
    price: 450,
    minNights: 2,
    popular: false,
    chips: ["WiFi", "Beach Access", "Breakfast Included"],
    rating: 4.7,
    reviewCount: 143,
    image: u(P.pool, 900),
    gallery: gallery("pool", "ocean", "bed2", "resort"),
    about: [
      "Step from your terrace straight onto white sand. The pavilion sleeps a family in two king beds, with a shaded lounge overlooking the water.",
      "Breakfast arrives on the veranda each morning, and the sunsets from the beachfront are unbeatable.",
    ],
    amenities: ["wifi", "ac", "breakfast", "balcony", "minibar", "shower", "service", "tv"],
  },
  {
    id: "eco-canopy-sanctuary",
    name: "Eco Canopy Sanctuary",
    resort: "StayEase Bali Gateway",
    location: "Bali, Indonesia · Deluxe Garden Suite",
    style: "Tropical Forest",
    beds: "1 Queen Bed",
    maxGuests: 2,
    sqm: 40,
    view: "Garden View",
    price: 190,
    minNights: 3,
    popular: false,
    chips: ["WiFi", "Sunset Balcony", "Breakfast Included"],
    rating: 4.9,
    reviewCount: 127,
    image: u(P.eco, 900),
    gallery: gallery("eco", "pool", "bed1", "villa"),
    about: [
      "Tucked into the forest canopy of Bali, Indonesia, this elevated wooden cabin offers a true escape into immersive nature living. Soaring timber pillars lift the suite above the forest floor, framing panoramic views of lush greenery through floor-to-ceiling glass.",
      "Inside, the bedroom offers a serene retreat with reclaimed wood finishes and soft, natural linens. Step out onto the private deck for al fresco dining, sunset yoga, or simply let the sounds of the forest settle in around you.",
    ],
    amenities: ["wifi", "ac", "breakfast", "balcony", "minibar", "shower", "service", "tv", "safe"],
  },
  {
    id: "heritage-pool-estate",
    name: "Heritage Pool Estate",
    resort: "StayEase Cebu Heritage",
    location: "Cebu, Philippines · Private Estate",
    style: "Private Villa",
    beds: "3 Double Beds",
    maxGuests: 6,
    sqm: 160,
    view: "Courtyard & Pool",
    price: 510,
    minNights: 2,
    popular: false,
    chips: ["WiFi", "Private Pool", "Chef on Request"],
    rating: 4.8,
    reviewCount: 64,
    image: u(P.villa, 900),
    gallery: gallery("villa", "garden", "bed1", "pool"),
    about: [
      "A restored heritage estate with a courtyard pool, three bedrooms and generous living spaces. Ideal for families and groups who want privacy without giving up service.",
      "Carved wood details and cool stone floors keep the house comfortable all day. A private chef can be arranged on request.",
    ],
    amenities: ["wifi", "ac", "breakfast", "pool", "minibar", "shower", "service", "tv", "safe"],
  },
];

export const REVIEWS = [
  {
    author: "Sarah L. Jenkins",
    meta: "Verified Guest · Stayed in July",
    date: "Jul 12, 2026",
    rating: 5,
    text: "Absolutely magical — the views are completely private. The attention to natural detail made us feel immersed in nature without sacrificing modern comfort.",
  },
  {
    author: "Miguel Santos",
    meta: "Verified Guest · Stayed in May",
    date: "May 28, 2026",
    rating: 5,
    text: "Service was flawless from check-in to check-out. Breakfast on the deck was the highlight of our trip.",
  },
  {
    author: "Aiko Tanaka",
    meta: "Verified Guest · Stayed in March",
    date: "Mar 9, 2026",
    rating: 4,
    text: "Beautiful room and very peaceful. We would have loved a slightly later check-out, but otherwise perfect.",
  },
];

export const findRoom = (id) => ROOMS.find((r) => r.id === id);
