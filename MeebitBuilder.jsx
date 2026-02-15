import React, { useState, useEffect, useMemo, useCallback } from "react";

// ─── Constants ──────────────────────────────────────────────────────────────

const TOTAL_SUPPLY = 20000;

const ELEMENT_CATS = [
  "hair_style", "hat", "beard", "glasses", "earring",
  "necklace", "shirt", "overshirt", "pants", "shoes", "tattoo",
];

const COLOR_CATS = {
  hair_style: "hair_color",
  hat: "hat_color",
  beard: "beard_color",
  glasses: "glasses_color",
  shirt: "shirt_color",
  overshirt: "overshirt_color",
  pants: "pants_color",
  shoes: "shoes_color",
};

const CATEGORY_LABELS = {
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

const CATEGORY_ORDER = [
  "hair_style", "hair_color",
  "hat", "hat_color",
  "beard", "beard_color",
  "glasses", "glasses_color",
  "earring", "necklace",
  "shirt", "shirt_color",
  "overshirt", "overshirt_color",
  "pants", "pants_color",
  "shoes", "shoes_color",
  "tattoo", "jersey_number",
];

const SECTION_GROUPS = [
  { label: "Head", cats: ["hair_style", "hair_color", "hat", "hat_color"] },
  { label: "Face", cats: ["beard", "beard_color", "glasses", "glasses_color", "earring"] },
  { label: "Upper Body", cats: ["necklace", "shirt", "shirt_color", "overshirt", "overshirt_color"] },
  { label: "Lower Body", cats: ["pants", "pants_color", "shoes", "shoes_color"] },
  { label: "Extras", cats: ["tattoo", "jersey_number"] },
];

// ─── Utilities ──────────────────────────────────────────────────────────────

function formatName(value) {
  if (!value) return "";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toImageSlug(category, value) {
  const slug = value.toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  return `${category}_${slug}`;
}

function getRarityInfo(count) {
  const pct = (count / TOTAL_SUPPLY) * 100;
  if (pct < 0.1) return { label: "Mythic", color: "#dc2626", bg: "#fef2f2" };
  if (pct < 1) return { label: "Legendary", color: "#ea580c", bg: "#fff7ed" };
  if (pct < 5) return { label: "Rare", color: "#7c3aed", bg: "#f5f3ff" };
  if (pct < 20) return { label: "Uncommon", color: "#2563eb", bg: "#eff6ff" };
  return { label: "Common", color: "#6b7280", bg: "#f9fafb" };
}

// ─── Rule Engine ────────────────────────────────────────────────────────────

class RuleEngine {
  constructor(rules) {
    this.rules = rules;
    this.typeRules = rules.type_level_rules || {};
    this.perTypePools = rules.per_type_value_pools || {};
    this.colorMappings = rules.color_element_mappings || {};
    this.categoryExclusions = rules.category_exclusion_rules || [];
    this.valueExclusions = rules.value_exclusion_rules_all_population || [];
    this.deterministic = rules.deterministic_rules || [];
    this.genderClassification = rules.gender_trait_classification || {};

    // Build fast lookup indices
    this._buildIndices();
  }

  _buildIndices() {
    // Gender lookup: { "category=value" -> "male_only" | "female_only" }
    this.genderLookup = {};
    for (const item of this.genderClassification.male_only || []) {
      this.genderLookup[`${item.category}=${item.value}`] = "male";
    }
    for (const item of this.genderClassification.female_only || []) {
      this.genderLookup[`${item.category}=${item.value}`] = "female";
    }

    // Value exclusion lookup: { "cat=val" -> Set<"cat=val"> }
    this.exclusionIndex = {};
    for (const ex of this.valueExclusions) {
      if (!this.exclusionIndex[ex.trait_a]) this.exclusionIndex[ex.trait_a] = new Set();
      if (!this.exclusionIndex[ex.trait_b]) this.exclusionIndex[ex.trait_b] = new Set();
      this.exclusionIndex[ex.trait_a].add(ex.trait_b);
      this.exclusionIndex[ex.trait_b].add(ex.trait_a);
    }

    // Category exclusion lookup: { "cat" -> Set<"cat"> }
    this.catExclusionIndex = {};
    for (const ex of this.categoryExclusions) {
      const [a, b] = ex.categories;
      if (!this.catExclusionIndex[a]) this.catExclusionIndex[a] = new Set();
      if (!this.catExclusionIndex[b]) this.catExclusionIndex[b] = new Set();
      this.catExclusionIndex[a].add(b);
      this.catExclusionIndex[b].add(a);
    }

    // Color-element mapping: { "elem_cat -> color_cat" -> { value -> classification } }
    this.colorClassification = {};
    for (const [pairKey, mappings] of Object.entries(this.colorMappings)) {
      this.colorClassification[pairKey] = {};
      for (const m of mappings) {
        this.colorClassification[pairKey][m.value] = m.classification;
      }
    }

    // Deterministic lookup: { "cat=val" -> [{then_trait, ratio, type}] }
    this.deterministicIndex = {};
    for (const d of this.deterministic) {
      if (d.ratio < 1.0) continue; // Only 100% deterministic
      if (!this.deterministicIndex[d.if_trait]) this.deterministicIndex[d.if_trait] = [];
      this.deterministicIndex[d.if_trait].push(d);
    }
  }

  getAvailableCategories(type) {
    const tr = this.typeRules[type];
    if (!tr) return [];
    return CATEGORY_ORDER.filter(cat => {
      const count = tr.available_traits[cat];
      return count !== undefined && count > 0;
    });
  }

  getValuesForCategory(type, category) {
    const pool = this.perTypePools[type];
    if (!pool || !pool[category]) return [];
    return Object.entries(pool[category])
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  }

  checkTraitAvailability(type, gender, category, value, currentBuild) {
    // Returns { available: bool, reason: string|null }
    const key = `${category}=${value}`;

    // 1. Type-level: is this value in the type's pool?
    const pool = this.perTypePools[type];
    if (!pool || !pool[category] || !pool[category][value]) {
      return { available: false, reason: `Not available for ${type} type` };
    }

    // 2. Gender: is this a gendered trait?
    if (type === "Human" && gender) {
      const genderReq = this.genderLookup[key];
      if (genderReq === "male" && gender === "female") {
        return { available: false, reason: "Male-only trait" };
      }
      if (genderReq === "female" && gender === "male") {
        return { available: false, reason: "Female-only trait" };
      }
    }

    // 3. Category exclusions: is this category blocked by a selected category?
    const excludedCats = this.catExclusionIndex[category];
    if (excludedCats) {
      for (const excCat of excludedCats) {
        if (currentBuild[excCat]) {
          return {
            available: false,
            reason: `Can't combine ${CATEGORY_LABELS[category]} with ${CATEGORY_LABELS[excCat]}`,
          };
        }
      }
    }

    // 4. Value exclusions: is this specific value blocked by a selected value?
    const excluded = this.exclusionIndex[key];
    if (excluded) {
      for (const [bCat, bVal] of Object.entries(currentBuild)) {
        const bKey = `${bCat}=${bVal}`;
        if (excluded.has(bKey)) {
          return {
            available: false,
            reason: `Incompatible with ${formatName(bVal)} (${CATEGORY_LABELS[bCat]})`,
          };
        }
      }
    }

    return { available: true, reason: null };
  }

  getColorClassification(elemCategory, elemValue) {
    const pairKey = Object.keys(this.colorClassification).find(k =>
      k.startsWith(elemCategory + " ->")
    );
    if (!pairKey) return "sometimes_has_color";
    return this.colorClassification[pairKey][elemValue] || "sometimes_has_color";
  }

  isCategoryDisabled(type, category, currentBuild) {
    // Check if the whole category is disabled
    const tr = this.typeRules[type];
    if (!tr) return { disabled: true, reason: "Unknown type" };
    if (tr.available_traits[category] === 0 || tr.available_traits[category] === undefined) {
      return { disabled: true, reason: `${type} type never has ${CATEGORY_LABELS[category]}` };
    }

    // Category exclusions
    const excludedCats = this.catExclusionIndex[category];
    if (excludedCats) {
      for (const excCat of excludedCats) {
        if (currentBuild[excCat]) {
          return {
            disabled: true,
            reason: `Blocked by ${CATEGORY_LABELS[excCat]} (never co-occur)`,
          };
        }
      }
    }

    // Color category: check if element value implies never_has_color
    const colorCat = Object.entries(COLOR_CATS).find(([_, cc]) => cc === category);
    if (colorCat) {
      const elemCat = colorCat[0];
      const elemVal = currentBuild[elemCat];
      if (elemVal) {
        const cls = this.getColorClassification(elemCat, elemVal);
        if (cls === "never_has_color") {
          return {
            disabled: true,
            reason: `${formatName(elemVal)} never has a color`,
          };
        }
      }
    }

    return { disabled: false, reason: null };
  }
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function TypeSelector({ types, selected, onSelect }) {
  return React.createElement("div", { style: {
    display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16,
  }},
    Object.entries(types).sort((a, b) => b[1] - a[1]).map(([type, count]) =>
      React.createElement("button", {
        key: type,
        onClick: () => onSelect(type),
        style: {
          padding: "8px 16px",
          borderRadius: 8,
          border: selected === type ? "2px solid #7c3aed" : "2px solid #e5e7eb",
          background: selected === type ? "#7c3aed" : "#fff",
          color: selected === type ? "#fff" : "#374151",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "all 0.15s",
        },
      },
        React.createElement("img", {
          src: `/traits/type_${type.toLowerCase()}.webp`,
          alt: type,
          style: { width: 28, height: 28, borderRadius: 4, objectFit: "cover" },
          onError: (e) => { e.target.style.display = "none"; },
        }),
        `${type}`,
        React.createElement("span", {
          style: {
            fontSize: 11,
            opacity: 0.7,
            fontWeight: 400,
          },
        }, `(${count.toLocaleString()})`)
      )
    )
  );
}

function GenderSelector({ selected, onSelect }) {
  return React.createElement("div", { style: {
    display: "flex", gap: 8, marginBottom: 16,
  }},
    ["male", "female"].map(g =>
      React.createElement("button", {
        key: g,
        onClick: () => onSelect(g),
        style: {
          padding: "6px 20px",
          borderRadius: 20,
          border: selected === g ? "2px solid #7c3aed" : "2px solid #e5e7eb",
          background: selected === g ? "#7c3aed" : "#fff",
          color: selected === g ? "#fff" : "#374151",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 600,
          transition: "all 0.15s",
        },
      }, g === "male" ? "Male" : "Female")
    )
  );
}

function TraitOption({ category, value, count, isSelected, availability, onToggle }) {
  const { available, reason } = availability;
  const disabled = !available && !isSelected;
  const rarity = getRarityInfo(count);
  const imgSlug = toImageSlug(category, value);
  const pct = ((count / TOTAL_SUPPLY) * 100).toFixed(1);

  return React.createElement("div", {
    onClick: disabled ? undefined : onToggle,
    title: disabled ? reason : `${formatName(value)} - ${count.toLocaleString()} (${pct}%) - ${rarity.label}`,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 8,
      border: isSelected ? "2px solid #7c3aed" : "1px solid #e5e7eb",
      background: isSelected ? "#f5f3ff" : disabled ? "#f9fafb" : "#fff",
      opacity: disabled ? 0.45 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.15s",
      position: "relative",
      minWidth: 0,
    },
  },
    React.createElement("img", {
      src: `/traits/${imgSlug}.webp`,
      alt: value,
      style: {
        width: 32, height: 32, borderRadius: 4, objectFit: "cover",
        flexShrink: 0,
        filter: disabled ? "grayscale(1)" : "none",
      },
      onError: (e) => {
        e.target.style.display = "none";
      },
    }),
    React.createElement("div", { style: { minWidth: 0, flex: 1 } },
      React.createElement("div", { style: {
        fontSize: 13, fontWeight: isSelected ? 600 : 500,
        color: disabled ? "#9ca3af" : "#1f2937",
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}, formatName(value)),
      React.createElement("div", { style: {
        fontSize: 11, color: disabled ? "#d1d5db" : "#9ca3af",
      }},
        `${count.toLocaleString()} (${pct}%)`,
      ),
    ),
    disabled && reason
      ? React.createElement("div", { style: {
          fontSize: 10, color: "#ef4444", fontWeight: 500,
          maxWidth: 120, textAlign: "right", lineHeight: 1.2, flexShrink: 0,
        }}, reason)
      : null,
    isSelected
      ? React.createElement("div", { style: {
          width: 20, height: 20, borderRadius: "50%", background: "#7c3aed",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}, "\u2713")
      : null,
  );
}

function CategorySection({ category, label, values, selectedValue, isDisabled, disabledReason, ruleEngine, type, gender, build, onSelect }) {
  const [expanded, setExpanded] = useState(false);

  const hasValues = values && values.length > 0;

  return React.createElement("div", {
    style: {
      marginBottom: 4,
      borderRadius: 8,
      border: "1px solid #e5e7eb",
      overflow: "hidden",
      opacity: isDisabled ? 0.5 : 1,
    }
  },
    // Header
    React.createElement("button", {
      onClick: isDisabled ? undefined : () => setExpanded(!expanded),
      style: {
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        border: "none",
        background: selectedValue ? "#f5f3ff" : expanded ? "#f9fafb" : "#fff",
        cursor: isDisabled ? "not-allowed" : "pointer",
        fontSize: 14,
        fontWeight: 600,
        color: isDisabled ? "#9ca3af" : "#1f2937",
        textAlign: "left",
      },
    },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
        label,
        selectedValue
          ? React.createElement("span", { style: {
              fontSize: 12, fontWeight: 500, color: "#7c3aed",
              background: "#ede9fe", padding: "2px 8px", borderRadius: 12,
            }}, formatName(selectedValue))
          : null,
        isDisabled && disabledReason
          ? React.createElement("span", { style: {
              fontSize: 11, color: "#ef4444", fontWeight: 400,
            }}, `(${disabledReason})`)
          : null,
      ),
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
        hasValues
          ? React.createElement("span", { style: {
              fontSize: 11, color: "#9ca3af",
            }}, `${values.length} options`)
          : null,
        React.createElement("span", { style: {
          transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.15s",
          fontSize: 12,
          color: "#9ca3af",
        }}, "\u25BC"),
      ),
    ),
    // Body
    expanded && !isDisabled && hasValues
      ? React.createElement("div", { style: {
          padding: "8px 10px 10px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 6,
          maxHeight: 320,
          overflowY: "auto",
          borderTop: "1px solid #f3f4f6",
        }},
        selectedValue
          ? React.createElement("button", {
              onClick: () => onSelect(category, null),
              style: {
                gridColumn: "1 / -1",
                padding: "6px 12px",
                border: "1px dashed #d1d5db",
                borderRadius: 8,
                background: "#fff",
                color: "#6b7280",
                cursor: "pointer",
                fontSize: 12,
                marginBottom: 4,
              },
            }, `\u2715  Clear ${label}`)
          : null,
        ...values.map(({ value, count }) => {
          const availability = ruleEngine.checkTraitAvailability(
            type, gender, category, value, build
          );
          return React.createElement(TraitOption, {
            key: value,
            category,
            value,
            count,
            isSelected: selectedValue === value,
            availability,
            onToggle: () => onSelect(category, selectedValue === value ? null : value),
          });
        })
      )
      : null,
  );
}

function BuildSummary({ build, onRemove, onReset }) {
  const entries = Object.entries(build).filter(([_, v]) => v != null);
  if (entries.length === 0) return null;

  return React.createElement("div", { style: {
    padding: 16, background: "#f9fafb", borderRadius: 12,
    border: "1px solid #e5e7eb",
  }},
    React.createElement("div", { style: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: 10,
    }},
      React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: "#1f2937" }},
        `Build (${entries.length} traits)`),
      React.createElement("button", {
        onClick: onReset,
        style: {
          padding: "4px 12px", borderRadius: 6, border: "1px solid #e5e7eb",
          background: "#fff", color: "#6b7280", cursor: "pointer", fontSize: 12,
        },
      }, "Reset All"),
    ),
    React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } },
      ...entries.map(([cat, val]) =>
        React.createElement("div", {
          key: cat,
          style: {
            display: "flex", alignItems: "center", gap: 6,
            padding: "4px 10px 4px 6px",
            background: "#ede9fe", borderRadius: 16,
            fontSize: 12, color: "#5b21b6",
          },
        },
          React.createElement("img", {
            src: `/traits/${toImageSlug(cat, val)}.webp`,
            alt: val,
            style: { width: 20, height: 20, borderRadius: 3, objectFit: "cover" },
            onError: (e) => { e.target.style.display = "none"; },
          }),
          React.createElement("span", { style: { fontWeight: 500 } },
            `${CATEGORY_LABELS[cat] || cat}: ${formatName(val)}`),
          React.createElement("button", {
            onClick: () => onRemove(cat),
            style: {
              background: "none", border: "none", cursor: "pointer",
              color: "#7c3aed", fontWeight: 700, fontSize: 14, padding: "0 2px",
              lineHeight: 1,
            },
          }, "\u00d7"),
        )
      )
    ),
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function MeebitBuilder() {
  const [rules, setRules] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedType, setSelectedType] = useState("Human");
  const [selectedGender, setSelectedGender] = useState(null);
  const [build, setBuild] = useState({});

  // Load rules
  useEffect(() => {
    fetch("/meebits_rules.json")
      .then(r => r.json())
      .then(data => {
        setRules(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const ruleEngine = useMemo(() => {
    if (!rules) return null;
    return new RuleEngine(rules);
  }, [rules]);

  const types = useMemo(() => {
    if (!rules) return {};
    return rules.metadata.types;
  }, [rules]);

  const handleTypeChange = useCallback((type) => {
    setSelectedType(type);
    setSelectedGender(null);
    setBuild({});
  }, []);

  const handleGenderChange = useCallback((gender) => {
    setSelectedGender(gender);
    // Clear traits that are incompatible with new gender
    setBuild(prev => {
      const next = {};
      for (const [cat, val] of Object.entries(prev)) {
        if (val == null) continue;
        const key = `${cat}=${val}`;
        const gReq = ruleEngine?.genderLookup[key];
        if (!gReq || gReq === gender) {
          next[cat] = val;
        }
      }
      return next;
    });
  }, [ruleEngine]);

  const handleTraitSelect = useCallback((category, value) => {
    setBuild(prev => {
      const next = { ...prev };
      if (value === null) {
        delete next[category];
        // If clearing an element, also clear its color
        const colorCat = COLOR_CATS[category];
        if (colorCat) delete next[colorCat];
      } else {
        next[category] = value;
        // If element value has never_has_color, clear the color
        if (ruleEngine && COLOR_CATS[category]) {
          const cls = ruleEngine.getColorClassification(category, value);
          if (cls === "never_has_color") {
            delete next[COLOR_CATS[category]];
          }
        }
        // Clear conflicting category exclusions
        if (ruleEngine) {
          const excCats = ruleEngine.catExclusionIndex[category];
          if (excCats) {
            for (const ec of excCats) {
              delete next[ec];
              const colorCat = COLOR_CATS[ec];
              if (colorCat) delete next[colorCat];
            }
          }
        }
      }
      return next;
    });
  }, [ruleEngine]);

  const handleRemoveTrait = useCallback((category) => {
    handleTraitSelect(category, null);
  }, [handleTraitSelect]);

  const handleReset = useCallback(() => {
    setBuild({});
    setSelectedGender(null);
  }, []);

  // Loading / Error states
  if (loading) {
    return React.createElement("div", { style: {
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", fontSize: 18, color: "#6b7280",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}, "Loading rules...");
  }

  if (error || !ruleEngine) {
    return React.createElement("div", { style: {
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", fontSize: 18, color: "#ef4444",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}, `Error: ${error || "Failed to initialize"}`);
  }

  const availableCats = ruleEngine.getAvailableCategories(selectedType);

  return React.createElement("div", {
    style: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      maxWidth: 1100,
      margin: "0 auto",
      padding: "24px 20px",
      color: "#1f2937",
    },
  },
    // Header
    React.createElement("div", { style: {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: 24,
    }},
      React.createElement("div", null,
        React.createElement("h1", { style: {
          fontSize: 28, fontWeight: 800, margin: 0, color: "#1a1a2e",
          letterSpacing: "-0.5px",
        }}, "Build-a-Meebit"),
        React.createElement("p", { style: {
          fontSize: 14, color: "#6b7280", marginTop: 4,
        }}, "Select type, gender, and traits. Rules are enforced in real-time."),
      ),
      React.createElement("button", {
        onClick: handleReset,
        style: {
          padding: "8px 20px", borderRadius: 8,
          border: "2px solid #e5e7eb", background: "#fff",
          color: "#374151", cursor: "pointer", fontSize: 13, fontWeight: 600,
        },
      }, "Reset All"),
    ),

    // Layout: sidebar + main
    React.createElement("div", { style: {
      display: "grid",
      gridTemplateColumns: "280px 1fr",
      gap: 24,
      alignItems: "start",
    }},
      // Left sidebar: preview + summary
      React.createElement("div", { style: { position: "sticky", top: 24 } },
        // Type image
        React.createElement("div", { style: {
          background: "#f9fafb", borderRadius: 16, padding: 20,
          border: "1px solid #e5e7eb", marginBottom: 16, textAlign: "center",
        }},
          React.createElement("img", {
            src: `/traits/type_${selectedType.toLowerCase()}.webp`,
            alt: selectedType,
            style: {
              width: "100%", maxWidth: 200, borderRadius: 12,
            },
          }),
          React.createElement("div", { style: {
            fontSize: 18, fontWeight: 700, marginTop: 12, color: "#1a1a2e",
          }}, selectedType),
          selectedGender
            ? React.createElement("div", { style: {
                fontSize: 13, color: "#7c3aed", fontWeight: 600, marginTop: 4,
              }}, formatName(selectedGender))
            : null,
        ),
        // Build summary
        React.createElement(BuildSummary, {
          build,
          onRemove: handleRemoveTrait,
          onReset: handleReset,
        }),
      ),

      // Right: controls
      React.createElement("div", null,
        // Type selector
        React.createElement("div", { style: { marginBottom: 20 } },
          React.createElement("h3", { style: {
            fontSize: 13, fontWeight: 700, color: "#6b7280",
            textTransform: "uppercase", letterSpacing: "0.05em",
            marginBottom: 8,
          }}, "Type"),
          React.createElement(TypeSelector, {
            types,
            selected: selectedType,
            onSelect: handleTypeChange,
          }),
        ),

        // Gender selector (Human only)
        selectedType === "Human"
          ? React.createElement("div", { style: { marginBottom: 20 } },
              React.createElement("h3", { style: {
                fontSize: 13, fontWeight: 700, color: "#6b7280",
                textTransform: "uppercase", letterSpacing: "0.05em",
                marginBottom: 8,
              }}, "Gender"),
              React.createElement(GenderSelector, {
                selected: selectedGender,
                onSelect: handleGenderChange,
              }),
              !selectedGender
                ? React.createElement("p", { style: {
                    fontSize: 12, color: "#9ca3af", marginTop: 4,
                  }}, "Select a gender to filter gender-specific traits")
                : null,
            )
          : null,

        // Trait sections
        React.createElement("div", null,
          ...SECTION_GROUPS.map(group => {
            const visibleCats = group.cats.filter(c => availableCats.includes(c));
            if (visibleCats.length === 0) return null;

            return React.createElement("div", {
              key: group.label,
              style: { marginBottom: 20 },
            },
              React.createElement("h3", { style: {
                fontSize: 13, fontWeight: 700, color: "#6b7280",
                textTransform: "uppercase", letterSpacing: "0.05em",
                marginBottom: 8,
                paddingBottom: 6,
                borderBottom: "2px solid #f3f4f6",
              }}, group.label),
              ...visibleCats.map(cat => {
                const { disabled: isDisabled, reason: disabledReason } =
                  ruleEngine.isCategoryDisabled(selectedType, cat, build);
                const values = ruleEngine.getValuesForCategory(selectedType, cat);

                return React.createElement(CategorySection, {
                  key: cat,
                  category: cat,
                  label: CATEGORY_LABELS[cat] || cat,
                  values,
                  selectedValue: build[cat] || null,
                  isDisabled,
                  disabledReason,
                  ruleEngine,
                  type: selectedType,
                  gender: selectedGender,
                  build,
                  onSelect: handleTraitSelect,
                });
              }),
            );
          }),
        ),
      ),
    ),
  );
}
