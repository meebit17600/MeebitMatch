import React, { useState, useEffect, useMemo, useCallback } from "react";

// ─── Constants ──────────────────────────────────────────────────────────────

const TOTAL_SUPPLY = 20000;

const MEEBIT_IMG = (id) =>
  `https://meebits.app/meebitimages/characterimage?index=${id}&type=full&imageType=jpg`;

const CATEGORY_LABELS = {
  type: "Type", gender: "Gender",
  hair_style: "Hair Style", hair_color: "Hair Color",
  hat: "Hat", hat_color: "Hat Color",
  beard: "Beard", beard_color: "Beard Color",
  glasses: "Glasses", glasses_color: "Glasses Color",
  earring: "Earring", necklace: "Necklace",
  shirt: "Shirt", shirt_color: "Shirt Color",
  overshirt: "Overshirt", overshirt_color: "Overshirt Color",
  pants: "Pants", pants_color: "Pants Color",
  shoes: "Shoes", shoes_color: "Shoes Color",
  tattoo: "Tattoo", tattoo_motif: "Tattoo Motif",
  jersey_number: "Jersey Number",
};

// Category importance weights for scoring
const CATEGORY_IMPORTANCE = {
  type: 3.0, shirt: 2.5, shoes: 2.0, hair_style: 2.0,
  glasses: 2.0, hat: 1.8, overshirt: 1.8, pants: 1.5,
  shirt_color: 1.5, hair_color: 1.2, beard: 1.5,
  earring: 1.0, necklace: 1.0, tattoo: 1.2,
  shoes_color: 1.0, pants_color: 1.0, hat_color: 0.8,
  beard_color: 0.6, glasses_color: 0.6, overshirt_color: 0.6,
};

// ─── Utilities ──────────────────────────────────────────────────────────────

function formatName(value) {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toImageSlug(category, value) {
  const slug = value.toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  return `${category}_${slug}`;
}

// ─── Quiz Questions (21 total) ──────────────────────────────────────────────

const QUESTIONS = [
  // Q1: TYPE
  {
    question: "What's your vibe?",
    subtitle: "Pick the one that feels most like you",
    answers: [
      { text: "Life of the party", desc: "Always the center of attention", emoji: "🎉",
        traits: { type: { Human: 2.0 } } },
      { text: "Quietly observing", desc: "I see everything from the corner", emoji: "👁️",
        traits: { type: { Visitor: 2.0, Skeleton: 1.5 } } },
      { text: "Charging in headfirst", desc: "No fear, no hesitation", emoji: "🐘",
        traits: { type: { Elephant: 2.0, Pig: 1.5 } } },
      { text: "Calculated and precise", desc: "Everything has a purpose", emoji: "🤖",
        traits: { type: { Robot: 2.0, Skeleton: 1.0 } } },
      { text: "Marching to my own beat", desc: "Society's rules don't apply", emoji: "👽",
        traits: { type: { Dissected: 2.0, Visitor: 1.5 } } },
      { text: "Loyal and chill", desc: "Just here for a good time", emoji: "🐷",
        traits: { type: { Pig: 2.0, Human: 1.0 } } },
    ],
  },
  // Q2: SHIRT (activity)
  {
    question: "It's Saturday morning. What are you doing?",
    subtitle: "Be honest now",
    answers: [
      { text: "Sleeping in, then gaming", desc: "Maximum comfort mode", emoji: "🎮",
        traits: { shirt: { Hoodie: 2.0, "Oversized Hoodie": 2.0, "Hoodie Up": 1.5 }, pants: { "Athletic Shorts": 1.5, Trackpants: 1.5 } } },
      { text: "Hitting the gym", desc: "No rest days", emoji: "💪",
        traits: { shirt: { "Basketball Jersey": 2.0, "Classic Jersey": 1.5, "Bare Chest": 1.5 }, pants: { "Athletic Shorts": 2.0, Leggings: 1.5 } } },
      { text: "Brunch with friends", desc: "Looking sharp, feeling sharper", emoji: "🥂",
        traits: { shirt: { Suit: 2.0, "Suit Jacket": 1.5 }, pants: { "Suit Pants": 2.0, "Regular Pants": 1.5 }, overshirt: { "Collar Shirt": 1.5 } } },
      { text: "Exploring a flea market", desc: "Thrifting is an art form", emoji: "🛍️",
        traits: { shirt: { "Tie-dyed Tee": 2.0, Hawaiian: 2.0, "Flamingo Tee": 1.5 }, pants: { "Ripped Jeans": 2.0, "Cargo Pants": 1.5 } } },
      { text: "Working on a creative project", desc: "Paint, code, music — something", emoji: "🎨",
        traits: { shirt: { Tee: 1.5, "Ghost Tee": 1.5, "Skull Tee": 1.5, "Logo Tee": 1.5 }, pants: { "Cargo Pants": 2.0, "Short Leggings": 1.5 } } },
      { text: "Adventuring outdoors", desc: "Mountains, trails, fresh air", emoji: "🏔️",
        traits: { shirt: { Windbreaker: 2.0, "Long-sleeved": 1.5 }, pants: { "Cargo Pants": 2.0, "Regular Pants": 1.5 }, overshirt: { "Athletic Jacket": 2.0 } } },
    ],
  },
  // Q3: SHIRT (graphic tees)
  {
    question: "If you had to wear one graphic tee every day for a week, what would it be?",
    subtitle: "No judgment — okay, maybe a little",
    answers: [
      { text: "Skull print", desc: "Dark and edgy", emoji: "💀",
        traits: { shirt: { "Skull Tee": 2.5, "Snoutz Skull Tee": 1.5 } } },
      { text: "Retro pixel art", desc: "8-bit nostalgia", emoji: "👾",
        traits: { shirt: { "Invader Tee": 2.5, "CGA Shirt": 2.0, "Ghost Tee": 1.5 } } },
      { text: "Heart / love design", desc: "Wear your feelings", emoji: "❤️",
        traits: { shirt: { "Heart Tee": 2.5, "Heart Hoodie": 2.0 } } },
      { text: "Tropical vibes", desc: "Flamingos, palm trees", emoji: "🌴",
        traits: { shirt: { "Flamingo Tee": 2.5, Hawaiian: 2.0, "Tie-dyed Tee": 1.5 } } },
      { text: "Clean logo / minimal", desc: "Less is more", emoji: "✨",
        traits: { shirt: { "Logo Tee": 2.5, Tee: 2.0, "Diagonal Tee": 1.5, Lines: 1.5 } } },
      { text: "Punk rock", desc: "Safety pins and attitude", emoji: "🎸",
        traits: { shirt: { "Punk Tee": 2.5, "Glyph Shirt": 2.0, "Meepet Tee": 1.5 } } },
    ],
  },
  // Q4: COLOR PALETTE
  {
    question: "Pick your color palette",
    subtitle: "The colors you gravitate toward",
    answers: [
      { text: "All black everything", desc: "Sleek, dark, timeless", emoji: "🖤", color: "#1a1a1a",
        traits: { shirt_color: { Black: 2.5 }, shoes_color: { Black: 2.0 }, pants_color: { Black: 2.0 }, hat_color: { Black: 1.5 } } },
      { text: "Bold reds & magentas", desc: "Turn heads everywhere", emoji: "❤️", color: "#dc2626",
        traits: { shirt_color: { Red: 2.0, Magenta: 2.0 }, shoes_color: { Red: 1.5, Magenta: 1.5 }, overshirt_color: { Red: 1.5, Magenta: 1.5 } } },
      { text: "Cool purples", desc: "Mysterious and regal", emoji: "💜", color: "#7c3aed",
        traits: { shirt_color: { Purple: 2.5 }, shoes_color: { Purple: 2.0 }, pants_color: { Purple: 1.5 }, hat_color: { Purple: 1.5 } } },
      { text: "Clean whites & grays", desc: "Minimalist aesthetic", emoji: "🤍", color: "#9ca3af",
        traits: { shirt_color: { White: 2.0, Gray: 2.0 }, shoes_color: { White: 1.5, Gray: 1.5 }, hat_color: { White: 1.5, Gray: 1.5 } } },
      { text: "Military & earth tones", desc: "Camo, olive, rugged", emoji: "🫒", color: "#4d7c0f",
        traits: { shirt_color: { Camo: 2.5, Green: 2.0 }, pants_color: { Camo: 2.5, Denim: 1.5 }, overshirt_color: { Camo: 1.5, Green: 1.5 } } },
      { text: "Loud patterns", desc: "Leopard, plaid, argyle", emoji: "🐆", color: "#d97706",
        traits: { shirt_color: { "Leopard Print": 2.5, Argyle: 2.0, "Red Plaid": 1.5 }, pants_color: { "Leopard Print": 2.0 }, overshirt_color: { Argyle: 1.5 } } },
      { text: "Sunshine yellows & greens", desc: "Bright and cheerful", emoji: "☀️", color: "#eab308",
        traits: { shirt_color: { Yellow: 2.5, Green: 2.0 }, shoes_color: { Yellow: 2.0, Green: 1.5 }, hat_color: { Yellow: 1.5, Green: 1.5 } } },
    ],
  },
  // Q5: SECONDARY COLOR
  {
    question: "And your secondary color?",
    subtitle: "For pants, shoes, accessories",
    answers: [
      { text: "Dark denim", desc: "The universal neutral", emoji: "👖", color: "#1e3a5f",
        traits: { pants_color: { Denim: 2.5, "Dark Gray": 2.0 } } },
      { text: "Classic black", desc: "Matches everything", emoji: "⬛", color: "#111",
        traits: { pants_color: { Black: 2.5 }, shoes_color: { Black: 2.0 } } },
      { text: "Bright and bold", desc: "Why blend in?", emoji: "🌈", color: "#a855f7",
        traits: { pants_color: { Red: 2.0, Purple: 2.0, Magenta: 1.5 }, shoes_color: { Red: 1.5, Purple: 1.5 } } },
      { text: "Camo / military", desc: "Rugged and tactical", emoji: "🪖", color: "#4d7c0f",
        traits: { pants_color: { Camo: 2.5, "Blue Camo": 2.0 }, shoes_color: { Green: 1.5 } } },
      { text: "White / light", desc: "Clean and fresh", emoji: "⬜", color: "#f3f4f6",
        traits: { pants_color: { White: 2.5 }, shoes_color: { White: 2.0, Gray: 1.5 } } },
      { text: "Premium patterns", desc: "Luxe, plaid, posh", emoji: "💎", color: "#b45309",
        traits: { pants_color: { Luxe: 2.5, Posh: 2.0, "Leopard Print": 1.5 }, overshirt_color: { Luxe: 1.5, Posh: 1.5 } } },
    ],
  },
  // Q6: GLASSES + HAT (superpower)
  {
    question: "What superpower would you choose?",
    subtitle: "Only one — choose wisely",
    answers: [
      { text: "X-ray vision", desc: "See through anything", emoji: "🔬",
        traits: { glasses: { "3D": 2.5, Aviators: 1.5 } } },
      { text: "Time travel", desc: "Past, future, anywhere", emoji: "⏰",
        traits: { glasses: { Specs: 2.0, Nerdy: 2.0 }, hat: { Headphones: 1.5 } } },
      { text: "Invisibility", desc: "Now you see me, now you don't", emoji: "👻",
        traits: { glasses: { Sunglasses: 2.5, Frameless: 1.5 } } },
      { text: "Super strength", desc: "Move mountains, literally", emoji: "🦾",
        traits: { hat: { Bandana: 2.5, "Backwards Cap": 1.5 }, _prefer_none: ["glasses"] } },
      { text: "Telepathy", desc: "Read every mind in the room", emoji: "🧠",
        traits: { glasses: { "Round Glasses": 2.5, Elvis: 1.5 } } },
    ],
  },
  // Q7: GLASSES (dedicated)
  {
    question: "What's your eyewear style?",
    subtitle: "Be honest — we won't judge",
    answers: [
      { text: "No glasses, perfect vision", desc: "20/20 and proud of it", emoji: "😎",
        traits: { _prefer_none: ["glasses"] } },
      { text: "I'm blind without them", desc: "Can't find my glasses without my glasses", emoji: "🫣",
        traits: { glasses: { Specs: 2.5, Nerdy: 2.0, Frameless: 1.5 } } },
      { text: "Cool shades only", desc: "Sun's always too bright", emoji: "🕶️",
        traits: { glasses: { Sunglasses: 2.5, Aviators: 2.0 } } },
      { text: "Round / retro vibes", desc: "Lennon, Potter, or just vibes", emoji: "🤓",
        traits: { glasses: { "Round Glasses": 2.5, Elvis: 2.0 } } },
      { text: "3D / futuristic", desc: "Living in 2099", emoji: "🤖",
        traits: { glasses: { "3D": 2.5 } } },
      { text: "Whatever looks good", desc: "Fashion first, function second", emoji: "✨",
        traits: { glasses: { Sunglasses: 1.0, Aviators: 1.0, "Round Glasses": 1.0, Specs: 1.0, Frameless: 1.0, Elvis: 0.5, Nerdy: 0.5, "3D": 0.5 } } },
    ],
  },
  // Q8: HAT (was Q7)
  {
    question: "Pick your headwear",
    subtitle: "What goes on top?",
    answers: [
      { text: "Baseball cap", desc: "Forward or backwards", emoji: "🧢",
        images: ["hat_cap", "hat_backwards_cap"],
        traits: { hat: { Cap: 2.5, "Backwards Cap": 2.0, "Trucker Cap": 1.5, "Snoutz Cap": 1.5 } } },
      { text: "Beanie / wool hat", desc: "Cozy and cool", emoji: "🧶",
        images: ["hat_wool_hat", "hat_bandana"],
        traits: { hat: { "Wool Hat": 2.5, Bandana: 1.5 } } },
      { text: "Headphones", desc: "Music is life", emoji: "🎧",
        images: ["hat_headphones"],
        traits: { hat: { Headphones: 3.0 } } },
      { text: "Wide brim / stylish", desc: "Making a statement", emoji: "🎩",
        images: ["hat_brimmed"],
        traits: { hat: { Brimmed: 3.0 } } },
      { text: "Nothing — let the hair speak", desc: "No hat needed", emoji: "💇",
        traits: { _prefer_none: ["hat"] } },
    ],
  },
  // Q9: DREAM JOB (overshirt + shirt)
  {
    question: "What's your dream job?",
    subtitle: "Money is no object",
    answers: [
      { text: "Rock star / DJ", desc: "Sold-out arenas, screaming fans", emoji: "🎸",
        traits: { overshirt: { "Leather Jacket": 2.5 }, shirt: { "Punk Tee": 1.5, "Skull Tee": 1.5 }, hat: { Headphones: 1.5 } } },
      { text: "CEO / Entrepreneur", desc: "Building empires, making deals", emoji: "💼",
        traits: { overshirt: { "Collar Shirt": 2.0, Trenchcoat: 2.0 }, shirt: { Suit: 2.0 } } },
      { text: "Artist / Designer", desc: "Creating beauty from nothing", emoji: "🖌️",
        traits: { overshirt: { "Jean Jacket": 2.5 }, shirt: { "Tie-dyed Tee": 1.5, "Flamingo Tee": 1.5 } } },
      { text: "Pro athlete", desc: "Competing at the highest level", emoji: "🏆",
        traits: { shirt: { "Basketball Jersey": 2.0, Jersey: 2.0, "Classic Jersey": 1.5 }, _prefer_none: ["overshirt"] } },
      { text: "Secret agent", desc: "Danger, intrigue, exotic locations", emoji: "🕵️",
        traits: { overshirt: { Trenchcoat: 2.5 }, glasses: { Sunglasses: 1.5, Aviators: 1.5 } } },
      { text: "Video game streamer", desc: "Playing games for a living", emoji: "🕹️",
        traits: { shirt: { "Invader Tee": 2.0, "Ghost Tee": 2.0, "Heart Hoodie": 1.5 }, hat: { Headphones: 2.0 } } },
    ],
  },
  // Q10: ACCESSORIES
  {
    question: "How do you accessorize?",
    subtitle: "What finishes your look",
    answers: [
      { text: "Dripping in gold", desc: "Chains, hoops, the works", emoji: "✨",
        traits: { earring: { "Gold Earrings": 2.0, "Gold Hoops": 2.0 }, necklace: { "Gold Chain": 2.5, "Gold Necklace": 2.0 } } },
      { text: "One statement piece", desc: "Less is more, but make it count", emoji: "💎",
        traits: { earring: { "Gold Earring": 2.5 }, necklace: { "Gold Necklace": 2.0 } } },
      { text: "Ink over bling", desc: "Tattoos tell my story", emoji: "🖋️",
        traits: { tattoo: { _has: 2.5 }, _prefer_none: ["earring", "necklace"] } },
      { text: "Keep it clean", desc: "No accessories needed", emoji: "🧊",
        traits: { _prefer_none: ["earring", "necklace", "tattoo"] } },
      { text: "Mix of everything", desc: "More is more — layer it on", emoji: "💫",
        traits: { earring: { "Gold Earrings": 1.5, "Gold Hoops": 1.5 }, necklace: { "Gold Chain": 1.5 }, tattoo: { _has: 1.5 } } },
    ],
  },
  // Q11: HAIRSTYLE
  {
    question: "Pick a hairstyle vibe",
    subtitle: "What energy does your hair give off?",
    answers: [
      { text: "Clean and minimal", desc: "Buzzcut, fade, no fuss", emoji: "✂️",
        images: ["hair_style_buzzcut", "hair_style_fade", "hair_style_bald"],
        traits: { hair_style: { Buzzcut: 2.0, Bald: 2.0, Fade: 1.5, Simple: 1.5 } } },
      { text: "Wild and untamed", desc: "Big energy, bigger hair", emoji: "🦁",
        images: ["hair_style_wild", "hair_style_messy", "hair_style_curly"],
        traits: { hair_style: { Wild: 2.5, Messy: 2.0, Curly: 1.5 } } },
      { text: "Sleek and styled", desc: "Put-together, polished", emoji: "💇",
        images: ["hair_style_ponytail", "hair_style_pulled_back", "hair_style_straight"],
        traits: { hair_style: { Ponytail: 2.0, "Pulled Back": 2.0, Straight: 1.5, Bob: 1.5 } } },
      { text: "Bold statement", desc: "Mohawk, half-shaved, colored", emoji: "⚡",
        images: ["hair_style_mohawk", "hair_style_fiery_mohawk", "hair_style_spiky"],
        traits: { hair_style: { Mohawk: 2.5, "Fiery Mohawk": 2.5, "Half-shaved": 2.0, Spiky: 1.5 } } },
      { text: "Classic and timeless", desc: "Never goes out of style", emoji: "👔",
        images: ["hair_style_simple", "hair_style_long"],
        traits: { hair_style: { Simple: 2.0, Long: 1.5, "High Flat Top": 1.5, "Very Long": 1.5 } } },
      { text: "Buns and updos", desc: "Pulled up and out of the way", emoji: "💫",
        images: ["hair_style_bun", "hair_style_pigtails", "hair_style_big_bangs"],
        traits: { hair_style: { Bun: 2.5, Pigtails: 2.0, "Big Bangs": 1.5, "One Side": 1.5 } } },
    ],
  },
  // Q12: HAIR COLOR
  {
    question: "What's your ideal hair color?",
    subtitle: "Natural or not — you decide",
    answers: [
      { text: "Dark / natural", desc: "Classic and understated", emoji: "🖤",
        traits: { hair_color: { Dark: 2.5, Brown: 2.0 } } },
      { text: "Blonde / light", desc: "Sun-kissed", emoji: "🌾",
        traits: { hair_color: { Blond: 2.5, Blonde: 2.5, Bleached: 2.0 } } },
      { text: "Red / auburn", desc: "Fiery and warm", emoji: "🔥",
        traits: { hair_color: { "Dyed Red": 2.5, Auburn: 2.0 } } },
      { text: "Silver / gray", desc: "Distinguished or futuristic", emoji: "🪩",
        traits: { hair_color: { Silver: 2.5 }, beard_color: { Silver: 1.5 } } },
      { text: "Wild colors", desc: "Purple, blue, rainbow", emoji: "🌈",
        traits: { hair_color: { "Purple Dye": 2.5, Blue: 2.0, "Light Blue": 2.0, Rainbow: 2.5 } } },
      { text: "No preference / bald", desc: "Hair color doesn't matter", emoji: "🧑‍🦲",
        traits: { hair_style: { Bald: 1.5 } } },
    ],
  },
  // Q13: SHOES
  {
    question: "What's your shoe game?",
    subtitle: "Footwear says a lot about a person",
    answers: [
      { text: "Sneakerhead", desc: "Fresh kicks, always", emoji: "👟",
        traits: { shoes: { Sneakers: 2.0, "Neon Sneakers": 2.0, "High Tops": 2.0 } } },
      { text: "Comfort first", desc: "Slides, sandals, easy living", emoji: "🩴",
        traits: { shoes: { Slides: 2.5, Sandals: 2.0 } } },
      { text: "Tough and rugged", desc: "Boots built to last", emoji: "🥾",
        traits: { shoes: { Workboots: 2.5, "Urban Boots": 2.0, "High Boots": 1.5 } } },
      { text: "Skater vibes", desc: "Board-ready at all times", emoji: "🛹",
        traits: { shoes: { Skater: 2.5, Canvas: 2.0 } } },
      { text: "Classic and versatile", desc: "Goes with everything", emoji: "👞",
        traits: { shoes: { Classic: 2.5, Canvas: 1.5, Running: 1.5, Basketball: 1.5 } } },
      { text: "Rare collector pieces", desc: "One-of-a-kind exclusives", emoji: "🌟",
        traits: { shoes: { "LL Alien": 2.5, "LL Moonboots": 2.5, "LL 86": 2.0, "LL RGB": 2.0, "LL Retro": 1.5 } } },
    ],
  },
  // Q14: BEARD / FACIAL
  {
    question: "Facial hair preference?",
    subtitle: "What suits your face",
    answers: [
      { text: "Clean-shaven", desc: "Smooth and polished", emoji: "✨",
        traits: { _prefer_none: ["beard"] } },
      { text: "Stubble / 5 o'clock shadow", desc: "Effortlessly cool", emoji: "😎",
        traits: { beard: { Stubble: 2.5 } } },
      { text: "Full beard", desc: "Lumberjack energy", emoji: "🧔",
        traits: { beard: { Full: 2.5, Big: 2.0 } } },
      { text: "Styled mustache", desc: "Vintage charm", emoji: "🥸",
        traits: { beard: { Mustache: 2.5, "Biker Mustache": 2.0, Muttonchops: 1.5 } } },
      { text: "Face covering", desc: "Keep some mystery", emoji: "😷",
        traits: { beard: { "Medical Mask": 3.0 } } },
    ],
  },
  // Q15: PERSONALITY (reinforces multiple categories)
  {
    question: "How would your friends describe you?",
    subtitle: "The real you, not the one on your resume",
    answers: [
      { text: "The wise one", desc: "Always has advice, always has answers", emoji: "🦉",
        traits: { beard: { Full: 1.5, Big: 1.5 }, glasses: { "Round Glasses": 1.5, Specs: 1.5 }, shirt: { "Long-sleeved": 1.0 } } },
      { text: "The rebel", desc: "Rules? What rules?", emoji: "🔥",
        traits: { overshirt: { "Leather Jacket": 2.0 }, shirt: { "Punk Tee": 1.5, "Skull Tee": 1.5 }, hair_style: { Mohawk: 1.0 } } },
      { text: "The trendsetter", desc: "Everyone copies your style", emoji: "🌊",
        traits: { hat: { Cap: 1.5, "Snoutz Cap": 1.5 }, shirt: { "Snoutz Tee": 1.5, "Snoutz Hoodie": 1.5 }, shoes: { "Neon Sneakers": 1.0 } } },
      { text: "The professional", desc: "Put-together, reliable, polished", emoji: "🎯",
        traits: { shirt: { Suit: 1.5 }, glasses: { Frameless: 1.5 }, overshirt: { "Collar Shirt": 1.5 }, beard: { Mustache: 1.0 } } },
      { text: "The free spirit", desc: "Goes wherever the wind takes them", emoji: "🌸",
        traits: { hat: { Bandana: 1.5 }, shirt: { Hawaiian: 2.0, "Tie-dyed Tee": 1.5 }, shoes: { Sandals: 1.0 }, _prefer_none: ["beard"] } },
      { text: "The mysterious one", desc: "Nobody quite knows your full story", emoji: "🌙",
        traits: { hat: { "Wool Hat": 1.5, Brimmed: 1.5 }, glasses: { Sunglasses: 2.0 }, overshirt: { Trenchcoat: 1.5 } } },
    ],
  },
  // Q16: OVERALL STYLE ARCHETYPE (reinforces multiple categories)
  {
    question: "Pick your style archetype",
    subtitle: "If you had to sum up your look in one word",
    answers: [
      { text: "Streetwear", desc: "Hoodies, sneakers, caps", emoji: "🔥",
        traits: { shirt: { Hoodie: 1.5, "Oversized Hoodie": 1.5 }, shoes: { "High Tops": 1.5, Sneakers: 1.0 }, hat: { Cap: 1.0, "Backwards Cap": 1.0 }, pants: { Trackpants: 1.0 } } },
      { text: "Formal / business", desc: "Suits, dress shoes, class", emoji: "👔",
        traits: { shirt: { Suit: 2.0, "Suit Jacket": 1.5 }, pants: { "Suit Pants": 1.5 }, shoes: { Classic: 1.5 }, overshirt: { "Collar Shirt": 1.0 } } },
      { text: "Sporty / athletic", desc: "Jerseys, leggings, performance gear", emoji: "⚽",
        traits: { shirt: { "Basketball Jersey": 1.5, Jersey: 1.5, Windbreaker: 1.0 }, pants: { "Athletic Shorts": 1.5, Leggings: 1.5 }, shoes: { Running: 1.5 } } },
      { text: "Punk / alternative", desc: "Leather, studs, dark", emoji: "🤘",
        traits: { overshirt: { "Leather Jacket": 1.5 }, shirt: { "Punk Tee": 1.5, "Skull Tee": 1.0 }, pants: { "Ripped Jeans": 1.5 }, shoes: { "Urban Boots": 1.5 } } },
      { text: "Bohemian / free", desc: "Flowy, colorful, eclectic", emoji: "🌻",
        traits: { shirt: { Hawaiian: 1.5, "Tie-dyed Tee": 1.5 }, pants: { "Cargo Pants": 1.0 }, shoes: { Sandals: 1.5, Canvas: 1.0 }, hat: { Bandana: 1.0 } } },
      { text: "Minimalist", desc: "Simple, clean, monochrome", emoji: "◻️",
        traits: { shirt: { Tee: 1.5, Lines: 1.5, "Long-sleeved": 1.0 }, pants: { "Regular Pants": 1.5 }, shoes: { Classic: 1.0, Canvas: 1.0 }, shirt_color: { White: 1.0, Black: 1.0, Gray: 1.0 } } },
    ],
  },
  // Q17: PANTS (dedicated)
  {
    question: "Pick your ideal pants",
    subtitle: "What are you wearing below the waist?",
    answers: [
      { text: "Denim / jeans", desc: "Classic and reliable", emoji: "👖",
        traits: { pants: { "Regular Pants": 2.5, "Ripped Jeans": 2.0 } } },
      { text: "Athletic shorts", desc: "Sporty and free", emoji: "🏃",
        traits: { pants: { "Athletic Shorts": 2.5, Leggings: 2.0, "Short Leggings": 1.5 } } },
      { text: "Cargo pants", desc: "Pockets for everything", emoji: "🪖",
        traits: { pants: { "Cargo Pants": 2.5 } } },
      { text: "Suit pants / slacks", desc: "Sharp and formal", emoji: "👔",
        traits: { pants: { "Suit Pants": 2.5, "Regular Pants": 1.5 } } },
      { text: "Sweats / trackpants", desc: "Comfort is king", emoji: "😴",
        traits: { pants: { Trackpants: 2.5 } } },
      { text: "Skirt / leggings", desc: "Flexible and fashionable", emoji: "💃",
        traits: { pants: { Skirt: 2.5, Leggings: 2.0 } } },
    ],
  },
  // Q18: ERA (gender signal + reinforcer)
  {
    question: "What era would you live in?",
    subtitle: "Pick your favorite decade",
    answers: [
      { text: "Roaring 1920s", desc: "Jazz, glamour, speakeasies", emoji: "🎷",
        traits: { shirt: { Suit: 1.5 }, hat: { Brimmed: 1.5 }, necklace: { "Gold Necklace": 1.0 }, beard: { Mustache: 1.0 } } },
      { text: "Groovy 1970s", desc: "Disco, bell-bottoms, flower power", emoji: "🕺",
        traits: { hair_style: { Wild: 1.5, "Very Long": 1.5 }, earring: { "Gold Hoops": 1.5 }, shirt: { Hawaiian: 1.0 }, necklace: { "Gold Chain": 1.0 } } },
      { text: "Punk 1980s", desc: "Mohawks, leather, rebellion", emoji: "🤘",
        traits: { hair_style: { Mohawk: 1.5, Spiky: 1.0 }, overshirt: { "Leather Jacket": 1.5 }, shirt: { "Punk Tee": 1.5 } } },
      { text: "Grunge 1990s", desc: "Flannel, ripped jeans, angst", emoji: "🎸",
        traits: { overshirt: { "Jean Jacket": 1.5 }, pants: { "Ripped Jeans": 1.5 }, hair_style: { Messy: 1.5, Long: 1.0 }, beard: { Stubble: 1.0 } } },
      { text: "Y2K 2000s", desc: "Low-rise, butterfly clips, bold color", emoji: "💿",
        traits: { shirt: { "Halter Top": 2.0, "Tube Top": 2.0 }, shoes: { "Neon Sneakers": 1.5 }, hair_color: { "Purple Dye": 1.0, "Light Blue": 1.0 } } },
      { text: "Far future", desc: "Cyberpunk, neon, technology", emoji: "🚀",
        traits: { type: { Robot: 1.5, Visitor: 1.0 }, glasses: { "3D": 1.5 }, shoes: { "LL Alien": 1.5, "LL Moonboots": 1.0, "LL RGB": 1.0 } } },
    ],
  },
  // Q19: MUSIC (reinforces hat, shirt, overshirt)
  {
    question: "What's your go-to music?",
    subtitle: "What's always on your playlist?",
    answers: [
      { text: "Electronic / EDM", desc: "Bass drops and light shows", emoji: "🎧",
        traits: { hat: { Headphones: 2.0 }, shirt: { Hoodie: 1.5, "Stylized Hoodie": 1.5 }, shoes: { "Neon Sneakers": 1.0 } } },
      { text: "Rock / metal", desc: "Loud guitars, louder attitude", emoji: "🤟",
        traits: { overshirt: { "Leather Jacket": 1.5 }, shirt: { "Skull Tee": 1.5, "Punk Tee": 1.0 }, shoes: { "Urban Boots": 1.5 } } },
      { text: "Hip hop / R&B", desc: "Beats, flow, style", emoji: "🎤",
        traits: { hat: { Cap: 1.5, "Backwards Cap": 1.0 }, necklace: { "Gold Chain": 1.5 }, shirt: { "Basketball Jersey": 1.0, Jersey: 1.0 } } },
      { text: "Jazz / classical", desc: "Timeless sophistication", emoji: "🎹",
        traits: { shirt: { Suit: 1.5 }, glasses: { Frameless: 1.5 }, shoes: { Classic: 1.5 } } },
      { text: "Pop", desc: "Catchy hooks, good vibes", emoji: "🎵",
        traits: { shirt: { "Heart Tee": 1.5, "Logo Tee": 1.0 }, shoes: { Sneakers: 1.0 }, shirt_color: { Magenta: 1.0, Yellow: 1.0 } } },
      { text: "Indie / folk", desc: "Acoustic, soulful, real", emoji: "🪕",
        traits: { overshirt: { "Jean Jacket": 1.5 }, hat: { Bandana: 1.5 }, shoes: { Canvas: 1.5 }, shirt: { "Tie-dyed Tee": 1.0 } } },
    ],
  },
  // Q20: VACATION (reinforces shoes, shirt, pants)
  {
    question: "Pick your ideal vacation",
    subtitle: "Where are you headed?",
    answers: [
      { text: "Beach paradise", desc: "Sand, surf, sun", emoji: "🏖️",
        traits: { shoes: { Slides: 1.5, Sandals: 1.5 }, shirt: { Hawaiian: 1.5 }, pants: { "Athletic Shorts": 1.5 } } },
      { text: "Mountain adventure", desc: "Hiking, camping, fresh air", emoji: "⛰️",
        traits: { shoes: { Workboots: 1.5, "High Boots": 1.0 }, shirt: { Windbreaker: 1.5 }, pants: { "Cargo Pants": 1.5 } } },
      { text: "City exploration", desc: "Museums, food, nightlife", emoji: "🏙️",
        traits: { shoes: { Sneakers: 1.5 }, shirt: { Tee: 1.0, "Logo Tee": 1.0 }, pants: { "Regular Pants": 1.5 } } },
      { text: "Music festival", desc: "Three days of nonstop vibes", emoji: "🎪",
        traits: { hat: { Bandana: 1.5 }, shirt: { "Tie-dyed Tee": 1.5 }, shoes: { Sandals: 1.5 }, tattoo: { _has: 1.0 } } },
      { text: "Ski resort", desc: "Powder, hot cocoa, cozy lodge", emoji: "⛷️",
        traits: { hat: { "Wool Hat": 1.5 }, shirt: { "Hoodie Up": 1.5, Windbreaker: 1.0 }, shoes: { "High Boots": 1.5 } } },
      { text: "Luxury resort", desc: "Five stars, pool, pampering", emoji: "🍸",
        traits: { shirt: { Suit: 1.5 }, shoes: { Classic: 1.5 }, pants: { "Suit Pants": 1.5 }, glasses: { Sunglasses: 1.0 } } },
    ],
  },
  // Q21: ANIMAL (reinforces type + accessories)
  {
    question: "What animal are you?",
    subtitle: "Pick your spirit animal",
    answers: [
      { text: "Lion", desc: "Proud, powerful, commanding", emoji: "🦁",
        traits: { type: { Elephant: 1.5 }, beard: { Big: 1.5, Full: 1.0 }, hair_style: { Wild: 1.5 } } },
      { text: "Owl", desc: "Wise, patient, all-seeing", emoji: "🦉",
        traits: { type: { Visitor: 1.5, Skeleton: 1.0 }, glasses: { "Round Glasses": 1.5 }, hat: { "Wool Hat": 1.0 } } },
      { text: "Wolf", desc: "Loyal, fierce, pack leader", emoji: "🐺",
        traits: { type: { Human: 1.5 }, beard: { Stubble: 1.5 }, overshirt: { "Leather Jacket": 1.0 } } },
      { text: "Chameleon", desc: "Adaptive, colorful, unique", emoji: "🦎",
        traits: { type: { Dissected: 1.5 }, glasses: { Sunglasses: 1.0 }, shirt: { "Tie-dyed Tee": 1.0 }, hair_color: { Rainbow: 1.5 } } },
      { text: "Dolphin", desc: "Playful, social, free", emoji: "🐬",
        traits: { type: { Pig: 1.5 }, pants: { "Athletic Shorts": 1.0 }, _prefer_none: ["glasses"] } },
      { text: "Fox", desc: "Clever, sleek, mysterious", emoji: "🦊",
        traits: { type: { Robot: 1.5 }, glasses: { Aviators: 1.5 }, overshirt: { Trenchcoat: 1.0 } } },
    ],
  },
];

// ─── Personality Title Generation ───────────────────────────────────────────

// Multiple adjectives per type for variety — picked by token_id hash
const TYPE_ADJECTIVES = {
  Robot: ["Calculated", "Wired", "Chrome", "Binary", "Synthetic", "Algorithmic", "Neon-lit", "Overclocked"],
  Skeleton: ["Midnight", "Hollow", "Ancient", "Spectral", "Bare-bones", "Timeless", "Undying", "Faded"],
  Visitor: ["Cosmic", "Otherworldly", "Astral", "Nebula", "Starborn", "Alien", "Interdimensional", "Lunar"],
  Elephant: ["Gentle", "Towering", "Mighty", "Stoic", "Regal", "Thundering", "Noble", "Grand"],
  Pig: ["Bold", "Brazen", "Untamed", "Fearless", "Wild-hearted", "Fiery", "Spirited", "Daring"],
  Dissected: ["Enigmatic", "Layered", "Transparent", "Deconstructed", "Exposed", "Unveiled", "Inner", "Raw"],
  Human: ["Classic", "Everyday", "Timeless", "Golden", "Natural", "Authentic", "Real", "Grounded"],
};

// Glasses → adjective override (checked first)
const GLASSES_ADJ = {
  Sunglasses: ["Mysterious", "Shielded", "Incognito", "Covert"],
  Aviators: ["Daring", "Top-Gun", "High-flying", "Fearless"],
  "3D": ["Digital", "Glitched", "Pixelated", "Virtual"],
  "Round Glasses": ["Thoughtful", "Curious", "Bookish", "Scholarly"],
  Nerdy: ["Sharp", "Clever", "Quick-witted", "Brainy"],
  Elvis: ["Retro", "Vintage", "Throwback", "Old-school"],
  Specs: ["Studious", "Focused", "Analytical", "Precise"],
  Frameless: ["Refined", "Sleek", "Understated", "Polished"],
};

// Overshirt → adjective override (checked second)
const OVERSHIRT_ADJ = {
  "Leather Jacket": ["Rebel", "Untouchable", "Road-worn", "Defiant"],
  Trenchcoat: ["Suave", "Shadowy", "Film-noir", "Elusive"],
  "Jean Jacket": ["Free-spirited", "Dusty", "Roaming", "Faded"],
  "Athletic Jacket": ["Dynamic", "Driven", "Energized", "Swift"],
  "Collar Shirt": ["Polished", "Buttoned-up", "Crisp", "Distinguished"],
};

// Hat → adjective override (checked third)
const HAT_ADJ = {
  Headphones: ["Sonic", "Tuned-in", "Bassline", "Frequency"],
  Bandana: ["Rugged", "Gritty", "Outlaw", "Weathered"],
  "Wool Hat": ["Wandering", "Nomadic", "Cozy", "Chill"],
  Brimmed: ["Shaded", "Noir", "Dapper", "Wide-brimmed"],
  Cap: ["Street", "Downtown", "Urban", "Fresh"],
  "Backwards Cap": ["Laid-back", "Carefree", "Easygoing", "Chill"],
  "Trucker Cap": ["Roadside", "Highway", "Open-road", "Country"],
  "Snoutz Cap": ["Underground", "Rare", "Collector's", "Exclusive"],
};

// Hair → adjective fallback (checked fourth)
const HAIR_ADJ = {
  Mohawk: ["Punk", "Defiant", "Electric", "Razor-edged"],
  Wild: ["Untamed", "Feral", "Windswept", "Chaotic"],
  Spiky: ["Edgy", "Charged", "Wired", "Jagged"],
  Messy: ["Bedhead", "Effortless", "Careless", "Reckless"],
  Bald: ["Clean", "Streamlined", "Bare", "Stripped-down"],
  Buzzcut: ["Military", "Tight", "No-nonsense", "Disciplined"],
  Bun: ["Zen", "Centered", "Poised", "Composed"],
  Pigtails: ["Playful", "Spirited", "Peppy", "Bouncy"],
};

// Beard → adjective fallback (checked fifth)
const BEARD_ADJ = {
  Full: ["Bearded", "Lumberjack", "Burly", "Seasoned"],
  Big: ["Grizzled", "Mighty-bearded", "Mountain-man", "Bearish"],
  Stubble: ["Scruffy", "Five-o'clock", "Rough-cut", "Rugged"],
  Mustache: ["Dapper", "Old-timey", "Handlebar", "Debonair"],
  "Biker Mustache": ["Iron-steed", "Road-warrior", "Chrome", "Outlaw"],
  Muttonchops: ["Victorian", "Sideburned", "Period-piece", "Olde"],
  "Medical Mask": ["Masked", "Anonymous", "Hidden", "Veiled"],
};

// Shirt → noun (primary)
const SHIRT_NOUNS = {
  Hoodie: ["Dreamer", "Drifter", "Night Owl", "Homebody"],
  "Oversized Hoodie": ["Lounger", "Couch King", "Comfort Seeker", "Hibernator"],
  "Hoodie Up": ["Shadow", "Phantom", "Ghost", "Lurker"],
  "Skull Tee": ["Rebel", "Renegade", "Dark Horse", "Outcast"],
  "Punk Tee": ["Anarchist", "Disruptor", "Provocateur", "Agitator"],
  "Invader Tee": ["Gamer", "Pixel Warrior", "Arcade Rat", "High Scorer"],
  "Ghost Tee": ["Phantom", "Specter", "Wraith", "Haunt"],
  Suit: ["Executive", "Power Broker", "Kingpin", "Strategist"],
  "Suit Jacket": ["Boss", "Commander", "Director", "Mogul"],
  Tee: ["Original", "Purist", "Everyday Hero", "Blank Slate"],
  "Logo Tee": ["Influencer", "Brand Ambassador", "Hype Beast", "Tastemaker"],
  Hawaiian: ["Nomad", "Island Hopper", "Beach Bum", "Wanderer"],
  "Tie-dyed Tee": ["Artist", "Free Soul", "Cosmic Painter", "Psychonaut"],
  "Flamingo Tee": ["Dreamer", "Tropicalist", "Sunset Chaser", "Flamingo Kid"],
  "Basketball Jersey": ["Champion", "Baller", "Court King", "All-Star"],
  Jersey: ["Athlete", "Team Captain", "Competitor", "Contender"],
  "Classic Jersey": ["MVP", "Franchise Player", "Legend", "Hall of Famer"],
  Windbreaker: ["Explorer", "Storm Chaser", "Trailblazer", "Pathfinder"],
  "Long-sleeved": ["Thinker", "Philosopher", "Observer", "Deep Diver"],
  "Bare Chest": ["Titan", "Gladiator", "Brawler", "Force of Nature"],
  "Heart Hoodie": ["Romantic", "Softie", "Lover", "Heartfelt"],
  "Heart Tee": ["Romantic", "Sweetheart", "Tender Soul", "Lovebird"],
  "CGA Shirt": ["Pixel Pioneer", "Retro Coder", "Old-school Hacker", "8-Bit Legend"],
  "Meepet Tee": ["Collector", "Curator", "Archivist", "Keeper"],
  "Halter Top": ["Trendsetter", "Scene Stealer", "Head Turner", "Fashion Icon"],
  "Tube Top": ["Showstopper", "Spotlight Lover", "Diva", "Star"],
  "Diagonal Tee": ["Maverick", "Off-center", "Sidewinder", "Nonconformist"],
  Lines: ["Minimalist", "Clean Liner", "Purist", "Simplicity Seeker"],
  "Stylized Hoodie": ["Visionary", "Futurist", "Avant-Gardist", "Trailblazer"],
  "Snoutz Tee": ["Insider", "OG", "Inner Circle", "Core Member"],
  "Snoutz Hoodie": ["Insider", "Day-One", "True Believer", "Loyalist"],
  "Snoutz Skull Tee": ["Dark Insider", "Shadow Member", "Night Council", "Vault Keeper"],
  "Glyph Shirt": ["Cryptic", "Code Breaker", "Cipher", "Hieroglyphist"],
};

// Shoes → noun fallback (if no shirt match)
const SHOES_NOUNS = {
  Sneakers: ["Pacer", "Street Runner", "Hustler"],
  "Neon Sneakers": ["Rave Runner", "Neon Flash", "Light Trail"],
  "High Tops": ["Court Rat", "Lace-up Legend", "Top Stepper"],
  Slides: ["Easy Rider", "Smooth Operator", "Glider"],
  Sandals: ["Beach Walker", "Sandy Soul", "Coastal Drifter"],
  Workboots: ["Groundbreaker", "Builder", "Foundation Layer"],
  "High Boots": ["Ranger", "Outrider", "Frontier Walker"],
  "Urban Boots": ["City Stomper", "Concrete Crusher", "Pavement Pounder"],
  Classic: ["Gentleman", "Old Soul", "Timekeeper"],
  Canvas: ["Indie Walker", "Low-key Legend", "Sidewalk Surfer"],
  Skater: ["Board Rider", "Kickflipper", "Rail Grinder"],
  "LL Alien": ["Starwalker", "Galaxy Hopper", "Void Strider"],
  "LL Moonboots": ["Moonwalker", "Zero-G Drifter", "Lunar Stepper"],
  "LL 86": ["Time Traveler", "Retro Futurist", "Flux Rider"],
  "LL RGB": ["Chromatic", "Spectrum Walker", "Light Bender"],
  "LL Retro": ["Throwback", "Vintage Soul", "Classic Futurist"],
  Running: ["Pacer", "Endurance", "Long Hauler"],
  Basketball: ["Court General", "Fast Breaker", "Triple Threat"],
};

// Pants → noun fallback (if no shirt or shoes match)
const PANTS_NOUNS = {
  "Suit Pants": ["Professional", "Corner Office", "Power Player"],
  "Ripped Jeans": ["Punk", "Road Warrior", "Street Poet"],
  "Cargo Pants": ["Utility Belt", "Pocket King", "Prepared-for-Anything"],
  Trackpants: ["Jogger", "Track Star", "Comfortable King"],
  "Athletic Shorts": ["Gym Rat", "Weekend Warrior", "Active Soul"],
  Skirt: ["Style Maven", "Bold Stepper", "Trend Rider"],
  Leggings: ["Flex", "Contour", "Agile Spirit"],
  "Regular Pants": ["Everyman", "Steady Hand", "Reliable One"],
};

// Big fallback pool — used when nothing else matches
const NOUN_FALLBACK = [
  "Maverick", "Trailblazer", "Enigma", "Icon", "Legend",
  "Outsider", "Visionary", "Wanderer", "Pioneer", "Spirit",
  "Wildcard", "Rogue", "Sage", "Architect", "Catalyst",
  "Alchemist", "Sentinel", "Nomad", "Oracle", "Prodigy",
  "Virtuoso", "Phoenix", "Vanguard", "Harbinger", "Luminary",
];

const TYPE_DESCRIPTIONS = {
  Human: "You blend into any crowd but stand out in your own way.",
  Pig: "You have a playful, carefree energy that's impossible to resist.",
  Elephant: "You carry a quiet strength and wisdom that others can sense.",
  Robot: "Your mind is a machine — precise, logical, and always optimizing.",
  Skeleton: "There's a timeless, stripped-down authenticity to your vibe.",
  Visitor: "You exist between worlds — familiar yet completely alien.",
  Dissected: "You see through every layer. Nothing is hidden from you.",
};

function pick(arr, id) { return arr[id % arr.length]; }

function generateTitle(meebit, offset) {
  const s = offset || 0;
  const id = meebit.token_id;

  // --- Adjective: cascade through trait layers, pick from arrays for variety ---
  let adj;
  if (meebit.glasses && GLASSES_ADJ[meebit.glasses]) {
    adj = pick(GLASSES_ADJ[meebit.glasses], id + s);
  } else if (meebit.overshirt && OVERSHIRT_ADJ[meebit.overshirt]) {
    adj = pick(OVERSHIRT_ADJ[meebit.overshirt], id + s);
  } else if (meebit.hat && HAT_ADJ[meebit.hat]) {
    adj = pick(HAT_ADJ[meebit.hat], id + s);
  } else if (meebit.hair_style && HAIR_ADJ[meebit.hair_style]) {
    adj = pick(HAIR_ADJ[meebit.hair_style], id + s);
  } else if (meebit.beard && BEARD_ADJ[meebit.beard]) {
    adj = pick(BEARD_ADJ[meebit.beard], id + s);
  } else {
    const pool = TYPE_ADJECTIVES[meebit.type] || ["Unique"];
    adj = pick(pool, id + s);
  }

  // --- Noun: cascade shirt → shoes → pants → fallback ---
  let noun;
  if (meebit.shirt && SHIRT_NOUNS[meebit.shirt]) {
    noun = pick(SHIRT_NOUNS[meebit.shirt], id + 7 + s);
  } else if (meebit.shoes && SHOES_NOUNS[meebit.shoes]) {
    noun = pick(SHOES_NOUNS[meebit.shoes], id + 7 + s);
  } else if (meebit.pants && PANTS_NOUNS[meebit.pants]) {
    noun = pick(PANTS_NOUNS[meebit.pants], id + 7 + s);
  } else {
    noun = pick(NOUN_FALLBACK, id + 7 + s);
  }

  return `The ${adj} ${noun}`;
}

// Generate unique titles for a set of results — retries with offsets to avoid duplicates
function generateUniqueTitles(results) {
  const titles = {};
  for (const entry of results) {
    const id = entry.meebit.token_id;
    let title = generateTitle(entry.meebit, 0);
    let attempt = 1;
    while (Object.values(titles).includes(title) && attempt < 20) {
      title = generateTitle(entry.meebit, attempt * 3);
      attempt++;
    }
    // Last resort: append the token_id fragment to guarantee uniqueness
    if (Object.values(titles).includes(title)) {
      title = `${title} #${id}`;
    }
    titles[id] = title;
  }
  return titles;
}

const SHIRT_DESCS = {
  Hoodie: "Comfort is your secret weapon — you perform best when you feel at ease.",
  Suit: "You dress to impress and it shows in everything you do.",
  Jacket: "You dress to impress and it shows in everything you do.",
  Jersey: "You're a team player with a competitive streak a mile wide.",
  Tee: "You keep things casual but your vibe speaks volumes.",
};

const GLASSES_DESCS = {
  Specs: "You see the world through a sharper lens than most.",
  Frameless: "You notice what others miss — details are your superpower.",
  "3D Glasses": "You experience life in an extra dimension nobody else can see.",
  Eyepatch: "There's a story behind that look, and people want to hear it.",
  VR: "You live half in this world and half in the next one.",
};

const HAT_DESCS = {
  "Baseball Cap": "You keep it real — no pretense, just good vibes.",
  Beanie: "You've got a cozy soul that puts everyone around you at ease.",
  "Top Hat": "There's a flair for the dramatic in everything you do.",
  Headphones: "Music runs through your veins and sets the rhythm of your life.",
  "Wool Hat": "You're grounded and practical, but never boring.",
  Bandana: "You march to your own beat and wouldn't have it any other way.",
};

const OVERSHIRT_DESCS = {
  "Leather Jacket": "There's an edge to you that keeps people intrigued.",
  "Collar Shirt": "You balance polish and personality effortlessly.",
  "Athletic Jacket": "You bring energy and drive to everything you touch.",
  "Down Jacket": "You're built for any weather life throws your way.",
  Cardigan: "You've got a warm, thoughtful energy that draws people in.",
};

function generateDescription(meebit) {
  const typeDesc = TYPE_DESCRIPTIONS[meebit.type] || "";
  const parts = [typeDesc];

  // Shirt description
  if (meebit.shirt) {
    const s = meebit.shirt;
    const key = Object.keys(SHIRT_DESCS).find((k) => s.includes(k));
    if (key) parts.push(SHIRT_DESCS[key]);
    else parts.push("Your style is uniquely yours — impossible to put in a box.");
  }

  // Add a third sentence based on the most distinctive accessory
  if (meebit.glasses && GLASSES_DESCS[meebit.glasses]) {
    parts.push(GLASSES_DESCS[meebit.glasses]);
  } else if (meebit.hat && HAT_DESCS[meebit.hat]) {
    parts.push(HAT_DESCS[meebit.hat]);
  } else if (meebit.overshirt && OVERSHIRT_DESCS[meebit.overshirt]) {
    parts.push(OVERSHIRT_DESCS[meebit.overshirt]);
  } else if (meebit.beard) {
    parts.push("You carry a rugged confidence that commands respect.");
  } else if (meebit.necklace) {
    parts.push("You know that the right details make all the difference.");
  } else if (meebit.earring) {
    parts.push("You've got a bold streak that keeps things interesting.");
  }

  return parts.join(" ");
}

// ─── Matching Engine ────────────────────────────────────────────────────────

function buildTraitProfile(answers) {
  const profile = {};
  const preferNone = new Set();

  for (let i = 0; i < answers.length; i++) {
    const answerIdx = answers[i];
    if (answerIdx == null) continue;
    const q = QUESTIONS[i];
    const a = q.answers[answerIdx];
    if (!a || !a.traits) continue;

    for (const [cat, vals] of Object.entries(a.traits)) {
      if (cat === "_prefer_none") {
        for (const c of vals) preferNone.add(c);
        continue;
      }
      if (!profile[cat]) profile[cat] = {};
      for (const [val, weight] of Object.entries(vals)) {
        profile[cat][val] = (profile[cat][val] || 0) + weight;
      }
    }
  }

  return { profile, preferNone };
}

function scoreMeebit(meebit, profile, preferNone) {
  let score = 0;
  let maxPossible = 0;

  const traitCats = [
    "hair_style", "hair_color", "hat", "hat_color",
    "beard", "beard_color", "glasses", "glasses_color",
    "earring", "necklace", "shirt", "shirt_color",
    "overshirt", "overshirt_color", "pants", "pants_color",
    "shoes", "shoes_color",
  ];

  // Type scoring — use a fixed importance, no extreme rarity multiplier in denominator
  const typePrefs = profile.type || {};
  if (Object.keys(typePrefs).length > 0) {
    const typeImportance = CATEGORY_IMPORTANCE.type;
    // Score: how well does this meebit's type match preferences?
    // Use moderate boost for rare types (not in denominator)
    const rareBoost = { Human: 1.0, Pig: 2.0, Elephant: 3.0, Robot: 4.0, Skeleton: 5.0, Visitor: 6.0, Dissected: 8.0 };
    const rawTypeScore = (typePrefs[meebit.type] || 0) * (rareBoost[meebit.type] || 1);
    const maxRawType = Math.max(...Object.entries(typePrefs).map(([t, w]) => w * (rareBoost[t] || 1)));
    score += (rawTypeScore / Math.max(maxRawType, 1)) * typeImportance;
    maxPossible += typeImportance;
  }

  // Trait scoring
  for (const cat of traitCats) {
    const importance = CATEGORY_IMPORTANCE[cat] || 1.0;
    const meebitVal = meebit[cat] || null;

    // Prefer none
    if (preferNone.has(cat)) {
      if (!meebitVal) {
        score += importance;
      }
      maxPossible += importance;
      continue;
    }

    const prefs = profile[cat];
    if (!prefs || Object.keys(prefs).length === 0) continue;

    // Special: tattoo _has key
    if (cat === "tattoo" && prefs._has) {
      if (meebitVal) {
        score += importance;
      }
      maxPossible += importance;
      continue;
    }

    // Normal trait matching: get the best weight the user expressed for this category
    const maxWeight = Math.max(...Object.values(prefs));
    if (meebitVal && prefs[meebitVal]) {
      // Proportional credit: if user gave weight 2.5 to this value and max is 2.5, full credit
      score += (prefs[meebitVal] / maxWeight) * importance;
    }
    maxPossible += importance;
  }

  return maxPossible > 0 ? (score / maxPossible) * 100 : 50;
}

function rankMeebits(database, answers) {
  const { profile, preferNone } = buildTraitProfile(answers);

  const scored = database.map((m) => ({
    meebit: m,
    score: scoreMeebit(m, profile, preferNone),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Diversify: max 1 per type+shirt+pants+shoes archetype for variety
  const seen = {};
  const results = [];
  for (const entry of scored) {
    if (results.length >= 6) break;
    const key = `${entry.meebit.type}|${entry.meebit.shirt}|${entry.meebit.pants}|${entry.meebit.shoes}`;
    if (!seen[key]) {
      seen[key] = true;
      results.push(entry);
    }
  }

  return { results, profile, preferNone };
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function QuizIntro({ onStart, dbLoaded }) {
  return React.createElement("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", padding: 40,
      textAlign: "center", position: "relative",
    },
  },
    React.createElement(MeebitCarousel, {
      size: 320, className: "mm-intro-icon",
      animation: "float 3s ease-in-out infinite",
    }),
    React.createElement("h1", {
      className: "mm-intro-title",
      style: {
        fontSize: 52, fontWeight: 900,
        letterSpacing: "-2px", marginBottom: 12,
        background: "linear-gradient(135deg, #a855f7, #7c3aed, #6d28d9)",
        WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        filter: "drop-shadow(0 0 20px rgba(124, 58, 237, 0.3))",
      },
    }, "Meebit Match"),
    React.createElement("p", {
      className: "mm-intro-desc",
      style: {
        fontSize: 18, color: "#8b8ba3", maxWidth: 480,
        lineHeight: 1.7, marginBottom: 48, padding: "0 16px",
      },
    }, "Answer 21 personality questions and we'll match you with your Meebit soulmate from a collection of 20,000 unique characters."),
    React.createElement("button", {
      className: "mm-intro-btn",
      onClick: onStart,
      disabled: !dbLoaded,
      style: {
        padding: "18px 56px", fontSize: 18, fontWeight: 700,
        border: "1px solid rgba(124, 58, 237, 0.3)", borderRadius: 16,
        background: dbLoaded ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "#2a2a3e",
        color: "#fff", cursor: dbLoaded ? "pointer" : "wait",
        boxShadow: dbLoaded ? "0 0 40px rgba(124, 58, 237, 0.4), 0 4px 20px rgba(0,0,0,0.3)" : "none",
        transition: "all 0.3s ease",
      },
    }, dbLoaded ? "Find My Match" : "Loading 20,000 Meebits..."),
  );
}

function QuizProgress({ current, total }) {
  const pct = (current / total) * 100;
  return React.createElement("div", { style: { marginBottom: 32 } },
    React.createElement("div", {
      style: { display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13, color: "#6b6b8a", fontWeight: 600 },
    },
      React.createElement("span", null, `Question ${current + 1} of ${total}`),
      React.createElement("span", null, `${Math.round(pct)}%`),
    ),
    React.createElement("div", {
      style: { height: 4, background: "#1a1a2e", borderRadius: 2, overflow: "hidden" },
    },
      React.createElement("div", {
        style: {
          height: "100%", width: `${pct}%`,
          background: "linear-gradient(90deg, #7c3aed, #a855f7, #c084fc)",
          borderRadius: 2, transition: "width 0.3s ease",
          boxShadow: "0 0 12px rgba(124, 58, 237, 0.5)",
        },
      }),
    ),
  );
}

function QuizQuestion({ question, onAnswer, onBack, canGoBack, selectedAnswer }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [clickedIdx, setClickedIdx] = useState(null);

  const handleClick = (idx) => {
    setClickedIdx(idx);
    setTimeout(() => {
      onAnswer(idx);
      setClickedIdx(null);
    }, 300);
  };

  return React.createElement("div", null,
    React.createElement("div", { style: { marginBottom: 32 } },
      React.createElement("h2", {
        className: "mm-q-title",
        style: { fontSize: 28, fontWeight: 800, color: "#e2e2f0", letterSpacing: "-0.5px", marginBottom: 8 },
      }, question.question),
      question.subtitle
        ? React.createElement("p", { style: { fontSize: 15, color: "#6b6b8a" } }, question.subtitle)
        : null,
    ),
    React.createElement("div", {
      className: "mm-answer-grid",
      style: {
        display: "grid",
        gridTemplateColumns: question.answers.length <= 4 ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
        gap: 12, marginBottom: 24,
      },
    },
      ...question.answers.map((answer, idx) => {
        const isSelected = selectedAnswer === idx;
        const isClicked = clickedIdx === idx;
        const isHovered = hoveredIdx === idx;

        return React.createElement("button", {
          key: idx,
          className: "mm-answer-btn",
          onClick: () => handleClick(idx),
          onMouseEnter: () => setHoveredIdx(idx),
          onMouseLeave: () => setHoveredIdx(null),
          style: {
            padding: "20px 16px",
            border: isSelected ? "1px solid rgba(124, 58, 237, 0.6)" : isClicked ? "1px solid rgba(168, 85, 247, 0.5)" : "1px solid rgba(255,255,255,0.06)",
            borderRadius: 16,
            background: isClicked ? "rgba(124, 58, 237, 0.15)" : isSelected ? "rgba(124, 58, 237, 0.1)" : isHovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
            cursor: "pointer", textAlign: "center",
            transition: "all 0.2s",
            transform: isClicked ? "scale(0.97)" : isHovered ? "translateY(-2px)" : "none",
            boxShadow: isSelected ? "0 0 20px rgba(124, 58, 237, 0.2)" : isHovered ? "0 8px 24px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.2)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            backdropFilter: "blur(10px)",
          },
        },
          React.createElement("div", { className: "mm-answer-emoji", style: { fontSize: 32 } }, answer.emoji),
          answer.color
            ? React.createElement("div", { style: { width: 40, height: 8, borderRadius: 4, background: answer.color, boxShadow: `0 0 10px ${answer.color}40` } })
            : null,
          answer.images
            ? React.createElement("div", { style: { display: "flex", gap: 4, justifyContent: "center" } },
                ...answer.images.map(img =>
                  React.createElement("img", {
                    key: img, src: `/traits/${img}.webp`, alt: "",
                    style: { width: 28, height: 28, borderRadius: 4, objectFit: "cover" },
                    onError: (e) => { e.target.style.display = "none"; },
                  })
                ),
              )
            : null,
          React.createElement("div", { className: "mm-answer-text", style: { fontSize: 15, fontWeight: 700, color: "#e2e2f0" } }, answer.text),
          React.createElement("div", { className: "mm-answer-desc", style: { fontSize: 12, color: "#6b6b8a", lineHeight: 1.3 } }, answer.desc),
        );
      }),
    ),
    canGoBack
      ? React.createElement("button", {
          onClick: onBack,
          style: {
            padding: "8px 20px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8,
            background: "rgba(255,255,255,0.04)", color: "#8b8ba3", cursor: "pointer", fontSize: 13, fontWeight: 500,
            backdropFilter: "blur(10px)",
          },
        }, "\u2190 Back")
      : null,
  );
}

function CalculatingScreen() {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const timer = setInterval(() => { setDots((d) => d.length >= 3 ? "" : d + "."); }, 400);
    return () => clearInterval(timer);
  }, []);

  return React.createElement("div", {
    style: {
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "60vh", textAlign: "center",
    },
  },
    React.createElement(MeebitCarousel, {
      size: 320, className: "mm-calc-icon",
      animation: "pulse 1.5s ease-in-out infinite",
    }),
    React.createElement("style", null, `
      @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.15); opacity: 0.8; } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-12px); } }
      @keyframes orbMove1 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(30px, -40px) scale(1.1); } }
      @keyframes orbMove2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-40px, 30px) scale(0.9); } }
      @keyframes orbMove3 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(20px, 20px) scale(1.05); } }

      /* ── Mobile Responsive ────────────────────────── */
      @media (max-width: 640px) {
        .mm-intro-title { font-size: 36px !important; letter-spacing: -1px !important; }
        .mm-intro-desc { font-size: 15px !important; margin-bottom: 32px !important; }
        .mm-intro-btn { padding: 16px 36px !important; font-size: 16px !important; }
        .mm-intro-icon { width: 100px !important; height: 100px !important; }
        .mm-q-title { font-size: 22px !important; }
        .mm-answer-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 8px !important; }
        .mm-answer-btn { padding: 14px 10px !important; }
        .mm-answer-emoji { font-size: 26px !important; }
        .mm-answer-text { font-size: 13px !important; }
        .mm-answer-desc { font-size: 11px !important; }
        .mm-result-inner { flex-direction: column !important; text-align: center !important; }
        .mm-result-card { padding: 20px !important; }
        .mm-result-info { align-items: center !important; }
        .mm-result-score { font-size: 28px !important; margin-top: 8px !important; position: static !important; }
        .mm-result-title { font-size: 20px !important; }
        .mm-result-header { font-size: 28px !important; }
        .mm-result-desc { max-width: 100% !important; text-align: center !important; }
        .mm-trait-wrap { justify-content: center !important; }
        .mm-result-link { justify-content: center !important; }
        .mm-calc-title { font-size: 20px !important; }
        .mm-calc-icon { width: 100px !important; height: 100px !important; }
      }
      @media (max-width: 380px) {
        .mm-answer-grid { grid-template-columns: 1fr 1fr !important; }
        .mm-intro-title { font-size: 30px !important; }
      }
    `),
    React.createElement("h2", {
      className: "mm-calc-title",
      style: { fontSize: 24, fontWeight: 800, color: "#e2e2f0", marginBottom: 8 },
    }, `Scanning 20,000 Meebits${dots}`),
    React.createElement("p", { style: { fontSize: 15, color: "#6b6b8a" } }, "Finding your perfect match"),
  );
}

function TraitChip({ cat, value, matched }) {
  const imgSlug = toImageSlug(cat, value);
  return React.createElement("div", {
    style: {
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px 4px 4px",
      background: matched ? "rgba(34, 197, 94, 0.12)" : "rgba(124, 58, 237, 0.1)",
      borderRadius: 20, fontSize: 12,
      color: matched ? "#4ade80" : "#a78bfa",
      border: matched ? "1px solid rgba(34, 197, 94, 0.2)" : "1px solid rgba(124, 58, 237, 0.15)",
    },
  },
    React.createElement("img", {
      src: `/traits/${imgSlug}.webp`, alt: "",
      style: { width: 22, height: 22, borderRadius: 4, objectFit: "cover" },
      onError: (e) => { e.target.style.display = "none"; },
    }),
    React.createElement("span", { style: { fontWeight: 600 } }, CATEGORY_LABELS[cat] || cat),
    React.createElement("span", null, formatName(value)),
  );
}

const CAROUSEL_MEEBITS = ["/traits/type_visitor.webp", "/traits/type_pig.webp", "/traits/type_robot.webp"];

function MeebitCarousel({ size, animation, className }) {
  const [index, setIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % CAROUSEL_MEEBITS.length);
        setFade(true);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return React.createElement("img", {
    className,
    src: CAROUSEL_MEEBITS[index],
    alt: "Meebit",
    style: {
      width: size, height: size, marginBottom: 24,
      borderRadius: 16, objectFit: "cover",
      animation,
      opacity: fade ? 1 : 0,
      transition: "opacity 0.3s ease",
    },
  });
}

function MeebitImage({ tokenId, width, height }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retries, setRetries] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    if (error && retries < maxRetries) {
      const timer = setTimeout(() => {
        setError(false);
        setLoaded(false);
        setRetries((r) => r + 1);
      }, 1500 * (retries + 1));
      return () => clearTimeout(timer);
    }
  }, [error, retries]);

  const imgSrc = MEEBIT_IMG(tokenId) + (retries > 0 ? `&_r=${retries}` : "");

  return React.createElement("div", {
    style: {
      width, height, borderRadius: 16,
      overflow: "hidden", background: "rgba(124, 58, 237, 0.08)",
      flexShrink: 0, position: "relative",
      border: "1px solid rgba(124, 58, 237, 0.12)",
    },
  },
    !error
      ? React.createElement("img", {
          src: imgSrc,
          alt: `Meebit #${tokenId}`,
          onLoad: () => setLoaded(true),
          onError: () => setError(true),
          style: {
            width: "100%", height: "100%", objectFit: "contain",
            opacity: loaded ? 1 : 0, transition: "opacity 0.3s",
          },
        })
      : null,
    (!loaded || error)
      ? React.createElement("div", {
          style: {
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: width > 100 ? 48 : 24, color: "#4a4a6a",
          },
        }, error && retries >= maxRetries ? "?" : "...")
      : null,
  );
}

function ResultCard({ entry, rank, profile, title: titleProp }) {
  const { meebit, score } = entry;
  const title = titleProp || generateTitle(meebit, 0);
  const desc = generateDescription(meebit);
  const isHero = rank === 0;

  const traitCats = [
    "hair_style", "hair_color", "hat", "hat_color",
    "beard", "glasses", "earring", "necklace",
    "shirt", "shirt_color", "overshirt", "overshirt_color",
    "pants", "pants_color", "shoes", "shoes_color",
  ];
  const traits = traitCats.filter((c) => meebit[c]);

  // Check which traits matched the user's profile
  const matchedCats = new Set();
  if (profile) {
    for (const cat of traits) {
      const prefs = profile[cat];
      if (prefs && meebit[cat] && prefs[meebit[cat]]) {
        matchedCats.add(cat);
      }
    }
  }

  return React.createElement("div", {
    className: "mm-result-card",
    style: {
      background: isHero ? "linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(168, 85, 247, 0.08))" : "rgba(255,255,255,0.03)",
      borderRadius: 20,
      border: isHero ? "1px solid rgba(124, 58, 237, 0.3)" : "1px solid rgba(255,255,255,0.06)",
      padding: 32,
      marginBottom: 16,
      animation: "fadeUp 0.4s ease-out",
      boxShadow: isHero ? "0 0 40px rgba(124, 58, 237, 0.15), inset 0 1px 0 rgba(255,255,255,0.05)" : "inset 0 1px 0 rgba(255,255,255,0.03)",
      backdropFilter: "blur(10px)",
    },
  },
    // Top section: image + info + score
    React.createElement("div", {
      className: "mm-result-inner",
      style: { display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 20, position: "relative" },
    },
      // Meebit image
      React.createElement(MeebitImage, {
        tokenId: meebit.token_id,
        width: 130,
        height: 200,
      }),
      // Info
      React.createElement("div", { className: "mm-result-info", style: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" } },
        // Badge + Score row
        React.createElement("div", {
          style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
        },
          isHero
            ? React.createElement("div", {
                style: { fontSize: 12, fontWeight: 700, color: "#a855f7", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 },
              }, "Your #1 Match")
            : React.createElement("div", {
                style: { fontSize: 12, fontWeight: 700, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 },
              }, `Match #${rank + 1}`),
          // Score
          React.createElement("div", {
            className: "mm-result-score",
            style: {
              fontSize: 36, fontWeight: 900, flexShrink: 0,
              background: "linear-gradient(135deg, #a855f7, #c084fc)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 8px rgba(168, 85, 247, 0.3))",
            },
          }, `${Math.round(score)}%`),
        ),
        React.createElement("div", {
          className: "mm-result-title",
          style: { fontSize: 24, fontWeight: 800, color: "#e2e2f0", letterSpacing: "-0.5px" },
        }, title),
        React.createElement("div", {
          style: { fontSize: 14, color: "#6b6b8a", marginTop: 2 },
        }, `Meebit #${meebit.token_id.toLocaleString()} \u00b7 ${meebit.type}${meebit.gender ? ` \u00b7 ${formatName(meebit.gender)}` : ""}`),
        // Profile link
        React.createElement("a", {
          className: "mm-result-link",
          href: `https://meebits.com/collection/${meebit.token_id}`,
          target: "_blank",
          rel: "noopener noreferrer",
          style: {
            fontSize: 13, color: "#a78bfa", fontWeight: 600,
            textDecoration: "none", display: "inline-flex",
            alignItems: "center", gap: 4, marginTop: 4,
          },
        }, "View on Meebits.com \u2197"),
      ),
    ),
    // Description — full width below the image+info row
    React.createElement("p", {
      className: "mm-result-desc",
      style: { fontSize: 14, color: "#c8c8d8", lineHeight: 1.6, marginTop: 0, marginBottom: 16 },
    }, desc),
    // Traits
    React.createElement("div", {
      className: "mm-trait-wrap",
      style: { display: "flex", flexWrap: "wrap", gap: 6 },
    },
      ...traits.map((cat) =>
        React.createElement(TraitChip, {
          key: cat, cat, value: meebit[cat],
          matched: matchedCats.has(cat),
        })
      ),
    ),
  );
}

function ResultsPage({ results, profile, onRestart }) {
  if (!results || results.length === 0) return null;
  const titles = generateUniqueTitles(results);
  const hero = results[0];
  const runners = results.slice(1);
  return React.createElement("div", { style: { animation: "fadeUp 0.5s ease-out" } },
    React.createElement("div", { style: { textAlign: "center", marginBottom: 32 } },
      React.createElement("div", { style: { fontSize: 48, marginBottom: 8, filter: "drop-shadow(0 0 20px rgba(168, 85, 247, 0.4))" } }, "✨"),
      React.createElement("h2", {
        className: "mm-result-header",
        style: {
          fontSize: 32, fontWeight: 900, letterSpacing: "-0.5px", marginBottom: 8,
          background: "linear-gradient(135deg, #a855f7, #c084fc)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        },
      }, "Your Meebit Match"),
      React.createElement("p", {
        style: { fontSize: 15, color: "#6b6b8a" },
      }, `We searched 20,000 Meebits and found your perfect match${results.length > 1 ? "es" : ""}`),
    ),
    React.createElement(ResultCard, { entry: hero, rank: 0, profile, title: titles[hero.meebit.token_id] }),
    runners.length > 0
      ? React.createElement("div", null,
          React.createElement("h3", {
            style: { fontSize: 14, fontWeight: 700, color: "#6b6b8a", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, marginTop: 32 },
          }, "Other Strong Matches"),
          ...runners.map((entry, i) =>
            React.createElement(ResultCard, { key: entry.meebit.token_id, entry, rank: i + 1, profile, title: titles[entry.meebit.token_id] })
          ),
        )
      : null,
    React.createElement("div", { style: { textAlign: "center", marginTop: 40, marginBottom: 40 } },
      React.createElement("button", {
        onClick: onRestart,
        style: {
          padding: "14px 40px", fontSize: 16, fontWeight: 700,
          border: "1px solid rgba(124, 58, 237, 0.3)", borderRadius: 12,
          background: "linear-gradient(135deg, #7c3aed, #a855f7)",
          color: "#fff", cursor: "pointer",
          boxShadow: "0 0 30px rgba(124, 58, 237, 0.3), 0 4px 20px rgba(0,0,0,0.3)",
        },
      }, "Retake Quiz"),
    ),
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MeebitQuiz() {
  const [database, setDatabase] = useState(null);
  const [dbLoaded, setDbLoaded] = useState(false);
  const [phase, setPhase] = useState("intro");
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState(Array(QUESTIONS.length).fill(null));
  const [matchResults, setMatchResults] = useState(null);
  const [matchProfile, setMatchProfile] = useState(null);

  useEffect(() => {
    fetch("/meebits_quiz_db.json")
      .then((r) => r.json())
      .then((data) => { setDatabase(data); setDbLoaded(true); })
      .catch((err) => console.error("Failed to load database:", err));
  }, []);

  const handleStart = useCallback(() => {
    setPhase("quiz");
    setCurrentQ(0);
    setAnswers(Array(QUESTIONS.length).fill(null));
    setMatchResults(null);
    setMatchProfile(null);
  }, []);

  const handleAnswer = useCallback((answerIdx) => {
    const newAnswers = [...answers];
    newAnswers[currentQ] = answerIdx;
    setAnswers(newAnswers);

    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ((q) => q + 1);
    } else {
      setPhase("calculating");
      // Use setTimeout to let the calculating screen render first
      setTimeout(() => {
        const ranked = rankMeebits(database, newAnswers);
        setMatchResults(ranked.results);
        setMatchProfile(ranked.profile);
        setPhase("results");
      }, 2000);
    }
  }, [currentQ, answers, database]);

  const handleBack = useCallback(() => {
    if (currentQ > 0) setCurrentQ((q) => q - 1);
  }, [currentQ]);

  const handleRestart = useCallback(() => {
    setPhase("intro");
    setCurrentQ(0);
    setAnswers(Array(QUESTIONS.length).fill(null));
    setMatchResults(null);
    setMatchProfile(null);
  }, []);

  return React.createElement("div", {
    style: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      minHeight: "100vh", color: "#e2e2f0", position: "relative", overflow: "hidden",
      background: "#0a0a0f",
    },
  },
    // Animated background orbs
    React.createElement("div", {
      style: {
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden",
      },
    },
      React.createElement("div", {
        style: {
          position: "absolute", top: "10%", left: "15%",
          width: 400, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124, 58, 237, 0.15) 0%, transparent 70%)",
          animation: "orbMove1 8s ease-in-out infinite",
          filter: "blur(40px)",
        },
      }),
      React.createElement("div", {
        style: {
          position: "absolute", top: "60%", right: "10%",
          width: 350, height: 350, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%)",
          animation: "orbMove2 10s ease-in-out infinite",
          filter: "blur(40px)",
        },
      }),
      React.createElement("div", {
        style: {
          position: "absolute", bottom: "20%", left: "40%",
          width: 300, height: 300, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(109, 40, 217, 0.1) 0%, transparent 70%)",
          animation: "orbMove3 12s ease-in-out infinite",
          filter: "blur(40px)",
        },
      }),
    ),
    // Content
    React.createElement("div", {
      style: {
        maxWidth: 860, margin: "0 auto", padding: "24px 20px",
        position: "relative", zIndex: 1,
      },
    },
      phase === "intro" ? React.createElement(QuizIntro, { onStart: handleStart, dbLoaded }) : null,
      phase === "quiz"
        ? React.createElement("div", null,
            React.createElement(QuizProgress, { current: currentQ, total: QUESTIONS.length }),
            React.createElement(QuizQuestion, {
              question: QUESTIONS[currentQ], onAnswer: handleAnswer,
              onBack: handleBack, canGoBack: currentQ > 0,
              selectedAnswer: answers[currentQ],
            }),
          )
        : null,
      phase === "calculating" ? React.createElement(CalculatingScreen) : null,
      phase === "results"
        ? React.createElement(ResultsPage, { results: matchResults, profile: matchProfile, onRestart: handleRestart })
        : null,
    ),
  );
}
