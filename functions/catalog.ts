// Shared home details and policies for the website and Zeno.

export type AreaId = "dha" | "gulshan" | "johar";

export type AmenityId =
  | "wifi"
  | "ac"
  | "kitchen"
  | "fridge"
  | "microwave"
  | "iron"
  | "tv"
  | "washer"
  | "lift"
  | "parking"
  | "terrace"
  | "balcony"
  | "view"
  | "dining"
  | "utilities"
  | "servant"
  | "caretaker"
  | "nearby";

export type HighlightIcon =
  | "lift"
  | "store"
  | "bath"
  | "terrace"
  | "view"
  | "shield"
  | "parking"
  | "family"
  | "tv"
  | "balcony"
  | "sparkles";

export interface Photo {
  src: string;
  alt: string;
}

export interface Listing {
  slug: string;
  name: string;
  type: "Apartment" | "Penthouse" | "Portion";
  area: AreaId;
  locality: string;
  address: string;
  mapQuery: string;
  floor?: string;
  bedrooms: number;
  bathrooms: number;
  beds?: number;
  maxGuests?: number;
  summary: string;
  about: string[];
  space: string[];
  highlights: { icon: HighlightIcon; title: string; text: string }[];
  amenities: AmenityId[];
  sleeping?: { room: string; beds: string }[];
  safetyNotes?: string[];
  airbnb?: { url: string; rating: number; reviews: number; guestFavourite: boolean };
  photos: Photo[];
}

export const business = {
  name: "Zen Vacation Homes",
  city: "Karachi",
  country: "Pakistan",
  slogans: ["Escape to calmness!", "Real stays. Real pictures.", "Find Inner Peace with Zen Homes!"],
  phoneDisplay: "+92 321 2228426",
  whatsappNumber: "923212228426",
  email: "zenvacationhome@gmail.com",
  host: {
    name: "Faisal",
    firstName: "Faisal",
    coHost: "Muneer",
    superhost: true,
    yearsHosting: 3,
    reviewCount: 123,
    rating: 4.85,
    responseRate: "100%",
    responseTime: "within an hour",
  },
  links: {
    instagram: "https://www.instagram.com/zenvacationhomes/",
    facebook: "https://www.facebook.com/zenvacationhome/",
    youtube: "https://www.youtube.com/@ZenVacationHomes/videos",
    airbnb: "https://www.airbnb.ie/rooms/1575588774046482498",
  },
  alsoListedOn: ["Airbnb", "Booking.com"],
  includedEverywhere: [
    "Water, gas and electricity",
    "Wi-Fi",
    "Air conditioning",
    "Servant service",
    "Food and stores within walking distance",
  ],
} as const;

export const areas: { id: AreaId; name: string; short: string; hint: string }[] = [
  { id: "dha", name: "DHA Phase VI", short: "DHA", hint: "Bukhari & Nishat Commercial" },
  { id: "gulshan", name: "Gulshan-e-Iqbal", short: "Gulshan", hint: "Block 7 & Block 13-E" },
  { id: "johar", name: "Gulistan-e-Johar", short: "Johar", hint: "Block 14" },
];

export const houseRules = {
  checkIn: "After 1:00 PM",
  checkOut: "Before 12:00 noon",
  rules: [
    {
      id: "registered",
      title: "Registered guests only",
      text: "Only the guests named on the booking may stay. Visitors of the opposite gender are not allowed.",
    },
    {
      id: "couples",
      title: "Married couples only",
      text: "Unmarried couples are not allowed. Couples must show proof of marriage at check-in.",
    },
    {
      id: "id",
      title: "Valid ID for every adult",
      text: "Pakistani guests: CNIC front and back, for government data entry. Foreign guests: passport front page, visa copy and entry stamp.",
    },
    {
      id: "substances",
      title: "No alcohol, drugs or parties",
      text: "Zen homes are quiet, family-friendly spaces for rest.",
    },
  ],
} as const;

export const reviews = [
  {
    name: "Adnan",
    from: "Stayed at the Nishat Commercial, DHA apartment",
    title: "Awesome place for staycation",
    text: "Our stay at this property was awesome. Mr. Faisal's hospitality was exceptional. He was very cooperative in every way and had a down-to-earth personality. The property itself is conveniently located with easy access to the nearby market and places in Karachi. The area is safe and the property was secured with the right procedures in place. There was 100% availability of electricity and water. It was neat and clean upon arrival, just as the listing described on Booking.com. Our stay as a family exceeded our expectations. Indeed, it's highly recommended for personal or family staycations.",
    source: "Guest review",
  },
  {
    name: "Syed",
    from: "Manama, Bahrain",
    title: "Makes you feel at home",
    text: "Stayed a few nights. Very nice and clean place and the host Faisal is a very welcoming person, makes you feel at home. Thank you brother Faisal for the delicious biryani. I recommend this place to everyone.",
    source: "Airbnb · April 2024",
  },
  {
    name: "Dr Shakeela",
    from: "Stayed at the Nishat Commercial, DHA apartment",
    title: "Excellent hospitality",
    text: "Very cooperative owner, comfortable stay. The owner provided excellent hospitality and was always willing to help with any requests. I would highly recommend this place to anyone looking for a pleasant accommodation experience.",
    source: "Guest review",
  },
  {
    name: "Mr. Adeel",
    from: "Stayed about a week",
    title: "Felt right at home",
    text: "My stay at Faisal's place was great, felt right at home and there were a lot of good restaurants around.",
    source: "Airbnb",
  },
] as const;

// Demo photography shipped with this showcase repository. The live deployment
// uses the owner's own listing photographs, kept in a private folder.
const demoAlts: Record<number, string> = {
  1: "Lounge with a cream sectional sofa",
  2: "Bedroom with a teal accent wall",
  3: "Kitchen with a marble island",
  4: "Terrace with a hanging swing at dusk",
  5: "Round marble dining table",
  6: "Bedroom with a carved wooden bed",
  7: "Night view over the city",
  8: "Bathroom with a walk-in shower",
  9: "Living room with a TV feature wall",
};
const photos = (items: number[]): Photo[] =>
  items.map(n => ({ src: `/listings/demo/${String(n).padStart(2, "0")}.png`, alt: demoAlts[n] }));

export const listings: Listing[] = [
  {
    slug: "travellers-homes-2br-gulshan",
    name: "Travellers Homes",
    type: "Portion",
    area: "gulshan",
    locality: "Block 7, Gulshan-e-Iqbal",
    address: "Block 7, Gulshan-e-Iqbal, Karachi",
    mapQuery: "Block 7, Gulshan-e-Iqbal, Karachi",
    floor: "First-floor portion of a 500 sq yd bungalow",
    bedrooms: 2,
    bathrooms: 2,
    beds: 5,
    maxGuests: 8,
    summary:
      "The whole first floor of a secure bungalow, with a 75-inch TV lounge, a furnished terrace and free parking.",
    about: [
      "Your own first-floor portion of a secure 500 sq yd bungalow in Block 7, Gulshan-e-Iqbal, set up for families and groups of up to eight guests.",
      "Gather in a lounge with sofas, a dining table and a 75-inch TV. Cook in a kitchen stocked with a microwave, kettle, fridge, stove and utensils, with a separate dirty kitchen. Step out onto the furnished terrace in the evening. A caretaker is on site 24/7.",
    ],
    space: [
      "2 bedrooms, 5 beds and 2 bathrooms",
      "Lounge with sofas, dining table and 75\" TV",
      "Kitchen with microwave, kettle, fridge, stove and utensils",
      "Separate dirty kitchen and a washing machine",
      "Furnished terrace and free parking on the premises",
    ],
    highlights: [
      { icon: "shield", title: "Secure bungalow", text: "A private portion with a caretaker on site around the clock." },
      { icon: "tv", title: "75-inch TV lounge", text: "Sofas and a dining table for the whole family." },
      { icon: "terrace", title: "Furnished terrace", text: "Fresh air and seating for slow evenings." },
    ],
    amenities: ["wifi", "ac", "kitchen", "fridge", "microwave", "tv", "washer", "parking", "terrace", "dining", "utilities", "servant", "caretaker", "nearby"],
    sleeping: [
      { room: "Bedroom 1", beds: "2 single beds, 1 sofa bed, 1 floor mattress" },
      { room: "Bedroom 2", beds: "1 king bed, 1 sofa bed, 1 floor mattress, 4 sofas" },
    ],
    safetyNotes: ["No smoke alarm", "No carbon monoxide alarm"],
    airbnb: { url: "https://www.airbnb.ie/rooms/1575588774046482498", rating: 5.0, reviews: 5, guestFavourite: true },
    photos: photos([1, 5, 9, 4]),
  },
  {
    slug: "bukhari-vista-3br-dha",
    name: "Bukhari Vista",
    type: "Apartment",
    area: "dha",
    locality: "Bukhari Commercial, DHA Phase VI",
    address: "Bukhari Commercial, DHA Phase VI, Karachi",
    mapQuery: "Bukhari Commercial, DHA Phase 6, Karachi",
    floor: "5th floor, with lift and parking",
    bedrooms: 3,
    bathrooms: 3,
    summary:
      "A bright fifth-floor apartment in Bukhari Commercial, with three en-suite bedrooms, a lift and parking.",
    about: [
      "A bright three-bedroom apartment on the fifth floor of a building in Bukhari Commercial, a short walk from cafés and everyday shopping in DHA Phase VI.",
      "Every bedroom has its own attached bathroom, so families and groups keep their privacy. A lounge, a separate living room with dining table and a modern kitchen give everyone room to settle in.",
    ],
    space: [
      "3 bedrooms, each with an attached bathroom",
      "Lounge and separate living room",
      "Modern kitchen with fridge and microwave",
      "5th floor with lift and parking",
    ],
    highlights: [
      { icon: "lift", title: "Lift and parking", text: "Easy arrivals with luggage, and a spot for your car." },
      { icon: "store", title: "Everything nearby", text: "Groceries, cafés and stores within walking distance." },
      { icon: "bath", title: "Three en-suite bedrooms", text: "Each bedroom has its own attached bathroom." },
    ],
    amenities: ["wifi", "ac", "kitchen", "fridge", "microwave", "iron", "tv", "lift", "parking", "dining", "utilities", "servant", "nearby"],
    photos: photos([2, 9, 3, 6]),
  },
  {
    slug: "elegant-2br-penthouse-johar",
    name: "Elegant Penthouse",
    type: "Penthouse",
    area: "johar",
    locality: "Block 14, Gulistan-e-Johar",
    address: "Block 14, Gulistan-e-Johar, Karachi",
    mapQuery: "Block 14, Gulistan-e-Johar, Karachi",
    bedrooms: 2,
    bathrooms: 2,
    summary: "A two-bedroom penthouse with its own green turf terrace, a hanging swing and evening lights.",
    about: [
      "A two-bedroom penthouse in Block 14, Gulistan-e-Johar, with a private green turf terrace.",
      "Swing in the hanging egg chair, sit out under the string lights after sunset, then retreat to bedrooms with attached bathrooms. A kitchen, fridge, Wi-Fi and air conditioning are included.",
    ],
    space: [
      "2 bedrooms, each with an attached bathroom",
      "Kitchen with fridge",
      "Private turf terrace with a swing and lounge seating",
    ],
    highlights: [
      { icon: "terrace", title: "Private turf terrace", text: "Green turf, a hanging swing and seating under string lights." },
      { icon: "bath", title: "Two en-suite bedrooms", text: "Each bedroom has its own attached bathroom." },
      { icon: "sparkles", title: "Penthouse calm", text: "Top-floor privacy in Gulistan-e-Johar." },
    ],
    amenities: ["wifi", "ac", "kitchen", "fridge", "terrace", "utilities", "servant", "nearby"],
    photos: photos([4, 2, 1, 7]),
  },
  {
    slug: "travellers-heaven-3br-dha",
    name: "Travellers Heaven",
    type: "Apartment",
    area: "dha",
    locality: "Nishat Commercial, DHA Phase VI",
    address: "Nishat Commercial, DHA Phase VI, Karachi",
    mapQuery: "Nishat Commercial, DHA Phase 6, Karachi",
    floor: "1st floor, with lift",
    bedrooms: 3,
    bathrooms: 3,
    summary: "A designer three-bedroom apartment in Nishat Commercial with two balconies and a lift.",
    about: [
      "A calm three-bedroom apartment on the first floor of a building in Nishat Commercial, with a lift for easy arrivals.",
      "Sculpted, arched headboards and attached bathrooms in every bedroom, a lounge with a dining area, a fully equipped kitchen and two balconies for fresh air.",
    ],
    space: [
      "3 bedrooms, each with an attached bathroom",
      "Lounge with dining area",
      "Fully equipped kitchen",
      "2 balconies",
      "1st floor with lift",
    ],
    highlights: [
      { icon: "balcony", title: "Two balconies", text: "Morning tea with a breeze." },
      { icon: "lift", title: "Lift access", text: "First-floor apartment with a lift in the building." },
      { icon: "store", title: "Nishat Commercial", text: "Restaurants and stores within walking distance." },
    ],
    amenities: ["wifi", "ac", "kitchen", "fridge", "microwave", "lift", "balcony", "dining", "utilities", "servant", "nearby"],
    photos: photos([9, 3, 6, 5]),
  },
  {
    slug: "luxury-penthouse-1br-gulshan",
    name: "Luxury Living Penthouse",
    type: "Penthouse",
    area: "gulshan",
    locality: "Block 7, Gulshan-e-Iqbal",
    address: "Block 7, Gulshan-e-Iqbal, Karachi",
    mapQuery: "Block 7, Gulshan-e-Iqbal, Karachi",
    bedrooms: 1,
    bathrooms: 1,
    summary: "A one-bedroom penthouse with city views, warm cove lighting and a separate lounge.",
    about: [
      "A one-bedroom penthouse in Block 7, Gulshan-e-Iqbal, with city views that are especially beautiful at night.",
      "A low platform bed under warm cove lighting, an attached bathroom and a separate lounge with sofas and a TV. A quiet base for solo travellers and couples.",
    ],
    space: [
      "1 bedroom with attached bathroom",
      "Lounge with sofas and TV",
      "City views from the balcony",
    ],
    highlights: [
      { icon: "view", title: "City views", text: "Watch Karachi light up from the balcony." },
      { icon: "sparkles", title: "Modern interiors", text: "Platform bed, marble floors and cove lighting." },
      { icon: "store", title: "Central Gulshan", text: "Food and stores within walking distance." },
    ],
    amenities: ["wifi", "ac", "fridge", "iron", "tv", "view", "utilities", "servant", "nearby"],
    photos: photos([6, 7, 1, 2]),
  },
  {
    slug: "huge-luxury-3br-nishat",
    name: "Huge Luxury Apartment",
    type: "Apartment",
    area: "dha",
    locality: "Nishat Commercial, DHA Phase VI",
    address: "Nishat Commercial, DHA Phase VI, Karachi",
    mapQuery: "Nishat Commercial, DHA Phase 6, Karachi",
    bedrooms: 3,
    bathrooms: 3,
    summary: "A spacious three-bedroom apartment with a formal sitting room, a TV lounge and a lift.",
    about: [
      "A large three-bedroom apartment in Nishat Commercial, made for big families who want room to spread out.",
      "Three bedrooms with attached bathrooms, a TV lounge with a chandelier, a formal sitting room with gold-trimmed sofas, a dining corner and a kitchen, with an elevator in the building.",
    ],
    space: [
      "3 bedrooms, each with an attached bathroom",
      "TV lounge and formal sitting room",
      "Dining corner and kitchen",
      "Elevator in the building",
    ],
    highlights: [
      { icon: "family", title: "Room for big families", text: "Two living spaces plus three en-suite bedrooms." },
      { icon: "lift", title: "Elevator", text: "Easy access with luggage and elders." },
      { icon: "store", title: "Nishat Commercial", text: "Restaurants and stores within walking distance." },
    ],
    amenities: ["wifi", "ac", "kitchen", "tv", "lift", "dining", "utilities", "servant", "nearby"],
    photos: photos([9, 6, 5, 8]),
  },
  {
    slug: "travellers-heaven-2br-gulshan",
    name: "Travellers Heaven",
    type: "Apartment",
    area: "gulshan",
    locality: "Block 13-E, Gulshan-e-Iqbal",
    address: "Block 13-E, Gulshan-e-Iqbal, Karachi",
    mapQuery: "Block 13-E, Gulshan-e-Iqbal, Karachi",
    bedrooms: 2,
    bathrooms: 2,
    summary: "A modern two-bedroom apartment in Block 13-E with a sectional-sofa lounge and full kitchen.",
    about: [
      "A modern two-bedroom apartment in Block 13-E, Gulshan-e-Iqbal.",
      "Both bedrooms have attached bathrooms. The lounge has a sectional sofa, a feature TV wall and cove lighting, with a dining table and kitchen for home-cooked meals.",
    ],
    space: [
      "2 bedrooms, each with an attached bathroom",
      "Lounge with sectional sofa and TV",
      "Dining area and kitchen",
    ],
    highlights: [
      { icon: "sparkles", title: "Freshly designed", text: "Cove lighting, marble floors and feature walls." },
      { icon: "bath", title: "Two en-suite bedrooms", text: "Each bedroom has its own attached bathroom." },
      { icon: "store", title: "Everyday convenience", text: "Food and stores within walking distance." },
    ],
    amenities: ["wifi", "ac", "kitchen", "tv", "dining", "utilities", "servant", "nearby"],
    photos: photos([1, 2, 3, 5]),
  },
];

export const areaName = (id: AreaId) => areas.find((a) => a.id === id)?.name ?? id;

export const typeLabel = (l: Listing) =>
  l.type === "Portion" ? "Private portion" : l.type === "Penthouse" ? "Penthouse" : "Apartment";
