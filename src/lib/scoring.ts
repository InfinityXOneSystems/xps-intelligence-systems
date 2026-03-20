export interface LeadScore {
  total: number; // 0-100
  breakdown: {
    contactCompleteness: number; // 0-25
    engagementSignals: number;   // 0-25
    companyProfile: number;      // 0-25
    geographicFit: number;       // 0-25
  };
}

export function normalizeScore(raw: number, min = 0, max = 100): number {
  if (min === max) return 0; // guard against division by zero
  return Math.max(0, Math.min(100, Math.round(((raw - min) / (max - min)) * 100)));
}

export function scoreLead(lead: {
  email?: string;
  phone?: string;
  contact_name?: string;
  website?: string;
  vertical?: string;
  location?: string;
  estimated_value?: number;
}): LeadScore {
  // Contact completeness (0-25)
  let contactScore = 0;
  if (lead.email) contactScore += 10;
  if (lead.phone) contactScore += 8;
  if (lead.contact_name) contactScore += 7;

  // Engagement signals based on value (0-25)
  let engagementScore = 0;
  if (lead.estimated_value) {
    if (lead.estimated_value >= 100000) engagementScore = 25;
    else if (lead.estimated_value >= 50000) engagementScore = 20;
    else if (lead.estimated_value >= 25000) engagementScore = 15;
    else if (lead.estimated_value >= 10000) engagementScore = 10;
    else engagementScore = 5;
  }

  // Company profile (0-25)
  let companyScore = 5; // base
  if (lead.website) companyScore += 10;
  if (lead.vertical) companyScore += 10;

  // Geographic fit (0-25) - FL markets score high
  let geoScore = 0;
  if (lead.location) {
    const loc = lead.location.toLowerCase();
    if (loc.includes("fl") || loc.includes("florida")) geoScore = 25;
    else if (loc.includes("southeast") || loc.includes("tampa") || loc.includes("miami") || loc.includes("orlando")) geoScore = 20;
    else geoScore = 10;
  }

  const total = contactScore + engagementScore + companyScore + geoScore;
  return {
    total: Math.min(100, total),
    breakdown: {
      contactCompleteness: contactScore,
      engagementSignals: engagementScore,
      companyProfile: companyScore,
      geographicFit: geoScore,
    },
  };
}
