import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";

// ─── Configuration ───────────────────────────────────────────────────────────
const BASE_URL = "https://meebits-trait-thumbnails.example.com";
const TOTAL_SUPPLY = 20000;
const ITEMS_PER_PAGE_DESKTOP = 10;
const ITEMS_PER_PAGE_MOBILE = 8;

// ─── Trait Data (human only) ─────────────────────────────────────────────────
const CATEGORIES = {
  hair_style: { label: "Hair Style", region: "head", is_color: false, items: [
    { value: "bald", count: 1752, thumbnail: "hair_style_bald" },
    { value: "big_bangs", count: 760, thumbnail: "hair_style_big_bangs" },
    { value: "bob", count: 389, thumbnail: "hair_style_bob" },
    { value: "bun", count: 235, thumbnail: "hair_style_bun" },
    { value: "buzzcut", count: 3277, thumbnail: "hair_style_buzzcut" },
    { value: "curly", count: 732, thumbnail: "hair_style_curly" },
    { value: "fade", count: 1407, thumbnail: "hair_style_fade" },
    { value: "fiery_mohawk", count: 41, thumbnail: "hair_style_fiery_mohawk" },
    { value: "half_shaved", count: 39, thumbnail: "hair_style_half_shaved" },
    { value: "high_flat_top", count: 404, thumbnail: "hair_style_high_flat_top" },
    { value: "long", count: 773, thumbnail: "hair_style_long" },
    { value: "messy", count: 664, thumbnail: "hair_style_messy" },
    { value: "mohawk", count: 643, thumbnail: "hair_style_mohawk" },
    { value: "one_side", count: 360, thumbnail: "hair_style_one_side" },
    { value: "pigtails", count: 157, thumbnail: "hair_style_pigtails" },
    { value: "ponytail", count: 789, thumbnail: "hair_style_ponytail" },
    { value: "pulled_back", count: 758, thumbnail: "hair_style_pulled_back" },
    { value: "simple", count: 2570, thumbnail: "hair_style_simple" },
    { value: "spiky", count: 1345, thumbnail: "hair_style_spiky" },
    { value: "straight", count: 774, thumbnail: "hair_style_straight" },
    { value: "very_long", count: 731, thumbnail: "hair_style_very_long" },
    { value: "wild", count: 1400, thumbnail: "hair_style_wild" },
  ]},
  hair_color: { label: "Hair Color", region: "head", is_color: true, items: [
    { value: "auburn", count: 322, thumbnail: "hair_color_auburn", hex: "#f54e3e" },
    { value: "bleached", count: 890, thumbnail: "hair_color_bleached", hex: "#e4e1d5" },
    { value: "blonde", count: 1116, thumbnail: "hair_color_blonde", hex: "#f7eccb" },
    { value: "blondee", count: 612, thumbnail: "hair_color_blondee", hex: "#f7e5af" },
    { value: "blue", count: 71, thumbnail: "hair_color_blue", hex: "#010bde" },
    { value: "brown", count: 1795, thumbnail: "hair_color_brown", hex: "#8f725e" },
    { value: "dark", count: 11709, thumbnail: "hair_color_dark", hex: "#3a3a3a" },
    { value: "dyed_red", count: 740, thumbnail: "hair_color_dyed_red", hex: "#e03645" },
    { value: "light_blue", count: 353, thumbnail: "hair_color_light_blue", hex: "#79c9ee" },
    { value: "purple_dye", count: 210, thumbnail: "hair_color_purple_dye" },
    { value: "rainbow", count: 99, thumbnail: "hair_color_rainbow" },
    { value: "silver", count: 290, thumbnail: "hair_color_silver", hex: "#e9e9e9" },
  ]},
  hat: { label: "Hat", region: "head", is_color: false, items: [
    { value: "backwards_cap", count: 664, thumbnail: "hat_backwards_cap" },
    { value: "bandana", count: 166, thumbnail: "hat_bandana" },
    { value: "brimmed", count: 135, thumbnail: "hat_brimmed" },
    { value: "cap", count: 1002, thumbnail: "hat_cap" },
    { value: "headphones", count: 1285, thumbnail: "hat_headphones" },
    { value: "snoutz_cap", count: 79, thumbnail: "hat_snoutz_cap" },
    { value: "trucker_cap", count: 328, thumbnail: "hat_trucker_cap" },
    { value: "wool_hat", count: 670, thumbnail: "hat_wool_hat" },
  ]},
  hat_color: { label: "Hat Color", region: "head", is_color: true, items: [
    { value: "black", count: 920, thumbnail: "hat_color_black", hex: "#2E2E30" },
    { value: "camo", count: 229, thumbnail: "hat_color_camo" },
    { value: "gray", count: 863, thumbnail: "hat_color_gray", hex: "#b4c1c8" },
    { value: "green", count: 209, thumbnail: "hat_color_green", hex: "#3ebb3e" },
    { value: "magenta", count: 253, thumbnail: "hat_color_magenta", hex: "#af27bd" },
    { value: "purple", count: 275, thumbnail: "hat_color_purple", hex: "#6f2dde" },
    { value: "red", count: 236, thumbnail: "hat_color_red", hex: "#bc193e" },
    { value: "white", count: 745, thumbnail: "hat_color_white", hex: "#eeeeee" },
    { value: "yellow", count: 298, thumbnail: "hat_color_yellow", hex: "#d6c128" },
  ]},
  beard: { label: "Beard", region: "face", is_color: false, items: [
    { value: "big", count: 369, thumbnail: "beard_big" },
    { value: "biker_mustache", count: 129, thumbnail: "beard_biker_mustache" },
    { value: "full", count: 1449, thumbnail: "beard_full" },
    { value: "medical_mask", count: 113, thumbnail: "beard_medical_mask" },
    { value: "mustache", count: 628, thumbnail: "beard_mustache" },
    { value: "muttonchops", count: 156, thumbnail: "beard_muttonchops" },
    { value: "stubble", count: 1585, thumbnail: "beard_stubble" },
  ]},
  beard_color: { label: "Beard Color", region: "face", is_color: true, items: [
    { value: "blond", count: 450, thumbnail: "beard_color_blond", hex: "#f7eccb" },
    { value: "brown", count: 453, thumbnail: "beard_color_brown", hex: "#8f725e" },
    { value: "dark", count: 3341, thumbnail: "beard_color_dark", hex: "#3a3a3a" },
    { value: "silver", count: 72, thumbnail: "beard_color_silver", hex: "#e9e9e9" },
  ]},
  glasses: { label: "Glasses", region: "face", is_color: false, items: [
    { value: "3d", count: 120, thumbnail: "glasses_3d" },
    { value: "aviators", count: 1057, thumbnail: "glasses_aviators" },
    { value: "elvis", count: 1374, thumbnail: "glasses_elvis" },
    { value: "frameless", count: 1339, thumbnail: "glasses_frameless" },
    { value: "nerdy", count: 966, thumbnail: "glasses_nerdy" },
    { value: "round_glasses", count: 1299, thumbnail: "glasses_round_glasses" },
    { value: "specs", count: 592, thumbnail: "glasses_specs" },
    { value: "sunglasses", count: 1083, thumbnail: "glasses_sunglasses" },
  ]},
  glasses_color: { label: "Glasses Color", region: "face", is_color: true, items: [
    { value: "charcoal", count: 1232, thumbnail: "glasses_color_charcoal", hex: "#33404d" },
    { value: "dark_red", count: 405, thumbnail: "glasses_color_dark_red", hex: "#a43033" },
    { value: "white", count: 1220, thumbnail: "glasses_color_white", hex: "#eeeeee" },
  ]},
  earring: { label: "Earring", region: "face", is_color: false, items: [
    { value: "gold_earring", count: 859, thumbnail: "earring_gold_earring" },
    { value: "gold_earrings", count: 782, thumbnail: "earring_gold_earrings" },
    { value: "gold_hoops", count: 401, thumbnail: "earring_gold_hoops" },
  ]},
  necklace: { label: "Necklace", region: "body", is_color: false, items: [
    { value: "gold_chain", count: 2161, thumbnail: "necklace_gold_chain" },
    { value: "gold_necklace", count: 1577, thumbnail: "necklace_gold_necklace" },
  ]},
  shirt: { label: "Shirt", region: "body", is_color: false, items: [
    { value: "bare_chest", count: 403, thumbnail: "shirt_bare_chest" },
    { value: "basketball_jersey", count: 433, thumbnail: "shirt_basketball_jersey" },
    { value: "cga_shirt", count: 101, thumbnail: "shirt_cga_shirt" },
    { value: "classic_jersey", count: 536, thumbnail: "shirt_classic_jersey" },
    { value: "diagonal_tee", count: 753, thumbnail: "shirt_diagonal_tee" },
    { value: "flamingo_tee", count: 37, thumbnail: "shirt_flamingo_tee" },
    { value: "ghost_tee", count: 833, thumbnail: "shirt_ghost_tee" },
    { value: "glyph_shirt", count: 6, thumbnail: "shirt_glyph_shirt" },
    { value: "halter_top", count: 467, thumbnail: "shirt_halter_top" },
    { value: "hawaiian", count: 91, thumbnail: "shirt_hawaiian" },
    { value: "heart_hoodie", count: 886, thumbnail: "shirt_heart_hoodie" },
    { value: "heart_tee", count: 77, thumbnail: "shirt_heart_tee" },
    { value: "hoodie", count: 2107, thumbnail: "shirt_hoodie" },
    { value: "hoodie_up", count: 412, thumbnail: "shirt_hoodie_up" },
    { value: "invader_tee", count: 1792, thumbnail: "shirt_invader_tee" },
    { value: "jersey", count: 400, thumbnail: "shirt_jersey" },
    { value: "lines", count: 232, thumbnail: "shirt_lines" },
    { value: "logo_tee", count: 996, thumbnail: "shirt_logo_tee" },
    { value: "long_sleeved", count: 840, thumbnail: "shirt_long_sleeved" },
    { value: "meepet_tee", count: 488, thumbnail: "shirt_meepet_tee" },
    { value: "no_shirt", count: 1, thumbnail: "shirt_no_shirt" },
    { value: "oversized_hoodie", count: 1123, thumbnail: "shirt_oversized_hoodie" },
    { value: "punk_tee", count: 26, thumbnail: "shirt_punk_tee" },
    { value: "skull_tee", count: 1972, thumbnail: "shirt_skull_tee" },
    { value: "snoutz_hoodie", count: 39, thumbnail: "shirt_snoutz_hoodie" },
    { value: "snoutz_jersey", count: 64, thumbnail: "shirt_snoutz_jersey" },
    { value: "snoutz_skull_tee", count: 103, thumbnail: "shirt_snoutz_skull_tee" },
    { value: "snoutz_tee", count: 269, thumbnail: "shirt_snoutz_tee" },
    { value: "stylized_hoodie", count: 101, thumbnail: "shirt_stylized_hoodie" },
    { value: "suit", count: 1212, thumbnail: "shirt_suit" },
    { value: "suit_jacket", count: 493, thumbnail: "shirt_suit_jacket" },
    { value: "tee", count: 1123, thumbnail: "shirt_tee" },
    { value: "tie_dyed_tee", count: 121, thumbnail: "shirt_tie_dyed_tee" },
    { value: "tube_top", count: 572, thumbnail: "shirt_tube_top" },
    { value: "windbreaker", count: 891, thumbnail: "shirt_windbreaker" },
  ]},
  shirt_color: { label: "Shirt Color", region: "body", is_color: true, items: [
    { value: "argyle", count: 111, thumbnail: "shirt_color_argyle" },
    { value: "black", count: 3116, thumbnail: "shirt_color_black", hex: "#2E2E30" },
    { value: "blue_camo", count: 118, thumbnail: "shirt_color_blue_camo" },
    { value: "camo", count: 665, thumbnail: "shirt_color_camo" },
    { value: "gray", count: 2732, thumbnail: "shirt_color_gray", hex: "#b4c1c8" },
    { value: "green", count: 634, thumbnail: "shirt_color_green", hex: "#3ebb3e" },
    { value: "green_plaid", count: 285, thumbnail: "shirt_color_green_plaid" },
    { value: "leopard_print", count: 21, thumbnail: "shirt_color_leopard_print" },
    { value: "luxe", count: 54, thumbnail: "shirt_color_luxe" },
    { value: "magenta", count: 813, thumbnail: "shirt_color_magenta", hex: "#af27bd" },
    { value: "posh", count: 28, thumbnail: "shirt_color_posh" },
    { value: "purple", count: 815, thumbnail: "shirt_color_purple", hex: "#6f2dde" },
    { value: "red", count: 749, thumbnail: "shirt_color_red", hex: "#bc193e" },
    { value: "red_plaid", count: 240, thumbnail: "shirt_color_red_plaid" },
    { value: "white", count: 1970, thumbnail: "shirt_color_white", hex: "#eeeeee" },
    { value: "yellow", count: 844, thumbnail: "shirt_color_yellow", hex: "#d6c128" },
  ]},
  overshirt: { label: "Overshirt", region: "body", is_color: false, items: [
    { value: "athletic_jacket", count: 503, thumbnail: "overshirt_athletic_jacket" },
    { value: "collar_shirt", count: 1337, thumbnail: "overshirt_collar_shirt" },
    { value: "jean_jacket", count: 316, thumbnail: "overshirt_jean_jacket" },
    { value: "leather_jacket", count: 461, thumbnail: "overshirt_leather_jacket" },
    { value: "trenchcoat", count: 593, thumbnail: "overshirt_trenchcoat" },
  ]},
  overshirt_color: { label: "Overshirt Color", region: "body", is_color: true, items: [
    { value: "argyle", count: 20, thumbnail: "overshirt_color_argyle" },
    { value: "black", count: 227, thumbnail: "overshirt_color_black", hex: "#2E2E30" },
    { value: "blue_camo", count: 31, thumbnail: "overshirt_color_blue_camo" },
    { value: "camo", count: 127, thumbnail: "overshirt_color_camo" },
    { value: "gray", count: 239, thumbnail: "overshirt_color_gray", hex: "#b4c1c8" },
    { value: "green", count: 118, thumbnail: "overshirt_color_green", hex: "#3ebb3e" },
    { value: "green_plaid", count: 61, thumbnail: "overshirt_color_green_plaid" },
    { value: "luxe", count: 25, thumbnail: "overshirt_color_luxe" },
    { value: "magenta", count: 188, thumbnail: "overshirt_color_magenta", hex: "#af27bd" },
    { value: "posh", count: 12, thumbnail: "overshirt_color_posh" },
    { value: "purple", count: 187, thumbnail: "overshirt_color_purple", hex: "#6f2dde" },
    { value: "red", count: 165, thumbnail: "overshirt_color_red", hex: "#bc193e" },
    { value: "red_plaid", count: 66, thumbnail: "overshirt_color_red_plaid" },
    { value: "white", count: 180, thumbnail: "overshirt_color_white", hex: "#eeeeee" },
    { value: "yellow", count: 194, thumbnail: "overshirt_color_yellow", hex: "#d6c128" },
  ]},
  pants: { label: "Pants", region: "legs", is_color: false, items: [
    { value: "athletic_shorts", count: 3379, thumbnail: "pants_athletic_shorts" },
    { value: "cargo_pants", count: 2868, thumbnail: "pants_cargo_pants" },
    { value: "leggings", count: 2532, thumbnail: "pants_leggings" },
    { value: "no_pants", count: 1, thumbnail: "pants_no_pants" },
    { value: "regular_pants", count: 3293, thumbnail: "pants_regular_pants" },
    { value: "ripped_jeans", count: 1948, thumbnail: "pants_ripped_jeans" },
    { value: "short_leggings", count: 2418, thumbnail: "pants_short_leggings" },
    { value: "skirt", count: 2384, thumbnail: "pants_skirt" },
    { value: "suit_pants", count: 500, thumbnail: "pants_suit_pants" },
    { value: "trackpants", count: 677, thumbnail: "pants_trackpants" },
  ]},
  pants_color: { label: "Pants Color", region: "legs", is_color: true, items: [
    { value: "argyle", count: 31, thumbnail: "pants_color_argyle" },
    { value: "black", count: 763, thumbnail: "pants_color_black", hex: "#2E2E30" },
    { value: "blue_camo", count: 1005, thumbnail: "pants_color_blue_camo" },
    { value: "camo", count: 3210, thumbnail: "pants_color_camo" },
    { value: "dark_gray", count: 3704, thumbnail: "pants_color_dark_gray", hex: "#6b6b6b" },
    { value: "dark_red", count: 1307, thumbnail: "pants_color_dark_red" },
    { value: "denim", count: 3783, thumbnail: "pants_color_denim", hex: "#4266a8" },
    { value: "gray", count: 638, thumbnail: "pants_color_gray", hex: "#b4c1c8" },
    { value: "green", count: 182, thumbnail: "pants_color_green", hex: "#3ebb3e" },
    { value: "green_plaid", count: 69, thumbnail: "pants_color_green_plaid" },
    { value: "leopard_print", count: 374, thumbnail: "pants_color_leopard_print" },
    { value: "luxe", count: 585, thumbnail: "pants_color_luxe" },
    { value: "magenta", count: 188, thumbnail: "pants_color_magenta", hex: "#af27bd" },
    { value: "posh", count: 428, thumbnail: "pants_color_posh" },
    { value: "purple", count: 218, thumbnail: "pants_color_purple", hex: "#6f2dde" },
    { value: "red", count: 197, thumbnail: "pants_color_red", hex: "#bc193e" },
    { value: "red_plaid", count: 69, thumbnail: "pants_color_red_plaid" },
    { value: "white", count: 629, thumbnail: "pants_color_white", hex: "#eeeeee" },
    { value: "yellow", count: 171, thumbnail: "pants_color_yellow", hex: "#d6c128" },
  ]},
  shoes: { label: "Shoes", region: "feet", is_color: false, items: [
    { value: "basketball", count: 1667, thumbnail: "shoes_basketball" },
    { value: "canvas", count: 3808, thumbnail: "shoes_canvas" },
    { value: "classic", count: 1736, thumbnail: "shoes_classic" },
    { value: "high_boots", count: 684, thumbnail: "shoes_high_boots" },
    { value: "high_tops", count: 925, thumbnail: "shoes_high_tops" },
    { value: "ll_86", count: 33, thumbnail: "shoes_ll_86" },
    { value: "ll_alien", count: 13, thumbnail: "shoes_ll_alien" },
    { value: "ll_baby_blue", count: 225, thumbnail: "shoes_ll_baby_blue" },
    { value: "ll_high_tops", count: 170, thumbnail: "shoes_ll_high_tops" },
    { value: "ll_moonboots", count: 44, thumbnail: "shoes_ll_moonboots" },
    { value: "ll_orange", count: 133, thumbnail: "shoes_ll_orange" },
    { value: "ll_retro", count: 78, thumbnail: "shoes_ll_retro" },
    { value: "ll_rgb", count: 52, thumbnail: "shoes_ll_rgb" },
    { value: "ll_tall", count: 113, thumbnail: "shoes_ll_tall" },
    { value: "neon_sneakers", count: 799, thumbnail: "shoes_neon_sneakers" },
    { value: "no_shoes", count: 5, thumbnail: "shoes_no_shoes" },
    { value: "running", count: 639, thumbnail: "shoes_running" },
    { value: "sandals", count: 1066, thumbnail: "shoes_sandals" },
    { value: "skater", count: 1701, thumbnail: "shoes_skater" },
    { value: "slides", count: 1764, thumbnail: "shoes_slides" },
    { value: "sneakers", count: 1649, thumbnail: "shoes_sneakers" },
    { value: "urban_boots", count: 1106, thumbnail: "shoes_urban_boots" },
    { value: "workboots", count: 1590, thumbnail: "shoes_workboots" },
  ]},
  shoes_color: { label: "Shoes Color", region: "feet", is_color: true, items: [
    { value: "black", count: 2992, thumbnail: "shoes_color_black", hex: "#2E2E30" },
    { value: "gray", count: 2764, thumbnail: "shoes_color_gray", hex: "#b4c1c8" },
    { value: "green", count: 747, thumbnail: "shoes_color_green", hex: "#3ebb3e" },
    { value: "magenta", count: 835, thumbnail: "shoes_color_magenta", hex: "#af27bd" },
    { value: "purple", count: 893, thumbnail: "shoes_color_purple", hex: "#6f2dde" },
    { value: "red", count: 833, thumbnail: "shoes_color_red", hex: "#bc193e" },
    { value: "white", count: 2198, thumbnail: "shoes_color_white", hex: "#eeeeee" },
    { value: "yellow", count: 1004, thumbnail: "shoes_color_yellow", hex: "#d6c128" },
  ]},
  tattoo: { label: "Tattoo", region: "body", is_color: false, items: [
    { value: "no", count: 19006, thumbnail: "tattoo_no" },
    { value: "yes", count: 994, thumbnail: "tattoo_yes" },
  ]},
  jersey_number: { label: "Jersey Number", region: "body", is_color: false, items: [
    { value: "0", count: 140, thumbnail: "jersey_number_0" },
    { value: "1", count: 129, thumbnail: "jersey_number_1" },
    { value: "2", count: 133, thumbnail: "jersey_number_2" },
    { value: "3", count: 168, thumbnail: "jersey_number_3" },
    { value: "4", count: 146, thumbnail: "jersey_number_4" },
    { value: "5", count: 145, thumbnail: "jersey_number_5" },
    { value: "6", count: 142, thumbnail: "jersey_number_6" },
    { value: "7", count: 133, thumbnail: "jersey_number_7" },
    { value: "8", count: 148, thumbnail: "jersey_number_8" },
    { value: "9", count: 149, thumbnail: "jersey_number_9" },
  ]},
};

// ─── Region / Category Mapping ───────────────────────────────────────────────
const REGION_CATEGORIES = {
  head: ["hair_style", "hat"],
  face: ["beard", "glasses", "earring"],
  body: ["necklace", "shirt", "overshirt", "tattoo", "jersey_number"],
  legs: ["pants"],
  feet: ["shoes"],
};

const COLOR_PAIRS = {
  hair_style: "hair_color",
  hat: "hat_color",
  beard: "beard_color",
  glasses: "glasses_color",
  shirt: "shirt_color",
  overshirt: "overshirt_color",
  pants: "pants_color",
  shoes: "shoes_color",
};

const REGION_LABELS = { head: "HEAD", face: "FACE", body: "BODY", legs: "LEGS", feet: "FEET" };

// Overlay positioning (percentage of character container)
const OVERLAY_CONFIG = {
  hair_style:      { top: "2%",  left: "18%", width: "64%", height: "22%" },
  hair_color:      { top: "2%",  left: "18%", width: "64%", height: "22%" },
  hat:             { top: "0%",  left: "15%", width: "70%", height: "24%" },
  hat_color:       { top: "0%",  left: "15%", width: "70%", height: "24%" },
  beard:           { top: "18%", left: "25%", width: "50%", height: "12%" },
  beard_color:     { top: "18%", left: "25%", width: "50%", height: "12%" },
  glasses:         { top: "13%", left: "22%", width: "56%", height: "8%" },
  glasses_color:   { top: "13%", left: "22%", width: "56%", height: "8%" },
  earring:         { top: "14%", left: "15%", width: "70%", height: "10%" },
  necklace:        { top: "24%", left: "22%", width: "56%", height: "10%" },
  shirt:           { top: "26%", left: "14%", width: "72%", height: "28%" },
  shirt_color:     { top: "26%", left: "14%", width: "72%", height: "28%" },
  overshirt:       { top: "24%", left: "12%", width: "76%", height: "30%" },
  overshirt_color: { top: "24%", left: "12%", width: "76%", height: "30%" },
  tattoo:          { top: "28%", left: "10%", width: "35%", height: "16%" },
  jersey_number:   { top: "30%", left: "28%", width: "44%", height: "16%" },
  pants:           { top: "54%", left: "18%", width: "64%", height: "26%" },
  pants_color:     { top: "54%", left: "18%", width: "64%", height: "26%" },
  shoes:           { top: "80%", left: "14%", width: "72%", height: "18%" },
  shoes_color:     { top: "80%", left: "14%", width: "72%", height: "18%" },
};

const OVERLAY_Z = {
  shoes: 10, shoes_color: 11,
  pants: 20, pants_color: 21,
  shirt: 30, shirt_color: 31,
  overshirt: 35, overshirt_color: 36,
  tattoo: 32, jersey_number: 33,
  necklace: 37,
  beard: 40, beard_color: 41,
  glasses: 42, glasses_color: 43,
  earring: 44,
  hair_style: 45, hair_color: 46,
  hat: 50, hat_color: 51,
};

// ─── Pixel Grid Character ────────────────────────────────────────────────────
// Each cell: [colorIndex, region]  null = empty
// Colors: 0=skin, 1=skinShadow, 2=hair, 3=shirt, 4=pants, 5=shoes, 6=eye, 7=mouth
const C = {
  s: "#d4a574",   // skin
  S: "#c49464",   // skin shadow
  h: "#3a3a3a",   // hair (dark)
  H: "#2a2a2a",   // hair shadow
  t: "#7a8a9a",   // shirt
  T: "#6a7a8a",   // shirt shadow
  p: "#4a5568",   // pants
  P: "#3a4558",   // pants shadow
  f: "#5a4a3a",   // shoes
  F: "#4a3a2a",   // shoes shadow
  e: "#2a2a2a",   // eye
  m: "#c47a6a",   // mouth
  n: "#e8c4a4",   // nose/highlight
  w: "#ffffff",   // eye white
};

// 26 columns wide, 48 rows tall — each row is a string, each char maps to C above
// '.' = empty space
const PIXEL_ROWS = [
  // Row 0-7: Hair/top of head (region: head)
  "..........hhhhhh..........",  // 0
  ".........hhhhhhhh.........",  // 1
  "........hhhhhhhhhh........",  // 2
  ".......hhhhhhhhhhhh.......",  // 3
  ".......hhhhhhhhhhhh.......",  // 4
  ".......HHhhhhhhhHHH.......",  // 5
  ".......HHhhhhhhhHHH.......",  // 6
  ".......HHhhhhhhhHHH.......",  // 7
  // Row 8-15: Face (region: face)
  ".......ssssssssssss.......",  // 8
  ".......ssssssssssss.......",  // 9
  ".......swwessswwess.......",  // 10 eyes
  ".......ssssssssssss.......",  // 11
  ".......ssssnnssssss.......",  // 12 nose
  ".......ssssssssssss.......",  // 13
  ".......SsssmmmmssSS.......",  // 14 mouth
  ".......SSssssssssSSS......",  // 15
  // Row 16-17: Neck (region: face)
  "..........ssssss..........",  // 16
  "..........SSSSSS..........",  // 17
  // Row 18-30: Torso/shirt (region: body)
  "......tttttttttttttt......",  // 18
  ".....ttttttttttttttt......",  // 19
  "....tttttttttttttttttt....",  // 20
  "...ttttttttttttttttttt....",  // 21
  "...ttttttttttttttttttt....",  // 22
  "....ttttttttttttttttt.....",  // 23
  ".....tttttttttttttttt.....",  // 24
  ".....TTttttttttttTTTT.....",  // 25
  "......TTttttttttTTTT......",  // 26
  "......TTttttttttTTTT......",  // 27
  ".......ttttttttttt........",  // 28
  ".......ttttttttttt........",  // 29
  ".......TTtttttttTT........",  // 30
  // Row 31-40: Legs/pants (region: legs)
  ".......pppppppppppp.......",  // 31
  ".......pppppppppppp.......",  // 32
  ".......pppppppppppp.......",  // 33
  ".......pppp..pppppp.......",  // 34
  ".......pppp..pppppp.......",  // 35
  ".......pppp..pppppp.......",  // 36
  ".......pppp..pppppp.......",  // 37
  ".......PPpp..ppppPP.......",  // 38
  ".......PPpp..ppppPP.......",  // 39
  ".......PPpp..ppppPP.......",  // 40
  // Row 41-47: Feet/shoes (region: feet)
  "......fffff..ffffff.......",  // 41
  "......fffff..ffffff.......",  // 42
  ".....ffffff..fffffff......",  // 43
  ".....ffffff..fffffff......",  // 44
  ".....FFFFFF..FFFFFFF......",  // 45
  ".....FFFFFF..FFFFFFF......",  // 46
  "..........................",  // 47
];

// Map character to color and determine region from row index
function getRegionForRow(row) {
  if (row <= 7) return "head";
  if (row <= 17) return "face";
  if (row <= 30) return "body";
  if (row <= 40) return "legs";
  if (row <= 46) return "feet";
  return null;
}

// ─── Utility Functions ───────────────────────────────────────────────────────
function formatName(value) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRarityInfo(count) {
  const pct = (count / TOTAL_SUPPLY) * 100;
  if (pct < 0.1) return { label: "Mythic", color: "#dc2626", bg: "#dc262615" };
  if (pct < 1) return { label: "Legendary", color: "#ea580c", bg: "#ea580c15" };
  if (pct < 5) return { label: "Rare", color: "#7c3aed", bg: "#7c3aed15" };
  if (pct < 20) return { label: "Uncommon", color: "#2563eb", bg: "#2563eb15" };
  return { label: "Common", color: "#6b7280", bg: "#6b728015" };
}

function patternGradient(name) {
  const patterns = {
    camo: "linear-gradient(135deg, #4a6741 25%, #2d4a2d 25%, #2d4a2d 50%, #5c7a52 50%, #5c7a52 75%, #3d5a35 75%)",
    blue_camo: "linear-gradient(135deg, #4a6a8a 25%, #2d4a6a 25%, #2d4a6a 50%, #5c7a9a 50%, #5c7a9a 75%, #3d5a7a 75%)",
    argyle: "repeating-linear-gradient(45deg, #c44 0px, #c44 2px, #e77 2px, #e77 4px, #c44 4px)",
    green_plaid: "repeating-linear-gradient(0deg, transparent, transparent 4px, #3ebb3e33 4px, #3ebb3e33 5px), repeating-linear-gradient(90deg, transparent, transparent 4px, #3ebb3e33 4px, #3ebb3e33 5px), #5a8a5a",
    red_plaid: "repeating-linear-gradient(0deg, transparent, transparent 4px, #bc193e33 4px, #bc193e33 5px), repeating-linear-gradient(90deg, transparent, transparent 4px, #bc193e33 4px, #bc193e33 5px), #8a4a4a",
    leopard_print: "radial-gradient(circle 3px, #3a2a1a 70%, transparent 70%), radial-gradient(circle 2px at 8px 6px, #3a2a1a 70%, transparent 70%), #d4a84a",
    luxe: "linear-gradient(135deg, #c9a84c 0%, #f1d98a 40%, #c9a84c 60%, #a67c2e 100%)",
    posh: "linear-gradient(135deg, #2c1810 0%, #5a3a2a 40%, #8a5a3a 60%, #3a2010 100%)",
    rainbow: "linear-gradient(90deg, #ff0000, #ff8800, #ffff00, #00ff00, #0088ff, #8800ff)",
    dark_red: "linear-gradient(135deg, #8b1a1a, #a02020)",
    purple_dye: "linear-gradient(135deg, #6b21a8, #9333ea)",
  };
  return patterns[name] || "#888";
}

// ─── Region hover color multiplier ───────────────────────────────────────────
function brightenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const nr = Math.min(255, Math.round(r + (255 - r) * factor));
  const ng = Math.min(255, Math.round(g + (255 - g) * factor));
  const nb = Math.min(255, Math.round(b + (255 - b) * factor));
  return `#${nr.toString(16).padStart(2, "0")}${ng.toString(16).padStart(2, "0")}${nb.toString(16).padStart(2, "0")}`;
}

// ─── SVG Character Component ─────────────────────────────────────────────────
function MeebitCharacter({ hoveredRegion, onRegionHover, onRegionClick, cellSize }) {
  const regionRects = { head: [], face: [], body: [], legs: [], feet: [] };

  PIXEL_ROWS.forEach((row, rowIdx) => {
    const region = getRegionForRow(rowIdx);
    if (!region) return;
    for (let col = 0; col < row.length; col++) {
      const ch = row[col];
      if (ch === ".") continue;
      const color = C[ch];
      if (!color) continue;
      const isHovered = hoveredRegion === region;
      const fill = isHovered ? brightenColor(color, 0.25) : color;
      regionRects[region].push(
        React.createElement("rect", {
          key: `${rowIdx}-${col}`,
          x: col * cellSize,
          y: rowIdx * cellSize,
          width: cellSize,
          height: cellSize,
          fill: fill,
          rx: 0.5,
        })
      );
    }
  });

  const svgW = 26 * cellSize;
  const svgH = 48 * cellSize;

  // Compute region bounding boxes for click targets
  const regionBounds = {};
  const regions = ["head", "face", "body", "legs", "feet"];
  regions.forEach((region) => {
    let minR = 999, maxR = 0, minC = 999, maxC = 0;
    PIXEL_ROWS.forEach((row, rowIdx) => {
      if (getRegionForRow(rowIdx) !== region) return;
      for (let col = 0; col < row.length; col++) {
        if (row[col] !== ".") {
          minR = Math.min(minR, rowIdx);
          maxR = Math.max(maxR, rowIdx);
          minC = Math.min(minC, col);
          maxC = Math.max(maxC, col);
        }
      }
    });
    regionBounds[region] = {
      x: minC * cellSize - 2,
      y: minR * cellSize - 2,
      w: (maxC - minC + 1) * cellSize + 4,
      h: (maxR - minR + 1) * cellSize + 4,
    };
  });

  return React.createElement("svg", {
    viewBox: `0 0 ${svgW} ${svgH}`,
    width: svgW,
    height: svgH,
    style: { display: "block" },
  },
    regions.map((region) =>
      React.createElement("g", {
        key: region,
        style: { cursor: "pointer" },
        onMouseEnter: () => onRegionHover(region),
        onMouseLeave: () => onRegionHover(null),
        onClick: (e) => { e.stopPropagation(); onRegionClick(region, regionBounds[region]); },
      },
        // Invisible hit area
        React.createElement("rect", {
          x: regionBounds[region].x,
          y: regionBounds[region].y,
          width: regionBounds[region].w,
          height: regionBounds[region].h,
          fill: "transparent",
        }),
        // Hover glow outline
        hoveredRegion === region && React.createElement("rect", {
          x: regionBounds[region].x - 3,
          y: regionBounds[region].y - 3,
          width: regionBounds[region].w + 6,
          height: regionBounds[region].h + 6,
          fill: "none",
          stroke: "#7c3aed",
          strokeWidth: 2,
          rx: 6,
          strokeDasharray: "6 3",
          opacity: 0.6,
        }),
        ...regionRects[region],
      )
    ),
  );
}

// ─── Region Label Tooltip ────────────────────────────────────────────────────
function RegionLabel({ region, bounds, cellSize, containerRect }) {
  if (!region || !bounds) return null;
  const centerX = bounds.x + bounds.w / 2;
  const top = bounds.y - 24;

  return React.createElement("div", {
    style: {
      position: "absolute",
      left: centerX,
      top: top,
      transform: "translateX(-50%)",
      background: "#1a1a2e",
      color: "#fff",
      padding: "4px 12px",
      borderRadius: 6,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1.5,
      whiteSpace: "nowrap",
      pointerEvents: "none",
      zIndex: 100,
    },
  }, REGION_LABELS[region]);
}

// ─── Thumbnail Image with Error Fallback ─────────────────────────────────────
function ThumbImg({ thumbnail, size, style }) {
  const [err, setErr] = useState(false);
  if (err) {
    return React.createElement("div", {
      style: {
        width: size, height: size, borderRadius: "50%",
        background: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.35, color: "#aaa", ...style,
      },
    }, "?");
  }
  return React.createElement("img", {
    src: `${BASE_URL}/${thumbnail}.png`,
    alt: thumbnail,
    width: size, height: size,
    style: { borderRadius: "50%", objectFit: "cover", background: "#f0f0f0", ...style },
    onError: () => setErr(true),
    loading: "lazy",
  });
}

// ─── Color Swatch (for color step) ───────────────────────────────────────────
function ColorDot({ item, size }) {
  const isPattern = !item.hex;
  const dotStyle = {
    width: size, height: size, borderRadius: "50%",
    border: "2px solid #e5e5e5", flexShrink: 0,
  };
  if (isPattern) {
    dotStyle.background = patternGradient(item.value);
    dotStyle.backgroundSize = "8px 8px";
  } else {
    dotStyle.backgroundColor = item.hex;
    if (item.hex && item.hex.toLowerCase() === "#eeeeee") {
      dotStyle.border = "2px solid #ccc";
    }
  }
  return React.createElement("div", { style: dotStyle });
}

// ─── Rarity Badge ────────────────────────────────────────────────────────────
function RarityBadge({ count }) {
  const r = getRarityInfo(count);
  return React.createElement("span", {
    style: {
      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
      color: r.color, background: r.bg, textTransform: "uppercase", letterSpacing: 0.5,
    },
  }, r.label);
}

// ─── Item Tooltip ────────────────────────────────────────────────────────────
function ItemTooltip({ item, x, y, isColor }) {
  if (!item) return null;
  const pct = ((item.count / TOTAL_SUPPLY) * 100).toFixed(2);
  return React.createElement("div", {
    style: {
      position: "fixed", left: x + 10, top: y - 60,
      background: "#fff", border: "1px solid #e5e5e5", borderRadius: 10,
      padding: "8px 12px", boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
      zIndex: 10000, pointerEvents: "none", minWidth: 140,
    },
  },
    React.createElement("div", { style: { fontWeight: 600, fontSize: 13, color: "#1a1a2e", marginBottom: 4 } },
      formatName(item.value),
    ),
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6b7280" } },
      `${item.count.toLocaleString()} / ${TOTAL_SUPPLY.toLocaleString()}`,
      React.createElement("span", { style: { color: "#9ca3af" } }, `(${pct}%)`),
    ),
    React.createElement("div", { style: { marginTop: 4 } },
      React.createElement(RarityBadge, { count: item.count }),
    ),
  );
}

// ─── Radial Menu ─────────────────────────────────────────────────────────────
function RadialMenu({
  region, centerX, centerY, activeCategory, menuPhase, menuPage,
  build, onSelectCategory, onSelectTrait, onSelectColor, onPageChange,
  onClose, isMobile, tooltip, onItemHover,
}) {
  const categories = REGION_CATEGORIES[region];
  const nonColorCats = categories;
  const currentCat = activeCategory || nonColorCats[0];
  const isColorPhase = menuPhase === "color";

  const colorCatKey = COLOR_PAIRS[currentCat];
  const displayCategory = isColorPhase && colorCatKey ? colorCatKey : currentCat;
  const cat = CATEGORIES[displayCategory];
  const items = cat ? cat.items : [];

  const itemsPerPage = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE_DESKTOP;
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const pageItems = items.slice(menuPage * itemsPerPage, (menuPage + 1) * itemsPerPage);

  const radius = isMobile ? 95 : 130;
  const itemSize = isMobile ? 46 : 44;
  const hubRadius = nonColorCats.length > 3 ? 52 : 42;

  // Position items in a ring
  const angleStep = (2 * Math.PI) / Math.max(pageItems.length, 1);
  const startAngle = -Math.PI / 2;

  return React.createElement("div", {
    style: {
      position: "fixed", inset: 0, zIndex: 5000,
    },
    onClick: onClose,
  },
    // Semi-transparent backdrop
    React.createElement("div", {
      style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)" },
    }),

    // Menu container (centered at click point)
    React.createElement("div", {
      style: {
        position: "absolute",
        left: centerX, top: centerY,
        transform: "translate(-50%, -50%)",
        width: (radius + itemSize) * 2,
        height: (radius + itemSize) * 2,
      },
      onClick: (e) => e.stopPropagation(),
    },
      // Center hub
      React.createElement("div", {
        style: {
          position: "absolute",
          left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          width: hubRadius * 2, height: hubRadius * 2,
          borderRadius: "50%",
          background: "#fff",
          border: "2px solid #e5e5e5",
          boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          zIndex: 10,
          overflow: "hidden",
        },
      },
        // Region label
        React.createElement("div", {
          style: { fontSize: 9, fontWeight: 700, color: "#9ca3af", letterSpacing: 1, textTransform: "uppercase" },
        }, isColorPhase ? "Pick Color" : REGION_LABELS[region]),

        // Category tabs (only when multiple and in style phase)
        !isColorPhase && nonColorCats.length > 1 &&
          React.createElement("div", {
            style: {
              display: "flex", flexWrap: "wrap", gap: 2, justifyContent: "center",
              marginTop: 3, padding: "0 4px", maxWidth: hubRadius * 2 - 8,
            },
          },
            nonColorCats.map((catKey) => {
              const isActive = catKey === currentCat;
              const label = CATEGORIES[catKey].label.replace(/ /g, "").slice(0, 5);
              const hasBuild = catKey in build;
              return React.createElement("button", {
                key: catKey,
                onClick: (e) => { e.stopPropagation(); onSelectCategory(catKey); },
                style: {
                  fontSize: 7, fontWeight: isActive ? 700 : 500,
                  padding: "2px 4px", borderRadius: 3,
                  border: "none",
                  background: isActive ? "#7c3aed" : hasBuild ? "#7c3aed20" : "#f3f4f6",
                  color: isActive ? "#fff" : "#4a4a5a",
                  cursor: "pointer", lineHeight: 1.2,
                },
              }, label);
            }),
          ),

        // Close button
        React.createElement("button", {
          onClick: (e) => { e.stopPropagation(); onClose(); },
          style: {
            position: "absolute", top: 2, right: 4, background: "none", border: "none",
            color: "#aaa", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 2,
          },
        }, "\u00d7"),
      ),

      // Ring items
      pageItems.map((item, idx) => {
        const angle = startAngle + idx * angleStep;
        const ix = Math.cos(angle) * radius;
        const iy = Math.sin(angle) * radius;
        const isSelected = isColorPhase
          ? build[displayCategory] === item.value
          : build[currentCat] === item.value;

        return React.createElement("div", {
          key: item.value,
          style: {
            position: "absolute",
            left: `calc(50% + ${ix}px)`,
            top: `calc(50% + ${iy}px)`,
            transform: "translate(-50%, -50%)",
            width: itemSize, height: itemSize,
            borderRadius: "50%",
            background: "#fff",
            border: isSelected ? "3px solid #7c3aed" : "2px solid #e5e5e5",
            boxShadow: isSelected
              ? "0 0 0 3px rgba(124,58,237,0.2), 0 2px 8px rgba(0,0,0,0.1)"
              : "0 2px 8px rgba(0,0,0,0.08)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            transition: "transform 0.15s, box-shadow 0.15s",
            zIndex: 5,
          },
          onClick: (e) => {
            e.stopPropagation();
            if (isColorPhase) {
              onSelectColor(displayCategory, item.value);
            } else {
              onSelectTrait(currentCat, item.value);
            }
          },
          onMouseEnter: (e) => onItemHover(item, e.clientX, e.clientY),
          onMouseLeave: () => onItemHover(null),
          onMouseOver: (e) => {
            e.currentTarget.style.transform = "translate(-50%, -50%) scale(1.15)";
          },
          onMouseOut: (e) => {
            e.currentTarget.style.transform = "translate(-50%, -50%) scale(1)";
          },
        },
          isColorPhase
            ? React.createElement(ColorDot, { item, size: itemSize - 8 })
            : React.createElement(ThumbImg, { thumbnail: item.thumbnail, size: itemSize - 6 }),
        );
      }),

      // Pagination arrows (if needed)
      totalPages > 1 && React.createElement(React.Fragment, null,
        // Left arrow (9 o'clock)
        React.createElement("button", {
          style: {
            position: "absolute",
            left: `calc(50% - ${radius + itemSize + 8}px)`,
            top: "50%",
            transform: "translateY(-50%)",
            width: 30, height: 30, borderRadius: "50%",
            background: menuPage > 0 ? "#7c3aed" : "#e5e5e5",
            border: "none", color: menuPage > 0 ? "#fff" : "#aaa",
            cursor: menuPage > 0 ? "pointer" : "default",
            fontSize: 16, fontWeight: 700, display: "flex",
            alignItems: "center", justifyContent: "center",
            zIndex: 6,
          },
          onClick: (e) => { e.stopPropagation(); if (menuPage > 0) onPageChange(menuPage - 1); },
        }, "\u2039"),

        // Right arrow (3 o'clock)
        React.createElement("button", {
          style: {
            position: "absolute",
            left: `calc(50% + ${radius + itemSize + 8}px)`,
            top: "50%",
            transform: "translateY(-50%)",
            width: 30, height: 30, borderRadius: "50%",
            background: menuPage < totalPages - 1 ? "#7c3aed" : "#e5e5e5",
            border: "none", color: menuPage < totalPages - 1 ? "#fff" : "#aaa",
            cursor: menuPage < totalPages - 1 ? "pointer" : "default",
            fontSize: 16, fontWeight: 700, display: "flex",
            alignItems: "center", justifyContent: "center",
            zIndex: 6,
          },
          onClick: (e) => { e.stopPropagation(); if (menuPage < totalPages - 1) onPageChange(menuPage + 1); },
        }, "\u203A"),

        // Page indicator
        React.createElement("div", {
          style: {
            position: "absolute",
            left: "50%", top: `calc(50% + ${radius + itemSize + 14}px)`,
            transform: "translateX(-50%)",
            fontSize: 11, color: "#9ca3af", fontWeight: 600,
            zIndex: 6,
          },
        }, `${menuPage + 1} / ${totalPages}`),
      ),
    ),

    // Tooltip
    tooltip.item && React.createElement(ItemTooltip, {
      item: tooltip.item, x: tooltip.x, y: tooltip.y,
      isColor: isColorPhase,
    }),
  );
}

// ─── Build Summary ───────────────────────────────────────────────────────────
function BuildSummary({ build, onRemove, onClear }) {
  const entries = Object.entries(build);
  if (entries.length === 0) return null;

  return React.createElement("div", {
    style: {
      background: "#fafafa", borderRadius: 14, padding: "14px 18px",
      border: "1px solid #e5e5e5", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    },
  },
    React.createElement("div", {
      style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    },
      React.createElement("span", { style: { fontSize: 13, fontWeight: 700, color: "#1a1a2e" } },
        `Build \u00b7 ${entries.length} trait${entries.length !== 1 ? "s" : ""}`,
      ),
      React.createElement("button", {
        onClick: onClear,
        style: {
          background: "none", border: "1px solid #ddd", borderRadius: 6,
          color: "#888", cursor: "pointer", fontSize: 11, padding: "3px 10px",
        },
      }, "Clear All"),
    ),
    React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
      entries.map(([catKey, value]) => {
        const cat = CATEGORIES[catKey];
        if (!cat) return null;
        const item = cat.items.find((i) => i.value === value);
        if (!item) return null;
        return React.createElement("div", {
          key: catKey,
          style: {
            display: "flex", alignItems: "center", gap: 6,
            background: "#7c3aed10", border: "1px solid #7c3aed30",
            borderRadius: 8, padding: "4px 8px 4px 4px",
          },
        },
          cat.is_color
            ? React.createElement(ColorDot, { item, size: 20 })
            : React.createElement(ThumbImg, { thumbnail: item.thumbnail, size: 20 }),
          React.createElement("span", { style: { fontSize: 11, color: "#4a4a5a" } },
            `${cat.label}: ${formatName(value)}`,
          ),
          React.createElement("button", {
            onClick: () => onRemove(catKey),
            style: {
              background: "none", border: "none", color: "#aaa", cursor: "pointer",
              fontSize: 14, padding: "0 2px", lineHeight: 1,
            },
          }, "\u00d7"),
        );
      }),
    ),
  );
}

// ─── Trait Overlays ──────────────────────────────────────────────────────────
function TraitOverlays({ build }) {
  const entries = Object.entries(build);
  if (entries.length === 0) return null;

  return entries.map(([catKey, value]) => {
    const cat = CATEGORIES[catKey];
    if (!cat) return null;
    const item = cat.items.find((i) => i.value === value);
    if (!item) return null;
    const config = OVERLAY_CONFIG[catKey];
    if (!config) return null;

    return React.createElement("img", {
      key: catKey,
      src: `${BASE_URL}/${item.thumbnail}.png`,
      alt: `${cat.label}: ${formatName(value)}`,
      style: {
        position: "absolute",
        top: config.top,
        left: config.left,
        width: config.width,
        height: config.height,
        objectFit: "contain",
        zIndex: OVERLAY_Z[catKey] || 1,
        pointerEvents: "none",
        imageRendering: "pixelated",
      },
      onError: (e) => { e.target.style.display = "none"; },
    });
  });
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MeebitTraitGuide() {
  const [hoveredRegion, setHoveredRegion] = useState(null);
  const [activeRegion, setActiveRegion] = useState(null);
  const [activeCategory, setActiveCategory] = useState(null);
  const [menuPhase, setMenuPhase] = useState("style");
  const [menuPage, setMenuPage] = useState(0);
  const [menuCenter, setMenuCenter] = useState({ x: 0, y: 0 });
  const [build, setBuild] = useState({});
  const [tooltip, setTooltip] = useState({ item: null, x: 0, y: 0 });
  const [isMobile, setIsMobile] = useState(false);

  const containerRef = useRef(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Close on escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") closeMenu(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const cellSize = isMobile ? 7 : 11;
  const charWidth = 26 * cellSize;
  const charHeight = 48 * cellSize;

  const openMenu = useCallback((region, bounds) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Center of the region in screen coords
    const cx = rect.left + (bounds.x + bounds.w / 2) * (rect.width / charWidth);
    const cy = rect.top + (bounds.y + bounds.h / 2) * (rect.height / charHeight);
    setMenuCenter({ x: cx, y: cy });
    setActiveRegion(region);
    const cats = REGION_CATEGORIES[region];
    setActiveCategory(cats[0]);
    setMenuPhase("style");
    setMenuPage(0);
    setTooltip({ item: null, x: 0, y: 0 });
  }, [charWidth, charHeight]);

  const closeMenu = useCallback(() => {
    setActiveRegion(null);
    setActiveCategory(null);
    setMenuPhase("style");
    setMenuPage(0);
    setTooltip({ item: null, x: 0, y: 0 });
  }, []);

  const selectCategory = useCallback((catKey) => {
    setActiveCategory(catKey);
    setMenuPhase("style");
    setMenuPage(0);
  }, []);

  const selectTrait = useCallback((catKey, value) => {
    setBuild((prev) => {
      const next = { ...prev };
      if (next[catKey] === value) {
        delete next[catKey];
        return next;
      }
      next[catKey] = value;
      return next;
    });

    // Check for color step
    const colorCatKey = COLOR_PAIRS[catKey];
    if (colorCatKey && CATEGORIES[colorCatKey]) {
      setMenuPhase("color");
      setMenuPage(0);
    } else {
      closeMenu();
    }
  }, [closeMenu]);

  const selectColor = useCallback((colorCatKey, value) => {
    setBuild((prev) => {
      const next = { ...prev };
      if (next[colorCatKey] === value) {
        delete next[colorCatKey];
      } else {
        next[colorCatKey] = value;
      }
      return next;
    });
    closeMenu();
  }, [closeMenu]);

  const removeTrait = useCallback((catKey) => {
    setBuild((prev) => {
      const next = { ...prev };
      delete next[catKey];
      return next;
    });
  }, []);

  const clearBuild = useCallback(() => setBuild({}), []);

  const handleItemHover = useCallback((item, x, y) => {
    if (item) {
      setTooltip({ item, x, y });
    } else {
      setTooltip({ item: null, x: 0, y: 0 });
    }
  }, []);

  // Compute region bounds for the label
  const regionBoundsMap = useMemo(() => {
    const map = {};
    ["head", "face", "body", "legs", "feet"].forEach((region) => {
      let minR = 999, maxR = 0, minC = 999, maxC = 0;
      PIXEL_ROWS.forEach((row, rowIdx) => {
        if (getRegionForRow(rowIdx) !== region) return;
        for (let col = 0; col < row.length; col++) {
          if (row[col] !== ".") {
            minR = Math.min(minR, rowIdx);
            maxR = Math.max(maxR, rowIdx);
            minC = Math.min(minC, col);
            maxC = Math.max(maxC, col);
          }
        }
      });
      map[region] = {
        x: minC * cellSize - 2,
        y: minR * cellSize - 2,
        w: (maxC - minC + 1) * cellSize + 4,
        h: (maxR - minR + 1) * cellSize + 4,
      };
    });
    return map;
  }, [cellSize]);

  return React.createElement("div", {
    style: {
      maxWidth: 720,
      margin: "0 auto",
      padding: isMobile ? "16px 12px" : "32px 20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      color: "#1a1a2e",
      background: "#ffffff",
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    },
  },
    // Header
    React.createElement("div", { style: { textAlign: "center", marginBottom: isMobile ? 16 : 28 } },
      React.createElement("h1", {
        style: { fontSize: isMobile ? 20 : 26, fontWeight: 800, margin: "0 0 4px", color: "#1a1a2e", letterSpacing: -0.5 },
      }, "Meebits Trait Guide"),
      React.createElement("p", { style: { fontSize: 13, color: "#9ca3af", margin: 0 } },
        "Click a body region to explore traits",
      ),
    ),

    // Character area
    React.createElement("div", {
      ref: containerRef,
      style: {
        position: "relative",
        width: charWidth,
        height: charHeight,
        margin: "0 auto",
      },
    },
      // The SVG character
      React.createElement(MeebitCharacter, {
        hoveredRegion,
        onRegionHover: setHoveredRegion,
        onRegionClick: openMenu,
        cellSize,
      }),

      // Trait overlays
      React.createElement(TraitOverlays, { build }),

      // Region label on hover
      hoveredRegion && !activeRegion && React.createElement(RegionLabel, {
        region: hoveredRegion,
        bounds: regionBoundsMap[hoveredRegion],
        cellSize,
      }),
    ),

    // Radial menu
    activeRegion && React.createElement(RadialMenu, {
      region: activeRegion,
      centerX: menuCenter.x,
      centerY: menuCenter.y,
      activeCategory,
      menuPhase,
      menuPage,
      build,
      onSelectCategory: selectCategory,
      onSelectTrait: selectTrait,
      onSelectColor: selectColor,
      onPageChange: setMenuPage,
      onClose: closeMenu,
      isMobile,
      tooltip,
      onItemHover: handleItemHover,
    }),

    // Build summary
    React.createElement("div", { style: { width: "100%", maxWidth: 520, marginTop: 24 } },
      React.createElement(BuildSummary, { build, onRemove: removeTrait, onClear: clearBuild }),
    ),

    // Reset button
    Object.keys(build).length > 0 && React.createElement("button", {
      onClick: clearBuild,
      style: {
        marginTop: 16, padding: "8px 24px", borderRadius: 8,
        background: "#fff", border: "1px solid #ddd", color: "#6b7280",
        cursor: "pointer", fontSize: 13, fontWeight: 500,
      },
    }, "Reset Character"),
  );
}
